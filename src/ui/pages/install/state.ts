/**
 * Install wizard state machine — single source of truth for what
 * the InstallPage is showing and which async work is in flight.
 *
 * State transitions form a strict graph:
 *
 *   pick → loading → (stale-receipt) → planning → preview
 *                                                  ↓
 *                                          decisions ↔ preview
 *                                                  ↓
 *                                              confirm
 *                                                  ↓
 *                                            installing
 *                                                  ↓
 *                                                done
 *
 * Any state can transition to `pick` via "Start over" (resets) or
 * `error` via a thrown error caught by the wizard's effect runner.
 *
 * Data carried in each state is exactly what the next step needs to
 * render — we never reach into "what was the previous state's data?"
 * which keeps the reducer pure and the steps pure-presentational.
 */

import type { types } from "vortex-api";
import type { ReadEhcollResult } from "../../../core/manifest/readEhcoll";
import type { InstallReceipt } from "../../../types/installLedger";
import type {
  ConflictChoice,
  DriverProgress,
  InstallResult,
  OrphanChoice,
  UserConfirmedDecisions,
} from "../../../types/installDriver";
import type { InstallPlan } from "../../../types/installPlan";
import type { FormattedError } from "../../errors";

// ===========================================================================
// State
// ===========================================================================

export type LoadingPhase =
  | "reading-package"
  | "reading-receipt"
  | "checking-game"
  | "hashing-mods"
  | "hashing-staging"
  | "resolving-plan";

export interface PreviewBundle {
  zipPath: string;
  ehcoll: ReadEhcollResult;
  /**
   * The receipt that came in (if any). When this is `undefined` the
   * resolver picked fresh-profile mode automatically. When set, the
   * user MAY have explicitly chosen to keep the stale receipt.
   */
  receipt: InstallReceipt | undefined;
  plan: InstallPlan;
  /**
   * Same `appData` value used to resolve receipts; carried so the
   * driver call site doesn't have to re-derive it.
   */
  appDataPath: string;
}

export type WizardState =
  | { kind: "pick" }
  | {
      kind: "loading";
      zipPath: string;
      phase: LoadingPhase;
      /** Total mods that will be hashed in the hashing-mods phase. */
      hashCount?: number;
      /** Live counter — number of archives that have completed hashing. */
      hashDone?: number;
      /** Name of the mod whose archive is being hashed right now. */
      hashCurrent?: string;
    }
  | {
      kind: "stale-receipt";
      zipPath: string;
      ehcoll: ReadEhcollResult;
      receipt: InstallReceipt;
      appDataPath: string;
    }
  | {
      kind: "preview";
      bundle: PreviewBundle;
    }
  | {
      kind: "decisions";
      bundle: PreviewBundle;
      conflictChoices: Record<string, ConflictChoice>;
      orphanChoices: Record<string, OrphanChoice>;
    }
  | {
      kind: "confirm";
      bundle: PreviewBundle;
      decisions: UserConfirmedDecisions;
    }
  | {
      kind: "installing";
      bundle: PreviewBundle;
      decisions: UserConfirmedDecisions;
      progress: DriverProgress | undefined;
    }
  | {
      kind: "done";
      result: InstallResult;
      bundle: PreviewBundle;
    }
  | {
      kind: "error";
      error: FormattedError;
      previous: WizardState;
    };

export const initialWizardState: WizardState = { kind: "pick" };

// ===========================================================================
// Actions
// ===========================================================================

export type WizardAction =
  | { type: "pick-file"; zipPath: string }
  | { type: "loading-phase"; phase: LoadingPhase; hashCount?: number }
  | {
      type: "hash-progress";
      done: number;
      total: number;
      currentItem: string;
    }
  | {
      type: "needs-stale-resolution";
      zipPath: string;
      ehcoll: ReadEhcollResult;
      receipt: InstallReceipt;
      appDataPath: string;
    }
  | {
      type: "plan-ready";
      bundle: PreviewBundle;
    }
  | {
      type: "open-decisions";
      bundle: PreviewBundle;
      conflictChoices: Record<string, ConflictChoice>;
      orphanChoices: Record<string, OrphanChoice>;
    }
  | {
      type: "set-conflict-choice";
      compareKey: string;
      choice: ConflictChoice;
    }
  | {
      type: "set-orphan-choice";
      modId: string;
      choice: OrphanChoice;
    }
  | { type: "back-to-preview" }
  | {
      type: "open-confirm";
      decisions: UserConfirmedDecisions;
    }
  | { type: "back-from-confirm" }
  | { type: "start-install" }
  | { type: "install-progress"; progress: DriverProgress }
  | { type: "install-result"; result: InstallResult }
  | { type: "set-error"; error: FormattedError }
  | { type: "reset" };

