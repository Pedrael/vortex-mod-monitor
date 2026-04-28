/**
 * BuildSession — per-draft state machine for the curator build flow.
 *
 * Vortex's main pages mount/unmount whenever the user clicks between
 * sidebar tabs. Holding the in-flight `loadBuildContext` /
 * `runBuildPipeline` promises and their AbortControllers in React
 * component state means a tab switch silently aborts and restarts the
 * pipeline — the bug we hit in 0.0.1. Hoisting them to module-level
 * objects keeps the work alive in the background and lets the UI
 * just subscribe to the current snapshot whenever it (re)mounts.
 *
 * Track 1 (parallel drafts): a curator can have many drafts in flight
 * — one for each collection they're working on. Each draft owns its
 * own `BuildSession` instance, keyed by `draftId` (UUIDv4). Sessions
 * live in {@link BuildSessionRegistry} (see `buildSessionRegistry.ts`)
 * which also owns the global build queue: only one session can be
 * actively *building* at any time; the rest park in `queued` until
 * the slot frees.
 *
 * The session is intentionally NOT in Redux:
 *   • the payload (mods, hashes, draft) is large and ephemeral;
 *     we don't want it serialised into the app-wide store;
 *   • Vortex's reducers run synchronously on the main thread and
 *     this state ticks every ~50ms during hashing — easy way to
 *     starve the rest of the app;
 *   • only one component (BuildPage) ever cares about it. A custom
 *     pub/sub keeps the contract explicit and the dependencies small.
 *
 * Lifecycle (per session):
 *   idle ──begin──► loading ──hashed──► form ──build──► queued / building
 *                                              ──ok────────►── done
 *      ▲                │                  │                │
 *      └──reset/cancel──┴───errors─────────┴────────────────┘
 *
 * `queued` collapses to `building` automatically when the registry's
 * global build slot frees up. Users see "Waiting for current build to
 * finish" with a cancel button that bails out cleanly without
 * disturbing whoever holds the slot.
 *
 * Cancellation:
 *   • cancelLoading() and cancelBuilding() both flip the same
 *     AbortController owned by the session. The engine's AbortError
 *     is caught here and lowered into the appropriate "previous"
 *     state (loading → idle, building → form).
 *   • cancelQueued() asks the registry to drop us from the queue
 *     and rewinds to form.
 *
 * Error reporting:
 *   • On failure, state becomes { kind: "error", error, errorId }.
 *     `errorId` is a fresh per-failure number so the React layer
 *     can de-duplicate "I already opened the modal for this exact
 *     failure" without leaking the raw error around.
 *
 * Drafts:
 *   • Each session is bound to a single `draftId` for its lifetime.
 *     `loadDraft`, `saveDraft`, and `deleteDraft` are all keyed on
 *     that id so two sessions never clobber each other's autosave.
 *   • Draft restore happens once inside `begin`, after the heavy
 *     hashing pass. It's part of the session (not the React tree)
 *     so the form lights up with the restored values even if the
 *     user is on another tab when loading finishes.
 *   • Draft DELETE happens on transition to `done` — the build
 *     succeeded so the in-flight form is no longer interesting.
 *   • Draft AUTOSAVE stays in the React component (it only matters
 *     while the user is typing, which means they're on the page).
 *
 * Vortex restart behaviour:
 *   • Sessions live only for the JS heap's lifetime — any in-flight
 *     build dies on a Vortex restart. That's fine: the on-disk
 *     draft (`core/draftStorage`) covers cold restarts via the
 *     dashboard repopulating the registry on next open.
 */

import type { types } from "vortex-api";

import { AbortError } from "../../../core/archiveHashing";
import {
  deleteDraft,
  getAppDataPath,
  loadDraft,
} from "../../../core/draftStorage";
import type { ExternalModConfigEntry } from "../../../core/manifest/collectionConfig";
import type { VerificationLevel } from "../../../types/ehcoll";
import {
  loadBuildContext,
  runBuildPipeline,
  type BuildContext,
  type BuildPipelineResult,
  type BuildProgress,
  type CuratorInput,
} from "./engine";

// ───────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────

