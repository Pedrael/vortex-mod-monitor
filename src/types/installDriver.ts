/**
 * Install-driver runtime contracts (Phase 3 slice 6).
 *
 * The driver consumes an `InstallPlan` (pure description) and a set of
 * user-confirmed decisions, then mutates the user's machine: creates
 * profiles, downloads mods, installs archives, writes `plugins.txt`,
 * deploys, writes the install ledger receipt.
 *
 * This file is **type-only**. The runtime lives under `src/core/installer/`.
 *
 * Spec: docs/business/INSTALL_DRIVER.md
 *
 * ─── DESIGN ────────────────────────────────────────────────────────────
 * Three rules govern this contract:
 *
 * 1. **Driver is a black-box state machine.** It progresses through a
 *    fixed sequence of phases (see {@link DriverPhase}). The action
 *    handler subscribes to {@link DriverProgress} and renders progress;
 *    it does NOT branch on phases for control flow.
 *
 * 2. **User choices are passed in, not collected by the driver.** The
 *    driver never opens dialogs. {@link UserConfirmedDecisions} is the
 *    full set of "what to do for ambiguous cases" the action handler
 *    has already resolved. Slice 6a's contract is empty (fresh-profile
 *    mode resolves everything cleanly); slice 6b populates it.
 *
 * 3. **Idempotency-on-restart, not idempotency-on-rerun.** A driver run
 *    aborted mid-way leaves a partial profile that the user can re-run
 *    against. The driver does NOT roll back. Slice 6a documents this
 *    via {@link InstallResult.kind === "failed"} carrying the partial
 *    profile id; the user can switch to it manually and inspect.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { ReadEhcollResult } from "../core/manifest/readEhcoll";
import type { InstallPlan } from "./installPlan";

// ===========================================================================
// User-confirmed decisions (input alongside the plan)
// ===========================================================================

/**
 * Choices the user has made about ambiguous situations. The driver
 * does NOT prompt; it consumes already-resolved decisions.
 *
 * **Slice 6a** (fresh-profile happy path): both fields are absent or
 * empty. The resolver collapses every diverged decision in
 * fresh-profile mode, and orphan detection is a no-op there.
 *
 * **Slice 6b** (current-profile mode + manual review): the action
 * handler builds two maps:
 *  - {@link conflictChoices} keyed by `ModResolution.compareKey` for
 *    every `*-version-diverged`, `*-bytes-diverged`, and
 *    `external-prompt-user` mod the resolver flagged as needing user
 *    input. Missing keys are an error (the driver refuses to run).
 *  - {@link orphanChoices} keyed by `OrphanedModDecision.existingModId`
 *    for every orphan. Missing keys default to `"keep"` (the safe
 *    no-op).
 *
 * Forward compatibility: the shape is additive. Slice 6c may add
 * more fields without breaking 6b consumers.
 */
export type UserConfirmedDecisions = {
  /**
   * Per-mod conflict resolutions, keyed by the manifest's
   * `compareKey` (mirrored on `ModResolution.compareKey`). Required
   * for every `ModResolution` whose decision needs user input.
   */
  conflictChoices?: Record<string, ConflictChoice>;
  /**
   * Per-orphan resolutions, keyed by the orphan's
   * `existingModId` (Vortex mod id). Missing entries default to
   * `"keep"` — the safest behavior since "uninstall" is destructive.
   */
  orphanChoices?: Record<string, OrphanChoice>;
};

/**
 * What the user chose for a single ambiguous mod decision.
 *
 * Discriminated union so each kind carries only the data it needs:
 *  - `keep-existing`: skip the manifest's mod, leave the user's
 *    existing one untouched (but enable it in the install profile).
 *    Valid for any `*-diverged` decision.
 *  - `replace-existing`: uninstall the user's existing mod, install
 *    the manifest's version. Valid for any `*-diverged` decision.
 *  - `use-local-file`: install from a local archive path the user
 *    picked. Valid for `external-prompt-user` decisions only. The
 *    driver does NOT verify the SHA matches `expectedSha256` before
 *    installing — it trusts the user-supplied file. (A future slice
 *    may add re-prompt-on-mismatch; v1 trusts the picker.)
 *  - `skip`: do not install. Records a `SkippedModReportEntry`.
 *    Valid for `external-prompt-user` decisions only (a diverged mod
 *    "skip" would be ambiguous between "skip new install" and
 *    "remove existing"; we use `keep-existing` to be explicit).
 */
export type ConflictChoice =
  | { kind: "keep-existing" }
  | { kind: "replace-existing" }
  | { kind: "use-local-file"; localPath: string }
  | { kind: "skip" };

/**
 * What the user chose for a single orphaned-mod decision.
 *
 *  - `keep`: leave the mod alone. The user wants it independently
 *    of the collection. Default when no entry is supplied.
 *  - `uninstall`: remove the mod (file system + Vortex state) via
 *    `util.removeMods`. Destructive; only the action handler/UI
 *    should set this after explicit user confirmation.
 */