// ===========================================================================
// Reducer
// ===========================================================================

export function wizardReducer(
  state: WizardState,
  action: WizardAction,
): WizardState {
  switch (action.type) {
    case "pick-file":
      return {
        kind: "loading",
        zipPath: action.zipPath,
        phase: "reading-package",
      };
    case "loading-phase": {
      if (state.kind !== "loading") return state;
      const isHashingPhase =
        action.phase === "hashing-mods" || action.phase === "hashing-staging";
      // The two hashing phases share a UI card with a live counter.
      // Reset progress on every phase transition (incl. mods → staging)
      // so the counter doesn't show stale numbers from the previous
      // phase. Non-hashing phases drop the counter entirely.
      return {
        ...state,
        phase: action.phase,
        hashCount: action.hashCount ?? (isHashingPhase ? 0 : state.hashCount),
        hashDone: isHashingPhase ? 0 : undefined,
        hashCurrent: isHashingPhase ? undefined : undefined,
      };
    }
    case "hash-progress":
      if (state.kind !== "loading") return state;
      // Don't override the current phase — the engine can be in
      // either "hashing-mods" or "hashing-staging" and both fire
      // hash-progress events.
      return {
        ...state,
        hashCount: action.total,
        hashDone: action.done,
        hashCurrent: action.currentItem,
      };
    case "needs-stale-resolution":
      return {
        kind: "stale-receipt",
        zipPath: action.zipPath,
        ehcoll: action.ehcoll,
        receipt: action.receipt,
        appDataPath: action.appDataPath,
      };
    case "plan-ready":
      return { kind: "preview", bundle: action.bundle };
    case "open-decisions":
      return {
        kind: "decisions",
        bundle: action.bundle,
        conflictChoices: action.conflictChoices,
        orphanChoices: action.orphanChoices,
      };
    case "set-conflict-choice": {
      if (state.kind !== "decisions") return state;
      return {
        ...state,
        conflictChoices: {
          ...state.conflictChoices,
          [action.compareKey]: action.choice,
        },
      };
    }
    case "set-orphan-choice": {
      if (state.kind !== "decisions") return state;
      return {
        ...state,
        orphanChoices: {
          ...state.orphanChoices,
          [action.modId]: action.choice,
        },
      };
    }
    case "back-to-preview": {
      if (state.kind === "decisions" || state.kind === "confirm") {
        return { kind: "preview", bundle: state.bundle };
      }
      return state;
    }
    case "open-confirm": {
      if (state.kind !== "decisions" && state.kind !== "preview") return state;
      return {
        kind: "confirm",
        bundle: state.bundle,
        decisions: action.decisions,
      };
    }
    case "back-from-confirm": {
      if (state.kind !== "confirm") return state;
      return {
        kind: "decisions",
        bundle: state.bundle,
        conflictChoices: state.decisions.conflictChoices ?? {},
        orphanChoices: state.decisions.orphanChoices ?? {},
      };
    }
    case "start-install": {
      if (state.kind !== "confirm") return state;
      return {
        kind: "installing",
        bundle: state.bundle,
        decisions: state.decisions,
        progress: undefined,
      };
    }
    case "install-progress": {
      if (state.kind !== "installing") return state;
      return { ...state, progress: action.progress };
    }
    case "install-result": {
      if (state.kind !== "installing") return state;
      return {
        kind: "done",
        result: action.result,
        bundle: state.bundle,
      };
    }
    case "set-error":
      return { kind: "error", error: action.error, previous: state };
    case "reset":
      return { kind: "pick" };
    default: {
      const exhaustive: never = action;
      void exhaustive;
      return state;
    }
  }
}