/**
 * Persisted shape of an in-flight build form. Lives on disk via
 * `core/draftStorage`; restored on transition into `form`.
 *
 * Deliberately a flat snapshot of the user-editable fields — NEVER
 * the whole BuildContext (mods, configPath, hashes, …). That data is
 * freshly re-derived from Vortex state on every session anyway, and
 * bundling hashes into the draft would let it go stale against an
 * evolving profile and silently restore wrong archive refs.
 *
 * Identity (Track 1 — parallel drafts):
 *  - Each draft has its own {@link draftId} (UUIDv4) so the curator
 *    can have many in-flight builds simultaneously without them
 *    clobbering each other on disk.
 *  - {@link gameId} pins the draft to a game — switching games in
 *    Vortex doesn't reuse a draft from a different game's profile;
 *    the dashboard surfaces drafts for the currently active game first.
 *  - {@link linkedSlug} / {@link linkedPackageId} are populated when
 *    the curator opens "Update" from an already-published collection.
 *    Otherwise undefined (a fresh draft / duplicate).
 */
export interface BuildDraftPayload {
  /**
   * Unique identifier for this draft. Stable across saves; never
   * reused. Generated when the user creates a new draft (or via
   * duplicate-as-fresh on the dashboard).
   *
   * Optional in the type so loaders can tolerate legacy gameId-keyed
   * drafts during migration; `loadDraft` always emits a `draftId`
   * (back-filling on the fly when needed) so consumers don't have to.
   */
  draftId?: string;
  /**
   * Game this draft is for. Pinned at creation so a draft started
   * for Skyrim doesn't suddenly "load mods from Fallout" when the
   * curator switches games in Vortex.
   *
   * Optional for legacy drafts; back-filled from the on-disk file
   * key during migration.
   */
  gameId?: string;
  /**
   * Curator-facing label shown in the dashboard ("My big mage build",
   * "Survival 1.4 candidate"). Falls back to `curator.name` when the
   * curator hasn't bothered with a separate dashboard label yet.
   */
  title?: string;
  /**
   * Slug of the published collection this draft updates, when the
   * curator opened it via "Update" on the dashboard. Used to:
   *  - resolve a stable {@link linkedPackageId},
   *  - show "Editing v1.2.0 → ..." in the dashboard,
   *  - feed the existing `collectionConfig` lookup so the build reuses
   *    the same packageId on success (preserving release lineage).
   */
  linkedSlug?: string;
  /**
   * UUIDv4 of the published collection this draft updates. Read from
   * the per-collection config file at link time so a rename of the
   * source collection doesn't unlink it — slug can drift, packageId
   * is stable.
   */
  linkedPackageId?: string;
  curator: CuratorInput;
  overrides: Record<string, ExternalModConfigEntry>;
  readme: string;
  changelog: string;
  /**
   * Optional — older drafts (pre-Tier-1) won't have it. Loaders
   * back-fill `"fast"` to keep restored sessions consistent with
   * the new default.
   */
  verificationLevel?: VerificationLevel;
}

export interface BuildErrorRecord {
  /** Unique id per failure — enables "already reported?" dedup in the UI. */
  errorId: number;
  error: unknown;
  /** Human-readable hint about which phase blew up. */
  phase: "load" | "build";
}

export type BuildSessionState =
  | {
      /**
       * No work in flight, no completed build to show. The page
       * lands here on first ever open and after the user clicks
       * "Build another" / "Done" → home.
       */
      kind: "idle";
    }
  | {
      kind: "loading";
      phase?: BuildProgress;
    }
  | {
      kind: "form";
      ctx: BuildContext;
      curator: CuratorInput;
      overrides: Record<string, ExternalModConfigEntry>;
      readme: string;
      changelog: string;
      verificationLevel: VerificationLevel;
      validationError?: string;
      /**
       * ISO timestamp of the autosaved draft we restored from.
       * `undefined` after the user dismisses the banner or chooses
       * "Discard draft". Autosave keeps running independently.
       */
      restoredAt?: string;
    }
  | {
      /**
       * Build was requested but the registry's global build slot is
       * occupied by another draft. We park here, the registry
       * promotes us to `building` automatically when the slot
       * frees up. Until then the user can cancel cleanly without
       * touching whoever's currently holding the slot.
       */
      kind: "queued";
      ctx: BuildContext;
      curator: CuratorInput;
      overrides: Record<string, ExternalModConfigEntry>;
      readme: string;
      changelog: string;
      verificationLevel: VerificationLevel;
      /**
       * 1-based queue position at the moment we entered the state.
       * Updated by the registry whenever someone ahead of us
       * finishes / drops out. Purely informational.
       */
      queuePosition: number;
    }
  | {
      kind: "building";
      ctx: BuildContext;
      curator: CuratorInput;
      progress: BuildProgress;
    }
  | {
      kind: "done";
      result: BuildPipelineResult;
      ctx: BuildContext;
      curator: CuratorInput;
    }
  | {
      kind: "error";
      record: BuildErrorRecord;
      /**
       * Best-effort form snapshot from before the failure. Lets the
       * UI offer "Retry" without forcing the user to retype.
       */
      formSnapshot?: Extract<BuildSessionState, { kind: "form" }>;
    };

