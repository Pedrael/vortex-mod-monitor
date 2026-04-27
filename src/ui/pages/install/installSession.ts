/**
 * InstallSession — module-scope state machine for the install wizard.
 *
 * Why this exists: same bug we hit on the build side. Vortex remounts
 * main pages on every tab switch, so the install wizard's React-local
 * `useReducer` + `loadAbortRef` were silently aborting and resetting
 * the user's hashing pipeline whenever they peeked at another tab.
 * Worse, the long `installing` phase (which has no abort affordance)
 * would keep running orphaned with no UI handle, so a return to the
 * tab could double-trigger.
 *
 * Hoisting the state into a module-level singleton keeps:
 *   • Hashing alive in the background while the user looks at other
 *     parts of Vortex; tab switch back picks the live state right up.
 *   • `installing` in flight without a stale React cleanup killing
 *     its reference. The component that comes back in just observes
 *     a "still installing" snapshot and renders progress.
 *
 * Pairs with `BuildSession` (same shape, same lifecycle rules). Read
 * `buildSession.ts` for the design rationale; this file mirrors it.
 *
 * What's different from BuildSession:
 *   • Decisions / conflicts / orphans live mid-flow, so the public
 *     API has more methods (one per user-visible interaction).
 *   • There is intentionally NO AbortController for the `installing`
 *     phase: the install driver mutates Vortex state (mods/, downloads,
 *     deployment) and aborting in the middle would leave it in a
 *     half-applied state. The driver is therefore non-cancellable
 *     after the user clicks Install on the confirm step. We surface
 *     that contract to the UI so users aren't shown a fake "Cancel"
 *     button during installing.
 */

import type { types } from "vortex-api";

import { AbortError } from "../../../core/archiveHashing";
import { runInstall } from "../../../core/installer/runInstall";
import { getEHRuntime } from "../../runtime/ehRuntime";
import {
  formatError,
  type FormattedError,
} from "../../errors";
import {
  runLoadingPipeline,
  runLoadingPipelineWithReceipt,
} from "./engine";
import type { ConflictChoice, OrphanChoice } from "../../../types/installDriver";
import {
  fillDefaultConflictChoices,
  fillDefaultOrphanChoices,
  initialWizardState,
  wizardReducer,
  type WizardAction,
  type WizardState,
} from "./state";

// ───────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────

/**
 * What subscribers see. We expose `errorSeq` separately from the
 * wizard state so the React layer can fire `reportError` exactly once
 * per failure, even when the component remounts into an already-errored
 * session and re-runs the toast / modal effect.
 */
export interface InstallSessionSnapshot {
  state: WizardState;
  errorSeq: number;
}

export type InstallSessionListener = (snapshot: InstallSessionSnapshot) => void;

export type StaleReceiptResolution = "delete" | "keep" | "cancel";

// ───────────────────────────────────────────────────────────────────────
// Implementation
// ───────────────────────────────────────────────────────────────────────

class InstallSession {
  private state: WizardState = initialWizardState;
  private errorSeq = 0;
  private readonly listeners = new Set<InstallSessionListener>();

  /** Active controller for the loading pipeline (and stale-resume). */
  private loadingController: AbortController | undefined;
  /**
   * Set true while runInstall is in flight. Used to reject re-entry
   * from a duplicate "Install" click on a remounted component.
   */
  private installInFlight = false;

  getSnapshot(): InstallSessionSnapshot {
    return { state: this.state, errorSeq: this.errorSeq };
  }

  subscribe(listener: InstallSessionListener): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  // ── Phase: pick → loading ────────────────────────────────────────

