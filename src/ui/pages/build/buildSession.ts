/**
 * BuildSession — module-scope state machine for the curator build flow.
 *
 * Vortex's main pages mount/unmount whenever the user clicks between
 * sidebar tabs. Holding the in-flight `loadBuildContext` /
 * `runBuildPipeline` promises and their AbortControllers in React
 * component state means a tab switch silently aborts and restarts the
 * pipeline — the bug we hit in 0.0.1. Hoisting them to a module-level
 * singleton keeps the work alive in the background and lets the UI
 * just subscribe to the current snapshot whenever it (re)mounts.
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
 * Lifecycle:
 *   idle  ──begin──► loading ──hashed──► form ──build──► building ──ok──► done
 *      ▲                │                  │                │
 *      └──reset/cancel──┴───errors─────────┴────────────────┘
 *
 * Cancellation:
 *   • cancelLoading() and cancelBuilding() both flip the same
 *     AbortController owned by the session. The engine's AbortError
 *     is caught here and lowered into the appropriate "previous"
 *     state (loading → idle, building → form).
 *
 * Error reporting:
 *   • On failure, state becomes { kind: "error", error, errorId }.
 *     `errorId` is a fresh symbol-keyed bigint per failure so the
 *     React layer can de-duplicate "I already opened the modal for
 *     this exact failure" without leaking the raw error around.
 *
 * Drafts:
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
 *   • The singleton lives only for the JS heap's lifetime, so any
 *     in-flight build is lost on a Vortex restart. That's fine —
 *     the on-disk draft (`core/draftStorage`) covers cold restarts;
 *     the singleton covers warm tab switches.
 */

import type { types } from "vortex-api";

import { AbortError } from "../../../core/archiveHashing";
import {
  deleteDraft,
  getAppDataPath,
  loadDraft,
} from "../../../core/draftStorage";
import type { ExternalModConfigEntry } from "../../../core/manifest/collectionConfig";
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
 */
export interface BuildDraftPayload {
  curator: CuratorInput;
  overrides: Record<string, ExternalModConfigEntry>;
  readme: string;
  changelog: string;
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
      validationError?: string;
      /**
       * ISO timestamp of the autosaved draft we restored from.
       * `undefined` after the user dismisses the banner or chooses
       * "Discard draft". Autosave keeps running independently.
       */
      restoredAt?: string;
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
}

// ───────────────────────────────────────────────────────────────────────
// Implementation
// ───────────────────────────────────────────────────────────────────────

class BuildSession {
  private state: BuildSessionState = { kind: "idle" };
  private readonly listeners = new Set<BuildSessionListener>();
  /** Active AbortController for whichever async pass is in flight. */
  private controller: AbortController | undefined;
  /** Monotonic counter so each error gets a fresh `errorId`. */
  private errorSeq = 0;

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
   * Drop any restored values, wipe the draft on disk, and reset the
   * form to the values derived from the active collection config
   * (everything still loaded in `ctx`).
   */
  async discardDraft(): Promise<void> {
    if (this.state.kind !== "form") return;
    const { ctx } = this.state;
    void deleteDraft(getAppDataPath(), "build", ctx.gameId);
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
        };

        let envelope: Awaited<
          ReturnType<typeof loadDraft<BuildDraftPayload>>
        > = undefined;
        try {
          envelope = await loadDraft<BuildDraftPayload>(
            getAppDataPath(),
            "build",
            ctx.gameId,
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
   * form → building. Snapshots the form, runs the pipeline, and
   * persists the on-disk draft (deleted on success, kept on failure).
   *
   * Caller is responsible for validating `input.curator` first (so
   * the page can show validation errors inline) — the session only
   * runs the engine.
   */
  build(api: types.IExtensionApi, input: BuildAttemptInput): void {
    if (this.state.kind !== "form") return;
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
        this.setState({
          kind: "done",
          result,
          ctx: input.ctx,
          curator: input.curator,
        });
        // Successful build → wipe the in-flight draft. Best-effort.
        void deleteDraft(getAppDataPath(), "build", input.ctx.gameId);
      } catch (err) {
        if (this.controller !== controller) return;
        this.controller = undefined;
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
      }
    })();
  }

  cancelBuilding(): void {
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
  }
}

// Module-scope singleton. Created lazily on first import.
let singleton: BuildSession | undefined;

/**
 * Lazily-instantiated singleton. The state machine survives:
 *   • component remounts (sidebar tab switches) — listeners just
 *     drop and re-subscribe;
 *   • route changes within the EH page — same;
 *   • DOES NOT survive a Vortex restart — that's covered by the
 *     on-disk draft (`core/draftStorage`).
 */
export function getBuildSession(): BuildSession {
  if (singleton === undefined) singleton = new BuildSession();
  return singleton;
}

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