export type BuildSessionListener = (state: BuildSessionState) => void;

export interface BuildAttemptInput {
  /**
   * Snapshot of the form state at click time. Hoisted into the
   * session so a remount mid-build doesn't lose it.
   */
  ctx: BuildContext;
  curator: CuratorInput;
  overrides: Record<string, ExternalModConfigEntry>;
  readme: string;
  changelog: string;
  /**
   * Curator's chosen integrity verification depth. Defaults to
   * `"fast"` if omitted (form persistence layer migrates older
   * drafts to fast on load).
   */
  verificationLevel?: VerificationLevel;
}

// ───────────────────────────────────────────────────────────────────────
// Implementation
// ───────────────────────────────────────────────────────────────────────

/**
 * Internal contract the registry implements. Hoisted to a type alias
 * so {@link BuildSession} can hold a reference without a circular
 * import on the registry module. The registry sets this back-pointer
 * on construction; tests can pass a stub.
 */
export interface BuildSessionRegistryHooks {
  /**
   * Ask the registry to schedule a build for this session.
   *  - Returns 0 if the build started immediately (caller should
   *    transition to `building`).
   *  - Returns 1+ if the build is queued at that 1-based position
   *    (caller should transition to `queued`). The registry will
   *    invoke `onSlotAcquired` when it's our turn.
   */
  enqueueBuild(
    session: BuildSession,
    onSlotAcquired: () => void,
  ): number;
  /**
   * Tell the registry our current build is finished (success, error,
   * or cancellation) so it can pick the next queued session.
   */
  releaseBuild(session: BuildSession): void;
  /**
   * Drop us from the queue (we cancelled before the slot opened).
   * No-op if we've already been promoted out of the queue.
   */
  cancelQueued(session: BuildSession): void;
  /**
   * Notify the registry our state has changed so it can re-emit to
   * dashboard subscribers. Per-session listeners are dispatched by
   * `BuildSession` itself; this is for the registry-level "any
   * session changed" stream.
   */
  notifyStateChanged(session: BuildSession): void;
}

class BuildSession {
  /**
   * Stable on-disk identity for this draft. Survives Vortex restarts
   * via `core/draftStorage`; survives sidebar tab switches via the
   * registry. Never reused across drafts.
   */
  readonly draftId: string;
  /**
   * Vortex game this draft is pinned to. Set at session creation
   * (typically the active game when "New draft" was clicked) and
   * never changes. The dashboard uses this to gate "open" — drafts
   * for non-active games show as read-only with a "Switch to <X>"
   * affordance instead of entering the wizard.
   */
  readonly gameId: string;

  private readonly hooks: BuildSessionRegistryHooks;

  private state: BuildSessionState = { kind: "idle" };
  private readonly listeners = new Set<BuildSessionListener>();
  /** Active AbortController for whichever async pass is in flight. */
  private controller: AbortController | undefined;
  /** Monotonic counter so each error gets a fresh `errorId`. */
  private errorSeq = 0;
  /**
   * Snapshot of the form at build-request time. Held across the
   * `queued` → `building` transition so the registry can promote us
   * without us having to re-snapshot. Cleared in setState() when we
   * leave the queued+building region.
   */
  private pendingBuildInput: BuildAttemptInput | undefined;