  /**
   * User picked a `.ehcoll` file. Aborts any previous in-flight load
   * (e.g. the user picked a different file mid-stream) and kicks off
   * the loading pipeline. Hashing progress is reported via state
   * mutations; subscribers re-render automatically.
   */
  pickFile(api: types.IExtensionApi, zipPath: string): void {
    // Replace any existing controller — if the user picked one file,
    // looked at another tab while it hashed, came back and picked a
    // different file, we want the second pick to win.
    this.loadingController?.abort();
    const controller = new AbortController();
    this.loadingController = controller;

    this.dispatch({ type: "pick-file", zipPath });

    void (async (): Promise<void> => {
      try {
        const outcome = await runLoadingPipeline({
          api,
          zipPath,
          signal: controller.signal,
          events: {
            onPhase: (phase, hashCount): void => {
              if (this.loadingController !== controller) return;
              this.dispatch({ type: "loading-phase", phase, hashCount });
            },
            onHashProgress: (done, total, currentItem): void => {
              if (this.loadingController !== controller) return;
              this.dispatch({
                type: "hash-progress",
                done,
                total,
                currentItem,
              });
            },
          },
        });
        if (this.loadingController !== controller) return;
        this.loadingController = undefined;

        if (outcome.kind === "stale-receipt") {
          this.dispatch({
            type: "needs-stale-resolution",
            zipPath,
            ehcoll: outcome.ehcoll,
            receipt: outcome.receipt,
            appDataPath: outcome.appDataPath,
          });
          return;
        }

        this.dispatch({
          type: "plan-ready",
          bundle: {
            zipPath,
            ehcoll: outcome.ehcoll,
            receipt: outcome.receipt,
            plan: outcome.plan,
            appDataPath: outcome.appDataPath,
          },
        });
      } catch (err) {
        if (this.loadingController !== controller) return;
        this.loadingController = undefined;
        if (isAbortError(err)) {
          // User-initiated cancel. Send them back to the picker with
          // no error modal — they know what they did.
          this.dispatch({ type: "reset" });
          return;
        }
        this.failWith(err, {
          title: "Couldn't prepare the install",
          context: { step: "loading", zipPath },
        });
      }
    })();
  }

  cancelLoading(): void {
    if (this.state.kind !== "loading") return;
    this.loadingController?.abort();
  }

  // ── Phase: stale-receipt → resume loading ────────────────────────

  /**
   * Resolve a stale-receipt prompt. `keep` and `delete` re-run the
   * second half of the loading pipeline with an explicit receipt
   * choice. `cancel` returns the user to the picker.
   */
  resolveStaleReceipt(
    api: types.IExtensionApi,
    choice: StaleReceiptResolution,
  ): void {
    if (this.state.kind !== "stale-receipt") return;
    if (choice === "cancel") {
      this.dispatch({ type: "reset" });
      return;
    }

    const carry = this.state;
    this.loadingController?.abort();
    const controller = new AbortController();
    this.loadingController = controller;

    // Visual: drop back into the loading skeleton — we're about to
    // re-run the resolver with the user's choice baked in.
    this.dispatch({ type: "pick-file", zipPath: carry.zipPath });

    void (async (): Promise<void> => {
      try {
        const outcome = await runLoadingPipelineWithReceipt({
          api,
          zipPath: carry.zipPath,
          ehcoll: carry.ehcoll,
          receipt: choice === "keep" ? carry.receipt : undefined,
          appDataPath: carry.appDataPath,
          events: {
            onPhase: (phase, hashCount): void => {
              if (this.loadingController !== controller) return;
              this.dispatch({ type: "loading-phase", phase, hashCount });
            },
            onHashProgress: (done, total, currentItem): void => {
              if (this.loadingController !== controller) return;
              this.dispatch({
                type: "hash-progress",
                done,
                total,
                currentItem,
              });
            },
          },
        });
        if (this.loadingController !== controller) return;
        this.loadingController = undefined;
        this.dispatch({
          type: "plan-ready",
          bundle: {
            zipPath: carry.zipPath,
            ehcoll: outcome.ehcoll,
            receipt: outcome.receipt,
            plan: outcome.plan,
            appDataPath: outcome.appDataPath,
          },
        });
      } catch (err) {
        if (this.loadingController !== controller) return;
        this.loadingController = undefined;
        if (isAbortError(err)) {
          this.dispatch({ type: "reset" });
          return;
        }
        this.failWith(err, {
          title: "Couldn't prepare the install",
          context: { step: "stale-resume", zipPath: carry.zipPath },
        });
      }
    })();
  }

  // ── Phase: preview → decisions → confirm ─────────────────────────

  /**
   * preview → decisions. Conflict and orphan choices start empty;
   * defaults are applied lazily on `openConfirm`.
   */
  openDecisionsFromPreview(): void {
    if (this.state.kind !== "preview") return;
    this.dispatch({
      type: "open-decisions",
      bundle: this.state.bundle,
      conflictChoices: {},
      orphanChoices: {},
    });
  }

  setConflictChoice(compareKey: string, choice: ConflictChoice): void {
    this.dispatch({ type: "set-conflict-choice", compareKey, choice });
  }

  setOrphanChoice(modId: string, choice: OrphanChoice): void {
    this.dispatch({ type: "set-orphan-choice", modId, choice });
  }

  backToPreview(): void {
    this.dispatch({ type: "back-to-preview" });
  }