export type OrphanChoice =
  | { kind: "keep" }
  | { kind: "uninstall" };

// ===========================================================================
// Driver context (input bundle)
// ===========================================================================

/**
 * The full input the driver consumes. The action handler builds one
 * of these and hands it in.
 */
export type DriverContext = {
  /** Vortex API. The driver dispatches actions and emits events through it. */
  api: import("vortex-api").types.IExtensionApi;
  /** The fully-resolved plan from `resolveInstallPlan`. */
  plan: InstallPlan;
  /** Result of `readEhcoll` — needed for bundled archive metadata. */
  ehcoll: ReadEhcollResult;
  /**
   * Absolute path of the `.ehcoll` ZIP file on disk. The driver
   * reads bundled archives out of it on demand. Distinct from
   * {@link ehcoll} because `ReadEhcollResult` doesn't carry it.
   */
  ehcollZipPath: string;
  /** Absolute path of `util.getVortexPath("appData")`. Used for the receipt. */
  appDataPath: string;
  /** User's pre-resolved choices. Slice 6a: always empty. */
  decisions: UserConfirmedDecisions;
  /**
   * Optional progress callback. Called many times per phase. The
   * action handler usually maps it onto a Vortex notification.
   */
  onProgress?: (progress: DriverProgress) => void;
  /**
   * Optional cooperative cancellation. The driver checks this at
   * phase boundaries — it does NOT interrupt in-flight Vortex
   * operations (downloads can't be safely killed mid-stream).
   */
  abortSignal?: AbortSignal;
};

// ===========================================================================
// Phases & progress
// ===========================================================================

/**
 * Coarse-grained driver state. Surfaced for UI/logging only; the
 * action handler does NOT branch on this for control flow.
 *
 * Fresh-profile happy-path (slice 6a) progresses linearly:
 *
 *   preflight → creating-profile → switching-profile → installing-mods
 *   → writing-plugins-txt → deploying → writing-receipt → complete
 *
 * Current-profile mode (slice 6b) skips `creating-profile` and
 * `switching-profile` entirely (we install into the active profile)
 * and inserts a `removing-mods` phase between `preflight` and
 * `installing-mods`:
 *
 *   preflight → removing-mods → installing-mods → writing-plugins-txt
 *   → deploying → writing-receipt → complete
 *
 * `removing-mods` runs every replace-existing and orphan-uninstall
 * choice the user has confirmed. It is skipped when there's nothing
 * to remove.
 *
 * Failures emit `failed` with the phase that broke. `aborted` is
 * emitted on cooperative cancel via `abortSignal`.
 */
export type DriverPhase =
  | "preflight"
  | "creating-profile"
  | "switching-profile"
  | "removing-mods"
  | "installing-mods"
  | "writing-plugins-txt"
  | "deploying"
  | "writing-receipt"
  | "complete"
  | "aborted"
  | "failed";

/**
 * One progress beat. The driver emits these frequently inside the
 * `installing-mods` phase (one per mod) and sparingly elsewhere.
 *
 * `currentStep` / `totalSteps` are scoped to the **current phase**;
 * they reset every phase transition. This is a deliberate choice —
 * a global "0 of 47" counter is useless for the user (most steps
 * complete in milliseconds, while individual mod installs take
 * minutes).
 */
export type DriverProgress = {
  phase: DriverPhase;
  /** 1-indexed within the current phase; 0 ⇒ "starting." */
  currentStep: number;
  /** Total steps in the current phase, when known. */
  totalSteps: number;
  /** Plain-language description of the current step. UI-only. */
  message: string;
};

// ===========================================================================
// Result
// ===========================================================================

/**
 * The terminal value the driver returns. Always one of three kinds.
 * Errors and aborts carry enough context for the action handler to
 * surface a useful notification.
 */
export type InstallResult = InstallSuccess | InstallAborted | InstallFailed;