  constructor(args: {
    draftId: string;
    gameId: string;
    hooks: BuildSessionRegistryHooks;
  }) {
    this.draftId = args.draftId;
    this.gameId = args.gameId;
    this.hooks = args.hooks;
  }

  getState(): BuildSessionState {
    return this.state;
  }

  /**
   * Subscribe to state changes. Returns the unsubscribe function so
   * React effects can clean up trivially:
   *
   *   useEffect(() => session.subscribe(setLocal), [session]);
   */
  subscribe(listener: BuildSessionListener): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  // ── Form mutations (called by the React layer while on the page) ─

  /**
   * Patch the current form state. Cheap: no AbortController flip,
   * no async work. Used by every keystroke / checkbox / textarea in
   * BuildPage so the session always reflects what the user sees.
   */
  patchForm(
    next: Partial<Extract<BuildSessionState, { kind: "form" }>>,
  ): void {
    if (this.state.kind !== "form") return;
    this.setState({
      ...this.state,
      ...next,
      // any user change clears any stale validation error
      validationError: undefined,
    });
  }

  dismissDraftBanner(): void {
    if (this.state.kind !== "form") return;
    if (this.state.restoredAt === undefined) return;
    this.setState({ ...this.state, restoredAt: undefined });
  }

  /**
   * Drop any restored values, wipe the on-disk draft for THIS
   * draftId, and reset the form to the values derived from the
   * active collection config (everything still loaded in `ctx`).
   *
   * Note: only this draft's file is deleted — other parallel drafts
   * are untouched. This is the load-bearing reason `BuildSession`
   * holds `draftId` rather than re-deriving it from `ctx.gameId`.
   */
  async discardDraft(): Promise<void> {
    if (this.state.kind !== "form") return;
    const { ctx } = this.state;
    void deleteDraft(getAppDataPath(), "build", this.draftId);
    this.setState({
      kind: "form",
      ctx,
      curator: {
        name: ctx.defaultName,
        version: ctx.defaultVersion,
        author: ctx.defaultAuthor,
        description: "",
      },
      overrides: { ...ctx.collectionConfig.externalMods },
      readme: ctx.collectionConfig.readme ?? "",
      changelog: ctx.collectionConfig.changelog ?? "",
      verificationLevel: "fast",
      restoredAt: undefined,
    });
  }

  /**
   * Surface a synchronous validation error in the form. UI uses this
   * when the user clicks Build but the curator input is invalid.
   */
  setValidationError(message: string): void {
    if (this.state.kind !== "form") return;
    this.setState({ ...this.state, validationError: message });
  }

  // ── Phase transitions (called by user actions) ───────────────────

  /**
   * idle/error → loading. Kicks off `loadBuildContext`, restores any
   * autosaved draft once it returns, and parks in `form` state ready
   * for editing.
   *
   * Safe to call repeatedly: a second call while already loading is
   * a no-op (we don't restart the pipeline). Callers should disable
   * their "Begin" button while not in idle/error.
   */
  begin(api: types.IExtensionApi): void {
    if (this.state.kind !== "idle" && this.state.kind !== "error") return;
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.setState({ kind: "loading" });

    void (async (): Promise<void> => {
      try {
        const ctx = await loadBuildContext(api, {
          signal: controller.signal,
          onProgress: (progress) => {
            // Drop late progress events from a controller that's
            // already been replaced (e.g. user cancelled and clicked
            // Begin again before the previous run ack'd the abort).
            if (this.controller !== controller) return;
            if (this.state.kind !== "loading") return;
            this.setState({ kind: "loading", phase: progress });
          },
        });
        if (this.controller !== controller) return;

        // Defaults derived from the freshly-read Vortex state +
        // per-collection config on disk. These are the "blank slate"
        // values the curator would see on first open.
        const baseForm: Extract<BuildSessionState, { kind: "form" }> = {
          kind: "form",
          ctx,
          curator: {
            name: ctx.defaultName,
            version: ctx.defaultVersion,
            author: ctx.defaultAuthor,
            description: "",
          },
          overrides: { ...ctx.collectionConfig.externalMods },
          readme: ctx.collectionConfig.readme ?? "",
          changelog: ctx.collectionConfig.changelog ?? "",
          verificationLevel: "fast",
        };

        let envelope: Awaited<
          ReturnType<typeof loadDraft<BuildDraftPayload>>
        > = undefined;
        try {
          envelope = await loadDraft<BuildDraftPayload>(
            getAppDataPath(),
            "build",
            this.draftId,
          );
        } catch {
          /* swallow — best-effort restore */
        }
        if (this.controller !== controller) return;

        if (envelope !== undefined) {
          this.setState({
            ...baseForm,
            curator: { ...baseForm.curator, ...envelope.payload.curator },
            overrides: {
              ...baseForm.overrides,
              ...envelope.payload.overrides,
            },
            readme: envelope.payload.readme,
            changelog: envelope.payload.changelog,
            verificationLevel:
              envelope.payload.verificationLevel ?? baseForm.verificationLevel,
            restoredAt: envelope.savedAt,
          });
        } else {
          this.setState(baseForm);
        }
        this.controller = undefined;
      } catch (err) {
        if (this.controller !== controller) return;
        this.controller = undefined;
        if (isAbortError(err)) {
          this.setState({ kind: "idle" });
          return;
        }
        this.setState({
          kind: "error",
          record: {
            errorId: ++this.errorSeq,
            error: err,
            phase: "load",
          },
          formSnapshot: undefined,
        });
      }
    })();
  }