  /**
   * decisions → confirm. Defaults are filled for any choice the user
   * didn't explicitly resolve so the confirm step shows the exact
   * decisions that will be applied.
   */
  openConfirm(): void {
    if (this.state.kind !== "decisions") return;
    const filledConflicts = fillDefaultConflictChoices(
      this.state.bundle,
      this.state.conflictChoices,
    );
    const filledOrphans = fillDefaultOrphanChoices(
      this.state.bundle,
      this.state.orphanChoices,
    );
    this.dispatch({
      type: "open-confirm",
      decisions: {
        conflictChoices: filledConflicts,
        orphanChoices: filledOrphans,
      },
    });
  }

  backFromConfirm(): void {
    this.dispatch({ type: "back-from-confirm" });
  }

  // ── Phase: confirm → installing → done ───────────────────────────

  /**
   * Kick off the install driver. Non-cancellable by design — the
   * driver mutates Vortex state and aborting partway would leave a
   * mess. We DO survive a remount: the component that comes back in
   * just observes the live progress.
   */
  startInstall(api: types.IExtensionApi): void {
    if (this.state.kind !== "confirm") return;
    if (this.installInFlight) return;
    this.installInFlight = true;
    const startState = this.state;

    this.dispatch({ type: "start-install" });

    void (async (): Promise<void> => {
      try {
        const result = await runInstall({
          api,
          plan: startState.bundle.plan,
          ehcoll: startState.bundle.ehcoll,
          ehcollZipPath: startState.bundle.zipPath,
          appDataPath: startState.bundle.appDataPath,
          decisions: startState.decisions,
          onProgress: (progress): void => {
            // Late progress events from a session that's already
            // moved on (e.g. user clicked "Start over" mid-install,
            // which we technically don't allow but be defensive).
            if (this.state.kind !== "installing") return;
            this.dispatch({ type: "install-progress", progress });
          },
        });
        this.installInFlight = false;
        if (this.state.kind !== "installing") return;
        this.dispatch({ type: "install-result", result });
      } catch (err) {
        this.installInFlight = false;
        this.failWith(err, {
          title: "Install driver crashed",
          context: {
            step: "installing",
            packageId: startState.bundle.plan.manifest.package.id,
          },
        });
      }
    })();
  }

  // ── Phase: any → reset ───────────────────────────────────────────

  /**
   * Bounce back to the picker. Aborts any in-flight load (install
   * is intentionally non-abortable; if installing is in flight, the
   * caller should disable the reset button).
   */
  reset(): void {
    this.loadingController?.abort();
    this.loadingController = undefined;
    this.dispatch({ type: "reset" });
  }

  /**
   * After Vortex did its profile-switch dance: bring the wizard back
   * to picker so the user can install another collection. Same as
   * `reset` except semantically "I'm done" rather than "abandon".
   */
  finish(): void {
    this.dispatch({ type: "reset" });
  }

  // ── Internals ────────────────────────────────────────────────────

  private dispatch(action: WizardAction): void {
    const next = wizardReducer(this.state, action);
    if (next === this.state) return;
    if (action.type === "set-error") {
      this.errorSeq += 1;
    }
    this.state = next;
    this.notify();
  }

  /**
   * Wrap an unknown error into a {@link FormattedError} and route it
   * into the error state. Bumps `errorSeq` so the UI's "report once"
   * effect fires for this specific failure.
   */
  private failWith(
    err: unknown,
    opts: {
      title: string;
      context: Record<string, string | number | boolean | undefined | null>;
    },
  ): void {
    const formatted: FormattedError = formatError(err, opts);
    this.dispatch({ type: "set-error", error: formatted });
  }

  private notify(): void {
    // Mirror "is the wizard touching Vortex right now?" into the
    // runtime so the build page can warn about concurrent ops.
    // `loading` does archive hashing, `installing` mutates Vortex
    // state. Picker / preview / decisions / confirm / done / error
    // are all user-thinking states with no in-flight side effects.
    const busy =
      this.state.kind === "loading" || this.state.kind === "installing";
    getEHRuntime().setInstallBusy(busy);

    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snap);
      } catch {
        /* one bad subscriber must not poison the others */
      }
    }
  }
}

// Module-scope singleton. Survives component remounts; dies with the
// JS heap on Vortex restart (downloads / receipts on disk are the
// durable layer for that case).
let singleton: InstallSession | undefined;

export function getInstallSession(): InstallSession {
  if (singleton === undefined) singleton = new InstallSession();
  return singleton;
}

// ───────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────

/**
 * True when an error came from an AbortController.abort() chain.
 * Mirrors the helper in `BuildSession`.
 */
export function isAbortError(err: unknown): boolean {
  if (err instanceof AbortError) return true;
  if (err instanceof Error) {
    if (err.name === "AbortError") return true;
    const message = err.message ?? "";
    if (message.toLowerCase().includes("cancelled")) return true;
  }
  return false;
}