// ===========================================================================
// Helpers used by the steps to derive sub-lists from a plan
// ===========================================================================

export function selectConflictResolutions(
  bundle: PreviewBundle,
): InstallPlan["modResolutions"] {
  return bundle.plan.modResolutions.filter((r) => {
    const k = r.decision.kind;
    return (
      k === "nexus-version-diverged" ||
      k === "nexus-bytes-diverged" ||
      k === "external-bytes-diverged" ||
      k === "external-prompt-user"
    );
  });
}

export function defaultConflictChoice(
  resolution: InstallPlan["modResolutions"][number],
): ConflictChoice | undefined {
  // Sensible defaults: keep existing for divergences (least
  // destructive) and "no choice yet" for prompt-user (we want them
  // to actively pick).
  switch (resolution.decision.kind) {
    case "nexus-version-diverged":
    case "nexus-bytes-diverged":
    case "external-bytes-diverged":
      return { kind: "keep-existing" };
    case "external-prompt-user":
      return undefined;
    default:
      return undefined;
  }
}

export function defaultOrphanChoice(): OrphanChoice {
  return { kind: "keep" };
}

/**
 * Resolves the user's choice for a single conflict. Returns
 * `undefined` if the user hasn't picked one yet AND the resolution
 * doesn't have a sensible default — we use this to gate the
 * "Continue" button.
 */
export function buildUserConfirmedDecisions(
  conflictChoices: Record<string, ConflictChoice>,
  orphanChoices: Record<string, OrphanChoice>,
): UserConfirmedDecisions {
  return { conflictChoices, orphanChoices };
}

/**
 * Helper that the InstallPage uses to figure out whether the
 * "Continue" button is enabled. A decision is "complete" when:
 *   - every conflict has either a stored choice or a sensible default;
 *   - every orphan has a choice (default: keep).
 */
export function canProceedFromDecisions(
  bundle: PreviewBundle,
  conflictChoices: Record<string, ConflictChoice>,
): boolean {
  for (const r of selectConflictResolutions(bundle)) {
    const supplied = conflictChoices[r.compareKey];
    if (supplied !== undefined) continue;
    const fallback = defaultConflictChoice(r);
    if (fallback === undefined) return false;
  }
  return true;
}

/**
 * Apply defaults for any conflict the user didn't explicitly resolve.
 * Used when transitioning from `decisions` to `confirm`.
 */
export function fillDefaultConflictChoices(
  bundle: PreviewBundle,
  conflictChoices: Record<string, ConflictChoice>,
): Record<string, ConflictChoice> {
  const out: Record<string, ConflictChoice> = { ...conflictChoices };
  for (const r of selectConflictResolutions(bundle)) {
    if (out[r.compareKey] !== undefined) continue;
    const fallback = defaultConflictChoice(r);
    if (fallback !== undefined) out[r.compareKey] = fallback;
  }
  return out;
}

/**
 * Apply defaults for any orphan the user didn't explicitly resolve.
 */
export function fillDefaultOrphanChoices(
  bundle: PreviewBundle,
  orphanChoices: Record<string, OrphanChoice>,
): Record<string, OrphanChoice> {
  const out: Record<string, OrphanChoice> = { ...orphanChoices };
  for (const o of bundle.plan.orphanedMods) {
    if (out[o.existingModId] !== undefined) continue;
    out[o.existingModId] = defaultOrphanChoice();
  }
  return out;
}

/**
 * Read-only sanity assertion. The "Install" button on the confirm
 * step must run this and refuse to start if it returns false — keeps
 * the driver's preflight assertion from blowing up midway.
 */
export function planHasHardBlockers(
  api: types.IExtensionApi | undefined,
  plan: InstallPlan,
): boolean {
  void api;
  for (const r of plan.modResolutions) {
    if (
      r.decision.kind === "nexus-unreachable" ||
      r.decision.kind === "external-missing"
    ) {
      return true;
    }
  }
  return false;
}