  cancelLoading(): void {
    if (this.state.kind !== "loading") return;
    this.controller?.abort();
    // The controller-owning task observes the abort and resets to idle.
  }

  /**
   * form → queued/building. Snapshots the form, hands the request to
   * the registry's build queue, and parks in `queued` if the global
   * build slot is busy. The registry calls back into `_runBuild` when
   * our turn comes.
   *
   * Caller is responsible for validating `input.curator` first (so
   * the page can show validation errors inline) — the session only
   * runs the engine.
   */
  build(api: types.IExtensionApi, input: BuildAttemptInput): void {
    if (this.state.kind !== "form") return;
    this.controller?.abort();
    this.controller = undefined;
    this.pendingBuildInput = input;

    const queuePosition = this.hooks.enqueueBuild(this, () => {
      this._runBuild(api);
    });

    if (queuePosition > 0) {
      // Slot busy — park in `queued` until promoted.
      this.setState({
        kind: "queued",
        ctx: input.ctx,
        curator: input.curator,
        overrides: input.overrides,
        readme: input.readme,
        changelog: input.changelog,
        verificationLevel: input.verificationLevel ?? "fast",
        queuePosition,
      });
      return;
    }

    // Slot acquired immediately. The registry's contract is to call
    // our onSlotAcquired synchronously when it returns 0, so we're
    // already in `building` here — nothing else to do.
  }

  /**
   * Update the queue position the user sees. Called by the registry
   * when sessions ahead of us drop out (cancel / finish) without us
   * being promoted yet.
   */
  _updateQueuePosition(position: number): void {
    if (this.state.kind !== "queued") return;
    if (this.state.queuePosition === position) return;
    this.setState({ ...this.state, queuePosition: position });
  }