export type InstallSuccess = {
  kind: "success";
  /** Vortex profile id the install landed in. */
  profileId: string;
  /** Profile display name. UI-only. */
  profileName: string;
  /** Mode the driver actually ran in (mirrors plan.installTarget.kind). */
  installTargetMode: "fresh-profile" | "current-profile";
  /**
   * Absolute path of the receipt file that was written.
   * `<appData>/Vortex/event-horizon/installs/<package.id>.json`.
   */
  receiptPath: string;
  /** Vortex mod ids of every successfully-installed mod. */
  installedModIds: string[];
  /** Per-mod report — useful for the post-install summary. */
  installedMods: InstalledModReportEntry[];
  /**
   * Mods the driver couldn't install for non-fatal reasons (user
   * chose `keep-existing`, `skip`, or the decision required input
   * the action handler did not supply).
   */
  skippedMods: SkippedModReportEntry[];
  /**
   * Mods the driver removed during the `removing-mods` phase
   * (replace-existing diverged + orphan-uninstall choices).
   * Slice 6a: always empty (no removals in fresh-profile mode).
   */
  removedMods: RemovedModReportEntry[];
  /**
   * Mods the driver carried forward from the previous release into
   * the new receipt without re-installing them. Two sources, both
   * current-profile only:
   *
   *  - `*-diverged + keep-existing`: user chose to stick with their
   *    own version. The driver records the existing mod here, enables
   *    it in the active profile so the collection still gets the mod,
   *    and includes it in the new receipt with its original
   *    `installedFromVersion` lineage tag preserved.
   *  - `orphan + keep`: user chose to keep the orphaned mod from the
   *    previous release. The driver does NOT enable it (it was
   *    already in the user's setup) but DOES include it in the new
   *    receipt so future releases can still see its lineage.
   *
   * Without this, kept mods would silently lose their lineage tag on
   * the next release and become invisible to orphan detection. See
   * docs/business/INSTALL_DRIVER.md § "Carry-forward semantics".
   */
  carriedMods: CarriedModReportEntry[];
};

export type InstallAborted = {
  kind: "aborted";
  /** Phase the abort happened in. */
  phase: DriverPhase;
  /** Profile the driver had created at the time of abort, if any. */
  partialProfileId?: string;
  reason: string;
};

export type InstallFailed = {
  kind: "failed";
  /** Phase the failure happened in. */
  phase: DriverPhase;
  /** Profile the driver had created at the time of failure, if any. */
  partialProfileId?: string;
  /** One-line error summary. */
  error: string;
  /**
   * Mods that DID install successfully before the failure. The user
   * can switch to `partialProfileId` and see them; they are not
   * automatically removed.
   */
  installedSoFar: string[];
};

export type InstalledModReportEntry = {
  /** compareKey from the manifest entry. */
  compareKey: string;
  /** Display name. */
  name: string;
  /** Vortex mod id assigned at install time. */
  vortexModId: string;
  /** Source kind from the manifest. */
  source: "nexus" | "external";
  /**
   * The specific decision arm that produced this install. Useful for
   * the post-install summary ("3 from local cache, 12 from Nexus,
   * 2 from bundled archives").
   */
  fromDecision: string;
};

export type SkippedModReportEntry = {
  compareKey: string;
  name: string;
  /** Why the driver skipped this mod. */
  reason: string;
};

/**
 * A mod the driver removed (uninstalled) during a current-profile
 * install. Two sources:
 *
 *  - `replace-existing` choice for a `*-diverged` decision: the
 *    user's existing mod was uninstalled before the manifest's
 *    version was installed in its place.
 *  - `uninstall` choice for an `OrphanedModDecision`: the user
 *    explicitly asked to remove an orphan from a previous release
 *    of the same collection.
 *
 * The driver records these in {@link InstallSuccess.removedMods}
 * for the post-install summary and audit trail.
 */
export type RemovedModReportEntry = {
  /** Vortex mod id that was removed. */
  vortexModId: string;
  /** Display name at the time of removal. UI-only. */
  name: string;
  /** Why the driver removed it. */
  reason: "replace-existing" | "orphan-uninstall";
  /**
   * For `replace-existing`: the manifest compareKey of the mod that
   * replaced it. For `orphan-uninstall`: the previous-release
   * compareKey from the orphan's `originalCompareKey`. Surfaced for
   * UI provenance.
   */
  compareKey?: string;
};

/**
 * A mod the driver carried forward from the previous release without
 * re-installing it. Recorded in the new receipt so cross-release
 * orphan detection keeps working.
 *
 * Two sources, both current-profile only:
 *  - `*-diverged + keep-existing`: user kept their version.
 *    `enabledInProfile` is true (driver enables it).
 *  - `orphan + keep`: user kept the previous-release orphan.
 *    `enabledInProfile` is false (we do not touch its enabled state).
 */
export type CarriedModReportEntry = {
  /** Vortex mod id that was carried (the existing mod's id). */
  vortexModId: string;
  /** Display name. */
  name: string;
  /** Source kind from the manifest (or previous receipt for orphans). */
  source: "nexus" | "external";
  /** Why the driver carried it. */
  reason: "diverged-keep-existing" | "orphan-keep";
  /**
   * compareKey from the manifest entry (for `diverged-keep-existing`)
   * or from the previous-release receipt (for `orphan-keep`).
   */
  compareKey: string;
  /**
   * Original collection version this mod was installed by, when the
   * driver could resolve it from `previousInstall.packageVersion` or
   * `OrphanedModDecision.installedFromVersion`. UI-only.
   */
  installedFromVersion?: string;
  /** Whether the driver enabled this mod in the active profile. */
  enabledInProfile: boolean;
};