  /**
   * Internal: run the build pipeline now that we own the slot. Split
   * out from `build()` so the registry can defer execution while
   * other sessions hold the slot. Always call `releaseBuild` on the
   * way out so the next queued session is promoted.
   */
  private _runBuild(api: types.IExtensionApi): void {
    const input = this.pendingBuildInput;
    if (input === undefined) {
      // We were cancelled between enqueueBuild() and the slot opening.
      this.hooks.releaseBuild(this);
      return;
    }
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const formSnapshot: Extract<BuildSessionState, { kind: "form" }> = {
      kind: "form",
      ctx: input.ctx,
      curator: input.curator,
      overrides: input.overrides,
      readme: input.readme,
      changelog: input.changelog,
      verificationLevel: input.verificationLevel ?? "fast",
    };
    this.setState({
      kind: "building",
      ctx: input.ctx,
      curator: input.curator,
      progress: { phase: "writing-config" },
    });

    void (async (): Promise<void> => {
      try {
        const result = await runBuildPipeline(
          api,
          input.ctx,
          input.curator,
          {
            externalMods: input.overrides,
            readme: input.readme,
            changelog: input.changelog,
            verificationLevel: input.verificationLevel ?? "fast",
          },
          {
            signal: controller.signal,
            onProgress: (progress) => {
              if (this.controller !== controller) return;
              if (this.state.kind !== "building") return;
              this.setState({
                kind: "building",
                ctx: input.ctx,
                curator: input.curator,
                progress,
              });
            },
          },
        );
        if (this.controller !== controller) return;
        this.controller = undefined;
        this.pendingBuildInput = undefined;
        this.setState({
          kind: "done",
          result,
          ctx: input.ctx,
          curator: input.curator,
        });
        // Successful build → wipe the in-flight draft. Best-effort.
        void deleteDraft(getAppDataPath(), "build", this.draftId);
      } catch (err) {
        if (this.controller !== controller) return;
        this.controller = undefined;
        this.pendingBuildInput = undefined;
        if (isAbortError(err)) {
          // Cancellation rewinds to the form so the curator can
          // tweak and try again — the autosaved draft is untouched.
          this.setState(formSnapshot);
          return;
        }
        this.setState({
          kind: "error",
          record: {
            errorId: ++this.errorSeq,
            error: err,
            phase: "build",
          },
          formSnapshot,
        });
      } finally {
        // Always free the build slot so queued sessions can be
        // promoted. Safe to call multiple times — the registry
        // ignores releases from sessions that don't own the slot.
        this.hooks.releaseBuild(this);
      }
    })();
  }

  cancelBuilding(): void {
    if (this.state.kind === "queued") {
      // Bail out before we ever acquired the slot. Rewinds to form
      // and leaves the active builder undisturbed.
      this.hooks.cancelQueued(this);
      const input = this.pendingBuildInput;
      this.pendingBuildInput = undefined;
      this.setState({
        kind: "form",
        ctx: this.state.ctx,
        curator: this.state.curator,
        overrides: this.state.overrides,
        readme: this.state.readme,
        changelog: this.state.changelog,
        verificationLevel: this.state.verificationLevel,
      });
      void input; // silence unused
      return;
    }
    if (this.state.kind !== "building") return;
    this.controller?.abort();
  }

  /**
   * Move out of `done` / `error` back to `idle`. Called by:
   *   • "Build another" on the success card
   *   • "Go home" / "Retry" on the error card (retry then calls begin())
   */
  reset(): void {
    this.controller?.abort();
    this.controller = undefined;
    this.setState({ kind: "idle" });
  }

  // ── Internals ────────────────────────────────────────────────────

  private setState(next: BuildSessionState): void {
    this.state = next;
    for (const listener of this.listeners) {
      try {
        listener(next);
      } catch {
        /* one bad subscriber must not poison the others */
      }
    }
    // Fan out to the registry so dashboard subscribers re-render
    // AND so the registry can recompute the global `buildBusy`
    // runtime flag as the OR across every live session.
    //
    // The flag is owned by the registry (not this session) because
    // it's a true global: with parallel drafts, session A going
    // idle/form/done must not clear `buildBusy` while session B is
    // still loading/queued/building. Letting the registry compute
    // it is the only place with the full picture.
    this.hooks.notifyStateChanged(this);
  }
}

/**
 * Class export — the registry constructs instances directly. There
 * is no module-scope singleton anymore (Track 1: parallel drafts);
 * use {@link getBuildSessionRegistry} from `buildSessionRegistry.ts`
 * to get or create per-draft sessions.
 */
export { BuildSession };

// ───────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────

/**
 * True when an error came from an AbortController.abort() chain —
 * either via our own AbortError (see core/archiveHashing) or a
 * DOMException thrown by the underlying browser/Electron APIs.
 *
 * Mirrored from the BuildPage component because the session needs
 * the same predicate without importing UI code.
 */
function isAbortError(err: unknown): boolean {
  if (err instanceof AbortError) return true;
  if (err instanceof Error) {
    if (err.name === "AbortError") return true;
    const message = err.message ?? "";
    if (message.toLowerCase().includes("cancelled")) return true;
  }
  return false;
}

export { isAbortError };
