/**
 * Install driver — Phase 3 slices 6a + 6b + 6c.
 *
 * Consumes a resolved {@link InstallPlan} and the user's confirmed
 * decisions, then mutates the user's machine to match the curator's
 * intent: optionally creates a fresh Vortex profile, removes
 * replaced/orphaned mods, installs each new mod, applies mod rules
 * + Vortex's per-game LoadOrder, deploys, and finally writes the
 * install ledger receipt.
 *
 * **Slice 6c scope** (additive over 6a/6b):
 *  - `applying-mod-rules` phase — dispatch every manifest
 *    `EhcollRule` via `actions.addModRule`, with a "collection-wins"
 *    conflict pass that overwrites pre-existing user rules pointing
 *    at the same target. Rules ignored by the curator are NOT
 *    applied. Skipped/applied/overwritten counts go into the receipt.
 *  - `applying-load-order` phase — dispatch the curator's per-game
 *    LoadOrder (Vortex's generic LoadOrder API, distinct from
 *    plugins.txt) via `actions.setLoadOrder`. Empty manifests no-op.
 *  - **plugins.txt is no longer written manually.** Locked design
 *    choice: rules-only strategy. Vortex + LOOT auto-sort during
 *    deploy compute the user's plugins.txt from our rules + the
 *    user's local masterlist + any layered mods. The manifest's
 *    plugin order is captured into the receipt's `baselinePluginOrder`
 *    for drift detection in the post-install summary.
 *
 * **Slice 6b scope** (preserved):
 *  - `installTarget.kind === "fresh-profile"` — fresh profile create
 *    + switch + install. (Slice 6a behavior; unchanged.)
 *  - `installTarget.kind === "current-profile"` — install in-place
 *    into the user's active profile.
 *  - `*-version-diverged`, `*-bytes-diverged`, `external-prompt-user`
 *    decisions are accepted IF the action handler supplied a
 *    matching `ConflictChoice` in `decisions.conflictChoices`. Without
 *    a choice the driver refuses to run.
 *  - `OrphanedModDecision`s are accepted in current-profile mode;
 *    each is acted on per the matching `OrphanChoice` in
 *    `decisions.orphanChoices` (default `keep`).
 *  - `nexus-unreachable` and `external-missing` remain hard-blocking;
 *    they have no user-resolution path.
 *
 * Spec: docs/business/INSTALL_DRIVER.md
 *
 * ─── EXECUTION MODEL ───────────────────────────────────────────────────
 * The driver progresses through a fixed sequence of phases. Some
 * phases are skipped depending on `installTarget.kind` and the
 * manifest contents:
 *
 *   1. preflight          — sanity-check plan + decisions.
 *   2. creating-profile   — fresh-profile only; dispatch new profile.
 *   3. switching-profile  — fresh-profile only; await `profile-did-change`.
 *   4. removing-mods      — current-profile only; uninstall replaced
 *                           and orphan-uninstall mods.
 *   5. installing-mods    — sequentially per mod (downloads/installs).
 *   5b. applying-mod-rules — dispatch curator's mod rules (slice 6c).
 *                           Skipped when manifest.rules is empty.
 *   6. writing-plugins-txt — NO-OP under rules-only strategy (kept
 *                            as a phase identifier for backward
 *                            progress-callback compatibility).
 *   7. deploying          — emit `deploy-mods`, await activation.
 *   7b. applying-load-order — dispatch curator's Vortex LoadOrder
 *                            (slice 6c). Skipped when manifest's
 *                            loadOrder is empty.
 *   8. writing-receipt    — persist the install ledger entry.
 *   9. complete           — emit final progress beat.
 *
 * Failures at any phase return {@link InstallResult.kind === "failed"};
 * the partial state is preserved (NOT rolled back) so the user can
 * inspect it manually. Idempotent on retry.
 *
 * Slice-6c phases are **non-fatal**: if rule application or
 * LoadOrder application throws unexpectedly, we log + continue to
 * the receipt. The user gets a successful install with a partial
 * rule application surfaced via `receipt.rulesApplication.skippedRules`.
 *
 * Concurrency: mod installs run **sequentially**. Vortex's install
 * pipeline serializes internally (FOMOD UI is modal); parallel calls
 * conflict over the global download/install lock. Sequential is also
 * the simplest mental model for the user-visible progress.
 * ──────────────────────────────────────────────────────────────────────
 */

import { types } from "vortex-api";

import {
  InstallLedgerError,
  writeReceipt,
} from "../installLedger";
import {
  type InstallReceipt,
  type InstallReceiptMod,
  type ReceiptPluginEntry,
  type RulesApplicationReceipt,
  type UserlistApplicationReceipt,
  INSTALL_LEDGER_SCHEMA_VERSION,
} from "../../types/installLedger";
import type {
  CarriedModReportEntry,
  ConflictChoice,
  DriverContext,
  DriverPhase,
  InstallResult,
  InstalledModReportEntry,
  OrphanChoice,
  RemovedModReportEntry,
  SkippedModReportEntry,
  UserConfirmedDecisions,
} from "../../types/installDriver";
import type {
  EhcollMod,
  EhcollManifest,
  ExternalEhcollMod,
  NexusEhcollMod,
} from "../../types/ehcoll";
import type {
  ModDecision,
  ModResolution,
  OrphanedModDecision,
} from "../../types/installPlan";
import type { SupportedGameId } from "../../types/ehcoll";
import {
  applyModRules,
  type ApplyModRulesResult,
  type ExistingRule,
} from "./applyModRules";
import {
  applyLoadOrder,
  type ApplyLoadOrderResult,
} from "./applyLoadOrder";
import {
  applyUserlist,
  type ApplyUserlistResult,
} from "./applyUserlist";
import {
  createFreshProfile,
  enableModInProfile,
  switchToProfile,
} from "./profile";
import {
  installFromBundledArchive,
  installFromExistingDownload,
  installFromLocalArchive,
  installNexusViaApi,
  safeRmTempDir,
  uninstallMod,
} from "./modInstall";
// NOTE: `writePluginsTxtWithBackup` is intentionally NOT imported.
// The "rules-only" strategy (locked design choice) lets Vortex +
// LOOT auto-sort produce plugins.txt during deploy. The module
// remains in the codebase for emergency manual recovery, but the
// driver no longer calls it. See the writing-plugins-txt phase
// comment for the full rationale.

const DEPLOY_TIMEOUT_MS = 5 * 60_000;

/**
 * Number of attempts to write the install receipt. The receipt is the
 * single source of cross-release lineage; a transient AV scan or
 * filesystem stutter that fails the first write but would succeed on
 * a second is worth a quick retry. Beyond that we surface the error.
 */
const RECEIPT_WRITE_ATTEMPTS = 2;
const RECEIPT_WRITE_RETRY_DELAY_MS = 250;

/**
 * Run the install. The driver is the only part of Event Horizon that
 * mutates Vortex state or the filesystem; everything else is pure.
 */
export async function runInstall(ctx: DriverContext): Promise<InstallResult> {
  const { plan, api } = ctx;
  const installedMods: InstalledModReportEntry[] = [];
  const skippedMods: SkippedModReportEntry[] = [];
  const removedMods: RemovedModReportEntry[] = [];
  const carriedMods: CarriedModReportEntry[] = [];
  const tempArchivesToCleanup: string[] = [];
  let activeProfileId: string | undefined;
  let activeProfileName: string | undefined;
  let createdProfileId: string | undefined;

  // Lookup manifest entries by compareKey rather than by index.
  // The resolver currently produces a 1:1 index alignment, but that
  // is an implementation detail the driver should not depend on —
  // compareKey is the canonical identity (it's what receipts use,
  // what conflict-choice maps key on, etc.).
  const manifestByCompareKey = buildManifestIndex(plan.manifest.mods);
  let rulesApplication: RulesApplicationReceipt = emptyRulesApplication();
  let userlistApplication: UserlistApplicationReceipt =
    emptyUserlistApplication();

  const reportProgress = (
    phase: DriverPhase,
    currentStep: number,
    totalSteps: number,
    message: string,
  ): void => {
    ctx.onProgress?.({ phase, currentStep, totalSteps, message });
  };

  const checkAbort = (phase: DriverPhase): InstallResult | undefined => {
    if (!ctx.abortSignal?.aborted) return undefined;
    return {
      kind: "aborted",
      phase,
      partialProfileId: createdProfileId,
      reason: "User aborted the install.",
    };
  };

  try {
    // ── 1. preflight ────────────────────────────────────────────────
    reportProgress("preflight", 0, 1, "Validating install plan...");

    const preflightError = preflight(plan, ctx.decisions);
    if (preflightError) {
      return {
        kind: "failed",
        phase: "preflight",
        error: preflightError,
        installedSoFar: [],
      };
    }

    let aborted = checkAbort("preflight");
    if (aborted) return aborted;

    // ── 2 + 3. profile resolution ───────────────────────────────────
    if (plan.installTarget.kind === "fresh-profile") {
      // Fresh-profile mode: create a new profile and switch into it.
      reportProgress(
        "creating-profile",
        0,
        1,
        `Creating Vortex profile "${plan.installTarget.suggestedProfileName}"...`,
      );

      const created = createFreshProfile(
        api,
        plan.manifest.game.id,
        plan.installTarget.suggestedProfileName,
      );
      createdProfileId = created.id;
      activeProfileId = created.id;
      activeProfileName = created.name;

      aborted = checkAbort("creating-profile");
      if (aborted) return aborted;

      reportProgress(
        "switching-profile",
        0,
        1,
        `Switching to "${activeProfileName}"...`,
      );

      try {
        await switchToProfile(api, activeProfileId, ctx.abortSignal);
      } catch (err) {
        // AbortError → fall through to the usual abort handling
        // (caller has already cleared the active profile in Vortex
        // OR Vortex will eventually catch up and emit
        // profile-did-change; either way the install can't proceed).
        if ((err as Error)?.name === "AbortError") {
          aborted = checkAbort("switching-profile");
          if (aborted) return aborted;
          // Defensive: if the signal isn't aborted but we got an
          // AbortError anyway (impossible by construction, but
          // belt-and-suspenders for future refactors), treat it as
          // a user-aborted switch.
          return {
            kind: "aborted",
            phase: "switching-profile",
            partialProfileId: createdProfileId,
            reason: "Profile switch aborted before completion.",
          };
        }
        throw err;
      }

      aborted = checkAbort("switching-profile");
      if (aborted) return aborted;
    } else {
      // Current-profile mode: install in-place into the active profile.
      activeProfileId = plan.installTarget.profileId;
      activeProfileName = plan.installTarget.profileName;
    }

    // ── 4. remove replaced + orphan-uninstalled mods ────────────────
    // Skipped silently when nothing to do (fresh-profile mode produces
    // an empty removal list by construction).
    const removalPlan = collectRemovalPlan(plan, ctx.decisions);
    if (removalPlan.length > 0) {
      const totalRemovals = removalPlan.length;
      for (let i = 0; i < totalRemovals; i++) {
        const item = removalPlan[i];
        reportProgress(
          "removing-mods",
          i + 1,
          totalRemovals,
          `[${i + 1}/${totalRemovals}] Removing "${item.name}" (${item.reason})...`,
        );

        try {
          await uninstallMod(api, {
            gameId: plan.manifest.game.id,
            modId: item.modId,
          });
        } catch (err) {
          return {
            kind: "failed",
            phase: "removing-mods",
            partialProfileId: createdProfileId,
            error:
              `Failed removing "${item.name}" (${item.reason}): ` +
              formatError(err),
            installedSoFar: installedMods.map((m) => m.vortexModId),
          };
        }

        removedMods.push({
          vortexModId: item.modId,
          name: item.name,
          reason: item.reason,
          compareKey: item.compareKey,
        });

        aborted = checkAbort("removing-mods");
        if (aborted) return aborted;
      }
    }

    // ── 5. install each mod sequentially ────────────────────────────
    const total = plan.modResolutions.length;
    for (let i = 0; i < total; i++) {
      const resolution = plan.modResolutions[i];
      const manifestEntry = manifestByCompareKey.get(resolution.compareKey);
      if (!manifestEntry) {
        // Resolver invariant violation — every modResolution must
        // reference a real manifest entry by compareKey.
        return {
          kind: "failed",
          phase: "installing-mods",
          partialProfileId: createdProfileId,
          error:
            `Internal error: resolution for "${resolution.name}" ` +
            `(compareKey=${resolution.compareKey}) has no matching manifest entry.`,
          installedSoFar: installedMods.map((m) => m.vortexModId),
        };
      }

      reportProgress(
        "installing-mods",
        i + 1,
        total,
        `[${i + 1}/${total}] ${resolution.name}: ${describeDecision(
          resolution.decision,
          ctx.decisions,
        )}`,
      );

      let installEntry: InstalledModReportEntry | undefined;
      try {
        installEntry = await executeDecision({
          ctx,
          resolution,
          manifestEntry,
          profileId: activeProfileId,
          onTempArchive: (p) => tempArchivesToCleanup.push(p),
          onSkip: (entry) => skippedMods.push(entry),
          onCarry: (entry) => carriedMods.push(entry),
        });
      } catch (err) {
        // Honor user aborts even if they bubbled out of a primitive
        // before checkAbort had a chance to catch them. The signal is
        // the source of truth — the AbortError is only a faster
        // exit path than letting the timeout/watchdog trip.
        if (
          (err as Error)?.name === "AbortError" ||
          ctx.abortSignal?.aborted
        ) {
          return {
            kind: "aborted",
            phase: "installing-mods",
            partialProfileId: createdProfileId,
            reason: `Install aborted while processing "${resolution.name}".`,
          };
        }
        const phase: DriverPhase = "installing-mods";
        return {
          kind: "failed",
          phase,
          partialProfileId: createdProfileId,
          error:
            `Failed installing "${resolution.name}" ` +
            `(decision=${resolution.decision.kind}): ${formatError(err)}`,
          installedSoFar: installedMods.map((m) => m.vortexModId),
        };
      }

      if (installEntry === undefined) {
        // Soft-skip OR carry-forward — onSkip / onCarry already
        // recorded the entry. The carry-forward path also enabled
        // the mod in the active profile inside executeDivergedChoice.
        continue;
      }

      installedMods.push(installEntry);
      enableModInProfile(api, activeProfileId, installEntry.vortexModId);

      aborted = checkAbort("installing-mods");
      if (aborted) return aborted;
    }

    // Record orphan-keep choices into carriedMods so they remain
    // tagged in the new receipt (cross-release lineage preservation).
    // We do not enable these — the user said "keep" meaning "leave
    // alone," and we honor that.
    for (const orphan of plan.orphanedMods) {
      const choice = ctx.decisions.orphanChoices?.[orphan.existingModId];
      if (choice?.kind !== "keep") continue;
      carriedMods.push(buildOrphanCarriedEntry(api, plan, orphan));
    }

    // ── 5b. apply mod rules ─────────────────────────────────────────
    // Rules must land BEFORE plugins.txt + deploy: Vortex's
    // gamebryo-plugin-management runs LOOT auto-sort during deploy,
    // and LOOT picks up `state.persistent.mods[gameId][modId].rules`
    // when computing the topological sort. Applying rules later
    // would race the auto-sort and require a second deploy.
    //
    // Build the resolution map from EVERYTHING that ended up on the
    // user's machine for this collection: freshly installed mods
    // (`installedMods`), kept-existing carries (`carriedMods` from
    // the diverged-keep-existing path), already-installed re-uses
    // (the `*-already-installed` decisions surface via
    // `installedMods`), and orphan-keep carries. The map is the
    // single source of truth — `applyModRules` does not look anywhere
    // else.
    const modIdByCompareKey = buildPostInstallModIdMap(
      installedMods,
      carriedMods,
    );

    if (plan.manifest.rules.length > 0) {
      reportProgress(
        "applying-mod-rules",
        0,
        plan.manifest.rules.length,
        `Applying ${plan.manifest.rules.length} mod rule(s)...`,
      );

      const modIdByNexusModId = buildNexusModIdMap(
        api,
        plan.manifest.game.id,
        installedMods,
        carriedMods,
      );
      const existingRulesBySourceModId = collectExistingRules(
        api,
        plan.manifest.game.id,
        modIdByCompareKey,
      );

      try {
        const ruleResult = applyModRules({
          api,
          gameId: plan.manifest.game.id,
          rules: plan.manifest.rules,
          modIdByCompareKey,
          modIdByNexusModId,
          existingRulesBySourceModId,
          signal: ctx.abortSignal,
        });
        rulesApplication = mergeRuleResult(rulesApplication, ruleResult);
      } catch (err) {
        if (
          (err as Error)?.name === "AbortError" ||
          ctx.abortSignal?.aborted
        ) {
          return {
            kind: "aborted",
            phase: "applying-mod-rules",
            partialProfileId: createdProfileId,
            reason: "Install aborted while applying mod rules.",
          };
        }
        // Mod-rule failures are non-fatal — they don't block install.
        // We log and continue; the receipt's skippedRules list will
        // still surface the issue in the post-install summary.
        console.warn(
          `[Vortex Event Horizon] applyModRules threw unexpectedly: ` +
            (err instanceof Error ? err.message : String(err)) +
            `. Continuing without rule application.`,
        );
      }

      aborted = checkAbort("applying-mod-rules");
      if (aborted) return aborted;
    }

    // ── 5c. apply LOOT userlist (slice 6d) ──────────────────────────
    // Plugin-to-plugin rules + group definitions + per-plugin group
    // assignments live in `state.userlist`, NOT in the mod-rules
    // slice we just wrote. They drive LOOT's `plugins.txt` ordering
    // — which is exactly what the curator's "the order I shipped"
    // intent maps to. Mod rules above only affect file-deployment
    // conflicts; without this phase the user gets the curator's
    // mod-conflict resolution but their own LOOT sort, and we'd
    // reproduce the "Vortex says rules applied, LOOT gives slightly
    // different order" report we set out to fix.
    //
    // Why before deploy: Vortex's gamebryo-plugin-management runs
    // `loot.sortPluginsAsync` during deploy. The sort call reads
    // `userlist.yaml` from disk; that file is updated synchronously
    // by `UserlistPersistor` whenever `state.userlist` changes. So
    // dispatch → reducer updates state → persistor writes YAML →
    // LOOT reads YAML at sort time. Running this phase after deploy
    // would either need a second deploy or leave the user with a
    // wrong sort until they deploy again.
    //
    // Why non-fatal: same rationale as `applying-mod-rules`. If
    // Vortex's userlist contract changed, we want to surface the
    // actionable error in `receipt.userlistApplication.skippedUserlistEntries`
    // rather than aborting an otherwise-successful install.
    const ulPlugins = plan.manifest.userlist.plugins.length;
    const ulGroups = plan.manifest.userlist.groups.length;
    if (ulPlugins > 0 || ulGroups > 0) {
      reportProgress(
        "applying-userlist",
        0,
        ulPlugins + ulGroups,
        `Applying LOOT userlist (${ulPlugins} plugin entr${ulPlugins === 1 ? "y" : "ies"}, ${ulGroups} group${ulGroups === 1 ? "" : "s"})...`,
      );

      try {
        const ulResult = applyUserlist({
          api,
          userlist: plan.manifest.userlist,
          signal: ctx.abortSignal,
        });
        userlistApplication = mergeUserlistResult(
          userlistApplication,
          ulResult,
        );
      } catch (err) {
        if (
          (err as Error)?.name === "AbortError" ||
          ctx.abortSignal?.aborted
        ) {
          return {
            kind: "aborted",
            phase: "applying-userlist",
            partialProfileId: createdProfileId,
            reason: "Install aborted while applying LOOT userlist.",
          };
        }
        // Non-fatal — log and continue. Receipt's
        // skippedUserlistEntries surfaces the issue.
        console.warn(
          `[Vortex Event Horizon] applyUserlist threw unexpectedly: ` +
            (err instanceof Error ? err.message : String(err)) +
            `. Continuing without userlist application.`,
        );
      }

      aborted = checkAbort("applying-userlist");
      if (aborted) return aborted;
    }

    // ── 6. plugins.txt (no-op write under rules-only strategy) ──────
    // We deliberately do NOT overwrite plugins.txt directly. Locked
    // design choice: applying mod rules above lets Vortex's
    // gamebryo-plugin-management + LOOT auto-sort produce the
    // user's plugins.txt during deploy, using OUR rules + the
    // user's local LOOT masterlist + any mods the user has on top.
    //
    // This is the answer to the "LOOT gives a slightly different
    // load order than what the curator baked in" report: that drift
    // is *expected* — LOOT incorporates per-machine masterlist
    // updates and the user's own mods. Hard-pinning plugins.txt
    // would fight Vortex and re-introduce the drift on the next
    // deploy anyway.
    //
    // We still capture the manifest's plugin order into the receipt
    // (`baselinePluginOrder`) so the post-install summary can
    // surface a "your current order differs from collection's by N
    // plugins" hint. Drift detection is informational only — it
    // never blocks the user from making their own changes.
    aborted = checkAbort("writing-plugins-txt");
    if (aborted) return aborted;

    // ── 7. deploy ───────────────────────────────────────────────────
    reportProgress("deploying", 0, 1, "Deploying mods...");

    try {
      await deployAndWait(api);
    } catch (err) {
      return {
        kind: "failed",
        phase: "deploying",
        partialProfileId: createdProfileId,
        error: `Deployment failed: ${formatError(err)}`,
        installedSoFar: installedMods.map((m) => m.vortexModId),
      };
    }

    aborted = checkAbort("deploying");
    if (aborted) return aborted;

    // ── 7b. apply Vortex per-game LoadOrder ─────────────────────────
    // Distinct from plugins.txt: this is Vortex's generic LoadOrder
    // API for non-plugin payloads (script extenders, ENB binaries,
    // generic-game mods on titles like Starfield). Applied AFTER
    // deploy because Vortex registers loose-archive mods during the
    // deploy pass — we want the LoadOrder dispatch to land on a
    // fully-populated mod table.
    if (plan.manifest.loadOrder.length > 0) {
      reportProgress(
        "applying-load-order",
        0,
        plan.manifest.loadOrder.length,
        `Applying load order (${plan.manifest.loadOrder.length} entries)...`,
      );

      try {
        const loResult = applyLoadOrder({
          api,
          gameId: plan.manifest.game.id,
          entries: plan.manifest.loadOrder,
          modIdByCompareKey,
          displayNameByModId: buildDisplayNameByModId(
            installedMods,
            carriedMods,
          ),
          signal: ctx.abortSignal,
        });
        rulesApplication = mergeLoadOrderResult(rulesApplication, loResult);
      } catch (err) {
        if (
          (err as Error)?.name === "AbortError" ||
          ctx.abortSignal?.aborted
        ) {
          return {
            kind: "aborted",
            phase: "applying-load-order",
            partialProfileId: createdProfileId,
            reason: "Install aborted while applying load order.",
          };
        }
        // Non-fatal — log and continue to receipt.
        console.warn(
          `[Vortex Event Horizon] applyLoadOrder threw unexpectedly: ` +
            (err instanceof Error ? err.message : String(err)) +
            `. Continuing without LoadOrder application.`,
        );
      }

      aborted = checkAbort("applying-load-order");
      if (aborted) return aborted;
    }

    // Capture the manifest's plugin order into the receipt for
    // drift detection. This always happens (even when LoadOrder is
    // empty) so the post-install summary can surface the
    // collection's expected baseline.
    rulesApplication = {
      ...rulesApplication,
      baselinePluginOrder: plan.manifest.plugins.order.map(
        (p): ReceiptPluginEntry => ({ name: p.name, enabled: p.enabled }),
      ),
    };

    // ── 8. write receipt ────────────────────────────────────────────
    reportProgress("writing-receipt", 0, 1, "Writing install receipt...");

    const receipt = buildReceipt({
      ctx,
      profileId: activeProfileId,
      profileName: activeProfileName ?? activeProfileId,
      installedMods,
      carriedMods,
      rulesApplication,
      userlistApplication,
    });

    let receiptPath: string;
    try {
      receiptPath = await writeReceiptWithRetry(ctx.appDataPath, receipt);
    } catch (err) {
      const errMsg =
        err instanceof InstallLedgerError
          ? err.message
          : formatError(err);
      return {
        kind: "failed",
        phase: "writing-receipt",
        partialProfileId: createdProfileId,
        error: `Failed writing install receipt: ${errMsg}`,
        installedSoFar: installedMods.map((m) => m.vortexModId),
      };
    }

    // ── 9. done ─────────────────────────────────────────────────────
    reportProgress("complete", 1, 1, "Install complete.");

    return {
      kind: "success",
      profileId: activeProfileId,
      profileName: activeProfileName ?? activeProfileId,
      installTargetMode: plan.installTarget.kind,
      receiptPath,
      installedModIds: installedMods.map((m) => m.vortexModId),
      installedMods,
      skippedMods,
      removedMods,
      carriedMods,
    };
  } finally {
    // Cleanup of bundled-extract temp dirs is fire-and-forget. Each
    // entry is the **directory** returned by extractBundledFromEhcoll
    // (one per successful bundled install). Failures here don't
    // reach the user — the OS temp GC reclaims leftovers eventually.
    for (const tempDir of tempArchivesToCleanup) {
      void safeRmTempDir(tempDir);
    }
  }
}

// ===========================================================================
// Per-decision execution
// ===========================================================================

async function executeDecision(args: {
  ctx: DriverContext;
  resolution: ModResolution;
  manifestEntry: EhcollMod;
  profileId: string;
  onTempArchive: (p: string) => void;
  onSkip: (entry: SkippedModReportEntry) => void;
  onCarry: (entry: CarriedModReportEntry) => void;
}): Promise<InstalledModReportEntry | undefined> {
  const { ctx, resolution, manifestEntry, profileId, onTempArchive, onSkip, onCarry } =
    args;
  const { manifest } = ctx.plan;
  const decision = resolution.decision;
  const compareKey = resolution.compareKey;

  switch (decision.kind) {
    case "nexus-already-installed":
    case "external-already-installed": {
      // Re-use the existing Vortex mod entry; just enable it.
      return {
        compareKey,
        name: resolution.name,
        vortexModId: decision.existingModId,
        source: resolution.sourceKind,
        fromDecision: decision.kind,
      };
    }

    case "nexus-download": {
      const result = await installNexusViaApi(ctx.api, {
        gameId: manifest.game.id,
        nexusModId: decision.modId,
        nexusFileId: decision.fileId,
        fileName: decision.archiveName,
        signal: ctx.abortSignal,
      });
      return {
        compareKey,
        name: resolution.name,
        vortexModId: result.vortexModId,
        source: "nexus",
        fromDecision: decision.kind,
      };
    }

    case "nexus-use-local-download":
    case "external-use-local-download": {
      const result = await installFromExistingDownload(ctx.api, {
        gameId: manifest.game.id,
        archiveId: decision.archiveId,
        signal: ctx.abortSignal,
      });
      return {
        compareKey,
        name: resolution.name,
        vortexModId: result.vortexModId,
        source: resolution.sourceKind,
        fromDecision: decision.kind,
      };
    }

    case "external-use-bundled": {
      const result = await installFromBundledArchive(ctx.api, {
        gameId: manifest.game.id,
        ehcollZipPath: ctx.ehcollZipPath,
        bundledZipEntry: decision.zipPath,
        signal: ctx.abortSignal,
      });
      // Track the temp **directory**, not the file: cherry-picked
      // entries can have nested paths inside the dir.
      onTempArchive(result.tempDir);
      return {
        compareKey,
        name: resolution.name,
        vortexModId: result.vortexModId,
        source: "external",
        fromDecision: decision.kind,
      };
    }

    // ── Slice 6b: divergence + prompt-user with user choices ────────
    case "nexus-version-diverged":
    case "nexus-bytes-diverged":
    case "external-bytes-diverged": {
      const choice = ctx.decisions.conflictChoices?.[compareKey];
      if (!choice) {
        // Preflight should have caught this; defensive fallback.
        throw new Error(
          `No conflictChoice for diverged mod "${resolution.name}" ` +
            `(compareKey=${compareKey}, decision=${decision.kind}).`,
        );
      }
      return executeDivergedChoice({
        ctx,
        resolution,
        manifestEntry,
        choice,
        profileId,
        onTempArchive,
        onSkip,
        onCarry,
      });
    }

    case "external-prompt-user": {
      const choice = ctx.decisions.conflictChoices?.[compareKey];
      if (!choice) {
        throw new Error(
          `No conflictChoice for external-prompt-user mod "${resolution.name}" ` +
            `(compareKey=${compareKey}).`,
        );
      }
      return executePromptUserChoice({
        ctx,
        resolution,
        choice,
        onSkip,
      });
    }

    case "nexus-unreachable":
    case "external-missing": {
      // Hard-blocking — preflight should have refused. Defensive throw.
      throw new Error(
        `Decision "${decision.kind}" has no user-resolution path; preflight should have rejected the plan.`,
      );
    }

    default:
      assertNever(decision);
  }
}

/**
 * Execute the user's choice for a `*-diverged` decision.
 * `replace-existing` ⇒ uninstall already happened in `removing-mods`
 *   phase; we now install the manifest's version using the appropriate
 *   primitive based on the manifest source kind.
 * `keep-existing` ⇒ enable the existing mod in the active profile,
 *   then carry it forward into the new receipt with its previous-
 *   release lineage preserved (H1 fix). Without enabling we'd silently
 *   ship a collection with the mod missing if the user had it
 *   disabled in the active profile (H6 fix).
 * `use-local-file` ⇒ NOT valid for diverged; treated as a programmer
 *   bug at the action layer.
 * `skip` ⇒ NOT valid for diverged either; the explicit "do nothing"
 *   choice for a conflict is `keep-existing`.
 */
async function executeDivergedChoice(args: {
  ctx: DriverContext;
  resolution: ModResolution;
  manifestEntry: EhcollMod;
  choice: ConflictChoice;
  profileId: string;
  onTempArchive: (p: string) => void;
  onSkip: (entry: SkippedModReportEntry) => void;
  onCarry: (entry: CarriedModReportEntry) => void;
}): Promise<InstalledModReportEntry | undefined> {
  const {
    ctx,
    resolution,
    manifestEntry,
    choice,
    profileId,
    onTempArchive,
    onSkip,
    onCarry,
  } = args;
  const compareKey = resolution.compareKey;
  const decision = resolution.decision;

  if (choice.kind === "keep-existing") {
    if (
      decision.kind !== "nexus-version-diverged" &&
      decision.kind !== "nexus-bytes-diverged" &&
      decision.kind !== "external-bytes-diverged"
    ) {
      throw new Error(
        `keep-existing choice arrived for non-diverged decision ` +
          `"${decision.kind}" (programmer error).`,
      );
    }

    // H6: ensure the user's existing mod is enabled in the active
    // profile so the collection actually gets the mod. In current-
    // profile mode the mod might be globally installed but disabled
    // in this profile.
    enableModInProfile(ctx.api, profileId, decision.existingModId);

    // H1: record into carriedMods so the receipt preserves the
    // mod's lineage. Future releases that drop this compareKey will
    // detect it as an orphan.
    onCarry({
      vortexModId: decision.existingModId,
      name: resolution.name,
      source: resolution.sourceKind,
      reason: "diverged-keep-existing",
      compareKey,
      installedFromVersion: ctx.plan.previousInstall?.packageVersion,
      enabledInProfile: true,
    });

    // Surface in skippedMods too — the user-facing summary still
    // wants to say "we did not install the manifest's version of X."
    onSkip({
      compareKey,
      name: resolution.name,
      reason:
        `User chose keep-existing for ${decision.kind}; manifest version ` +
        `was not installed (existing version enabled and carried forward).`,
    });
    return undefined;
  }

  if (choice.kind === "skip") {
    onSkip({
      compareKey,
      name: resolution.name,
      reason: `User chose skip for ${decision.kind}.`,
    });
    return undefined;
  }

  if (choice.kind === "use-local-file") {
    throw new Error(
      `'use-local-file' choice is not valid for diverged decision "${decision.kind}" ` +
        `("${resolution.name}"). Use it only for external-prompt-user.`,
    );
  }

  // choice.kind === "replace-existing": install the manifest's version.
  // The user's old mod was already uninstalled in the removing-mods phase.
  return installManifestEntry({
    ctx,
    resolution,
    manifestEntry,
    onTempArchive,
    fromDecisionLabel: `${decision.kind}/replace-existing`,
  });
}

/**
 * Execute the user's choice for an `external-prompt-user` decision.
 * `use-local-file` ⇒ install from the user's picked archive path.
 * `skip` ⇒ record as skipped.
 * `keep-existing` / `replace-existing` ⇒ NOT valid (no "existing" to
 *   keep or replace; the mod is missing entirely).
 */
async function executePromptUserChoice(args: {
  ctx: DriverContext;
  resolution: ModResolution;
  choice: ConflictChoice;
  onSkip: (entry: SkippedModReportEntry) => void;
}): Promise<InstalledModReportEntry | undefined> {
  const { ctx, resolution, choice, onSkip } = args;
  const compareKey = resolution.compareKey;

  if (choice.kind === "skip") {
    onSkip({
      compareKey,
      name: resolution.name,
      reason: "User chose skip for external-prompt-user.",
    });
    return undefined;
  }

  if (choice.kind !== "use-local-file") {
    throw new Error(
      `Choice "${choice.kind}" is not valid for external-prompt-user ` +
        `("${resolution.name}"). Expected use-local-file or skip.`,
    );
  }

  const result = await installFromLocalArchive(ctx.api, {
    gameId: ctx.plan.manifest.game.id,
    archivePath: choice.localPath,
    signal: ctx.abortSignal,
  });

  return {
    compareKey,
    name: resolution.name,
    vortexModId: result.vortexModId,
    source: "external",
    fromDecision: "external-prompt-user/use-local-file",
  };
}

/**
 * Install the manifest's version of a mod, picking the right
 * primitive based on the manifest's source kind. Used for
 * `replace-existing` choices (the existing mod is already gone).
 *
 * Decision waterfall for the manifest entry:
 *  - Nexus mod ⇒ download from Nexus (canonical path; we don't trust
 *    that the user has a local download for an unrelated reason).
 *  - External mod with `bundled: true` ⇒ extract from the .ehcoll.
 *  - External mod with `bundled: false` ⇒ throw — the user should
 *    not have been offered "replace" if there was nowhere to get
 *    the new bytes. (The action handler is responsible for not
 *    surfacing the replace option in that scenario.)
 */
async function installManifestEntry(args: {
  ctx: DriverContext;
  resolution: ModResolution;
  manifestEntry: EhcollMod;
  onTempArchive: (p: string) => void;
  fromDecisionLabel: string;
}): Promise<InstalledModReportEntry> {
  const { ctx, resolution, manifestEntry, onTempArchive, fromDecisionLabel } =
    args;
  const compareKey = resolution.compareKey;
  const gameId = ctx.plan.manifest.game.id;

  if (manifestEntry.source.kind === "nexus") {
    const nx = manifestEntry as NexusEhcollMod;
    const result = await installNexusViaApi(ctx.api, {
      gameId,
      nexusModId: nx.source.modId,
      nexusFileId: nx.source.fileId,
      fileName: nx.source.archiveName,
      signal: ctx.abortSignal,
    });
    return {
      compareKey,
      name: resolution.name,
      vortexModId: result.vortexModId,
      source: "nexus",
      fromDecision: fromDecisionLabel,
    };
  }

  // External mod.
  const ex = manifestEntry as ExternalEhcollMod;
  if (!ex.source.bundled) {
    throw new Error(
      `Cannot replace external mod "${resolution.name}" (compareKey=${compareKey}): ` +
        `manifest does not bundle the archive. Use 'use-local-file' instead.`,
    );
  }

  const bundledEntry = findBundledZipEntry(ctx, ex);
  const result = await installFromBundledArchive(ctx.api, {
    gameId,
    ehcollZipPath: ctx.ehcollZipPath,
    bundledZipEntry: bundledEntry,
    signal: ctx.abortSignal,
  });
  onTempArchive(result.tempDir);

  return {
    compareKey,
    name: resolution.name,
    vortexModId: result.vortexModId,
    source: "external",
    fromDecision: fromDecisionLabel,
  };
}

function findBundledZipEntry(ctx: DriverContext, mod: ExternalEhcollMod): string {
  const match = ctx.ehcoll.bundledArchives.find(
    (b) => b.sha256 === mod.source.sha256,
  );
  if (!match) {
    throw new Error(
      `Bundled archive for sha=${mod.source.sha256} not found in .ehcoll. ` +
        `Re-build the package or report a manifest/bundled mismatch.`,
    );
  }
  return match.zipPath;
}

// ===========================================================================
// Removal plan (slice 6b)
// ===========================================================================

type RemovalItem = {
  modId: string;
  name: string;
  reason: "replace-existing" | "orphan-uninstall";
  compareKey?: string;
};

/**
 * Walk the plan and the user's confirmed decisions to build the list
 * of mods we'll uninstall in the `removing-mods` phase. Two sources:
 *
 *  - Every `ModResolution` whose decision is `*-diverged` and whose
 *    user choice is `replace-existing` contributes the
 *    `decision.existingModId` (with the new manifest's compareKey
 *    for provenance).
 *  - Every `OrphanedModDecision` whose user choice is `uninstall`
 *    contributes its `existingModId`.
 *
 * Empty result ⇒ skip the `removing-mods` phase entirely.
 */
function collectRemovalPlan(
  plan: DriverContext["plan"],
  decisions: UserConfirmedDecisions,
): RemovalItem[] {
  const items: RemovalItem[] = [];

  for (const r of plan.modResolutions) {
    const choice = decisions.conflictChoices?.[r.compareKey];
    if (!choice || choice.kind !== "replace-existing") continue;

    const decision = r.decision;
    if (
      decision.kind === "nexus-version-diverged" ||
      decision.kind === "nexus-bytes-diverged" ||
      decision.kind === "external-bytes-diverged"
    ) {
      items.push({
        modId: decision.existingModId,
        name: r.name,
        reason: "replace-existing",
        compareKey: r.compareKey,
      });
    }
  }

  for (const orphan of plan.orphanedMods) {
    const choice = decisions.orphanChoices?.[orphan.existingModId] ?? {
      kind: "keep" as const,
    };
    if (choice.kind === "uninstall") {
      items.push({
        modId: orphan.existingModId,
        name: orphan.name,
        reason: "orphan-uninstall",
        compareKey: orphan.originalCompareKey,
      });
    }
  }

  return items;
}

// ===========================================================================
// Preflight (slice 6b)
// ===========================================================================

function preflight(
  plan: DriverContext["plan"],
  decisions: UserConfirmedDecisions,
): string | undefined {
  if (!plan.summary.canProceed) {
    return (
      "Plan summary reports canProceed=false. " +
      "Refusing to install — fix the issues flagged in the preview first."
    );
  }
  if (plan.compatibility.gameMatches !== true) {
    return "Plan's game id does not match the active Vortex game. Switch games and try again.";
  }

  // Hard-blocking decisions: nothing the user can pick fixes these.
  const hardBlockers = collectHardBlockers(plan.modResolutions);
  if (hardBlockers.length > 0) {
    return (
      `Plan contains ${hardBlockers.length} mod(s) that cannot be installed ` +
      `under any user choice: ` +
      hardBlockers.map((b) => `${b.name} [${b.kind}]`).join(", ") +
      `. Resolve at the resolver level (re-build the package or fix the manifest).`
    );
  }

  // For every conflict-needing decision, the action handler must have
  // supplied a matching ConflictChoice. Missing entries fail preflight.
  const missingChoices = collectMissingConflictChoices(
    plan.modResolutions,
    decisions,
  );
  if (missingChoices.length > 0) {
    return (
      `Plan contains ${missingChoices.length} mod(s) needing user input ` +
      `but no conflictChoice was supplied: ` +
      missingChoices.map((m) => `${m.name} [${m.kind}]`).join(", ") +
      `. The action handler must collect a ConflictChoice for each before running the driver.`
    );
  }

  // Every supplied choice must be valid for the decision it covers.
  const invalidChoices = collectInvalidConflictChoices(
    plan.modResolutions,
    decisions,
  );
  if (invalidChoices.length > 0) {
    return (
      `Plan contains ${invalidChoices.length} invalid conflictChoice(s): ` +
      invalidChoices.join("; ")
    );
  }

  // Validate orphan choices reference real orphans.
  const invalidOrphans = collectInvalidOrphanChoices(
    plan.orphanedMods,
    decisions,
  );
  if (invalidOrphans.length > 0) {
    return (
      `orphanChoices references unknown orphan mod ids: ` +
      invalidOrphans.join(", ")
    );
  }

  // Defensive: in fresh-profile mode we should not see any orphans.
  if (
    plan.installTarget.kind === "fresh-profile" &&
    plan.orphanedMods.length > 0
  ) {
    return (
      `Plan reports ${plan.orphanedMods.length} orphaned mod(s) but fresh-profile ` +
      `installs should never produce orphans. Refusing to proceed.`
    );
  }

  return undefined;
}

function collectHardBlockers(
  resolutions: ModResolution[],
): Array<{ name: string; kind: ModDecision["kind"] }> {
  const out: Array<{ name: string; kind: ModDecision["kind"] }> = [];
  for (const r of resolutions) {
    if (
      r.decision.kind === "nexus-unreachable" ||
      r.decision.kind === "external-missing"
    ) {
      out.push({ name: r.name, kind: r.decision.kind });
    }
  }
  return out;
}

function collectMissingConflictChoices(
  resolutions: ModResolution[],
  decisions: UserConfirmedDecisions,
): Array<{ name: string; kind: ModDecision["kind"] }> {
  const out: Array<{ name: string; kind: ModDecision["kind"] }> = [];
  for (const r of resolutions) {
    if (!needsConflictChoice(r.decision)) continue;
    if (decisions.conflictChoices?.[r.compareKey] === undefined) {
      out.push({ name: r.name, kind: r.decision.kind });
    }
  }
  return out;
}

function needsConflictChoice(decision: ModDecision): boolean {
  return (
    decision.kind === "nexus-version-diverged" ||
    decision.kind === "nexus-bytes-diverged" ||
    decision.kind === "external-bytes-diverged" ||
    decision.kind === "external-prompt-user"
  );
}

function collectInvalidConflictChoices(
  resolutions: ModResolution[],
  decisions: UserConfirmedDecisions,
): string[] {
  const out: string[] = [];
  for (const r of resolutions) {
    const choice = decisions.conflictChoices?.[r.compareKey];
    if (!choice) continue;
    const reason = validateConflictChoice(r.decision, choice);
    if (reason) out.push(`${r.name} [${r.decision.kind}]: ${reason}`);
  }
  // Surface stray keys not referenced by any mod (likely bug).
  const validKeys = new Set(resolutions.map((r) => r.compareKey));
  for (const key of Object.keys(decisions.conflictChoices ?? {})) {
    if (!validKeys.has(key)) {
      out.push(`stray conflictChoice key "${key}" matches no mod in the plan`);
    }
  }
  return out;
}

function validateConflictChoice(
  decision: ModDecision,
  choice: ConflictChoice,
): string | undefined {
  if (
    decision.kind === "nexus-version-diverged" ||
    decision.kind === "nexus-bytes-diverged" ||
    decision.kind === "external-bytes-diverged"
  ) {
    if (choice.kind !== "keep-existing" && choice.kind !== "replace-existing") {
      return `expected keep-existing or replace-existing, got ${choice.kind}`;
    }
    return undefined;
  }
  if (decision.kind === "external-prompt-user") {
    if (choice.kind === "use-local-file") {
      if (typeof choice.localPath !== "string" || choice.localPath.length === 0) {
        return `use-local-file requires a non-empty localPath`;
      }
      return undefined;
    }
    if (choice.kind === "skip") return undefined;
    return `expected use-local-file or skip, got ${choice.kind}`;
  }
  return `decision kind "${decision.kind}" does not accept user choices`;
}

function collectInvalidOrphanChoices(
  orphans: OrphanedModDecision[],
  decisions: UserConfirmedDecisions,
): string[] {
  const validIds = new Set(orphans.map((o) => o.existingModId));
  const out: string[] = [];
  for (const id of Object.keys(decisions.orphanChoices ?? {})) {
    if (!validIds.has(id)) out.push(id);
  }
  return out;
}

// ===========================================================================
// Deploy
// ===========================================================================

/**
 * Trigger Vortex's deployment pipeline and wait for it to finish.
 * Vortex emits `did-deploy` when activation completes (either after a
 * `deploy-mods` call or after a profile switch's auto-deploy).
 */
async function deployAndWait(api: types.IExtensionApi): Promise<void> {
  const state = api.getState();
  const profileId =
    state.settings?.profiles?.activeProfileId ??
    state.settings?.profiles?.nextProfileId;

  if (!profileId) {
    throw new Error("No active profile to deploy.");
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      api.events.removeListener("did-deploy", onDidDeploy);
      reject(
        new Error(
          `Deployment did not complete within ${DEPLOY_TIMEOUT_MS / 1000}s.`,
        ),
      );
    }, DEPLOY_TIMEOUT_MS);

    const onDidDeploy = (deployedProfileId: string): void => {
      if (settled) return;
      if (deployedProfileId !== profileId) return;
      settled = true;
      clearTimeout(timeout);
      api.events.removeListener("did-deploy", onDidDeploy);
      resolve();
    };

    api.events.on("did-deploy", onDidDeploy);

    api.events.emit(
      "deploy-mods",
      profileId,
      (err: Error | null | undefined) => {
        if (settled) return;
        if (err) {
          settled = true;
          clearTimeout(timeout);
          api.events.removeListener("did-deploy", onDidDeploy);
          reject(err);
        }
      },
    );
  });
}

// ===========================================================================
// Receipt
// ===========================================================================

/**
 * Build the install receipt. The receipt covers BOTH freshly-installed
 * mods AND mods carried forward from the previous release (H1 fix):
 * orphan-keep choices and diverged-keep-existing choices both produce
 * `CarriedModReportEntry`s that we fold into `receipt.mods`.
 *
 * Without this, the next release's resolver would lose lineage tags
 * for kept mods and miss them in orphan detection.
 *
 * Ordering: installed mods first (in install order), carried mods
 * after. Both buckets share the same on-disk shape; the receipt does
 * not distinguish them — it only describes "what this collection
 * currently controls on this machine."
 */
function buildReceipt(args: {
  ctx: DriverContext;
  profileId: string;
  profileName: string;
  installedMods: InstalledModReportEntry[];
  carriedMods: CarriedModReportEntry[];
  rulesApplication: RulesApplicationReceipt;
  userlistApplication: UserlistApplicationReceipt;
}): InstallReceipt {
  const {
    ctx,
    profileId,
    profileName,
    installedMods,
    carriedMods,
    rulesApplication,
    userlistApplication,
  } = args;
  const { manifest } = ctx.plan;
  const now = new Date().toISOString();

  const modEntries: InstallReceiptMod[] = [];

  for (const m of installedMods) {
    modEntries.push({
      vortexModId: m.vortexModId,
      compareKey: m.compareKey,
      source: m.source,
      name: m.name,
      installedAt: now,
    });
  }

  for (const c of carriedMods) {
    modEntries.push({
      vortexModId: c.vortexModId,
      compareKey: c.compareKey,
      source: c.source,
      name: c.name,
      // Carried mods were installed by a previous release; we keep the
      // current release's `installedAt` for simplicity (the receipt's
      // own `installedAt` is "when this receipt was written," not "when
      // each mod was installed"). A future schema bump may add a real
      // per-mod history field — for v1 this is good enough for orphan
      // detection, which only cares about compareKey membership.
      installedAt: now,
    });
  }

  return {
    schemaVersion: INSTALL_LEDGER_SCHEMA_VERSION,
    packageId: manifest.package.id,
    packageVersion: manifest.package.version,
    packageName: manifest.package.name,
    gameId: manifest.game.id as SupportedGameId,
    installedAt: now,
    vortexProfileId: profileId,
    vortexProfileName: profileName,
    installTargetMode: ctx.plan.installTarget.kind,
    mods: modEntries,
    rulesApplication,
    userlistApplication,
  };
}

/**
 * Atomic write the receipt with one transient retry. Real failure
 * modes we've observed in Vortex extensions:
 *   - antivirus briefly locks the temp file (clears in <100ms)
 *   - filesystem stutters during heavy parallel I/O
 *
 * Both clear on a quick second attempt. Two attempts is the right
 * number: it covers the transient window without masking real
 * permanent failures behind a long retry loop.
 *
 * Permanent failures (ENOENT for missing parent dir, ENOSPC, EROFS,
 * EACCES on a perm-mismatched path) will not improve on retry — we
 * surface them immediately so the user gets a fast, actionable
 * error instead of a 250ms-delayed copy of the same one.
 *
 * {@link InstallLedgerError} is also non-retryable: it's our own
 * structured error type, raised when the receipt itself is invalid
 * (schema mismatch, programmer bug). Retrying would just hit the
 * same validation code path.
 */
async function writeReceiptWithRetry(
  appDataPath: string,
  receipt: InstallReceipt,
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= RECEIPT_WRITE_ATTEMPTS; attempt++) {
    try {
      const { path: writtenPath } = await writeReceipt(appDataPath, receipt);
      return writtenPath;
    } catch (err) {
      lastErr = err;
      if (attempt < RECEIPT_WRITE_ATTEMPTS && isTransientReceiptError(err)) {
        await delay(RECEIPT_WRITE_RETRY_DELAY_MS);
      } else {
        // Either the last attempt or a non-transient error — fail fast.
        throw lastErr;
      }
    }
  }
  throw lastErr;
}

/**
 * Decide whether a receipt-write error is worth retrying. We only
 * retry codes that have a track record of being caused by transient
 * external interference (AV scanners, parallel I/O, briefly-held
 * locks). Everything else (missing dir, permission denied on the
 * actual target, disk full, ledger validation failure) won't improve
 * by waiting and is surfaced immediately.
 */
function isTransientReceiptError(err: unknown): boolean {
  if (err instanceof InstallLedgerError) return false;

  const code = (err as NodeJS.ErrnoException | undefined)?.code;
  if (typeof code !== "string") return false;

  // EBUSY    — Windows file lock (AV / explorer.exe / OneDrive)
  // EPERM    — Windows "operation not permitted" while another
  //            process has a handle (often AV-related)
  // EAGAIN   — POSIX "try again", file system busy
  // EMFILE / ENFILE — too many open file descriptors transiently
  // ENOTEMPTY — lingering tmp dir contents from a prior write that
  //             the OS hasn't fully GC'd yet
  return (
    code === "EBUSY" ||
    code === "EPERM" ||
    code === "EAGAIN" ||
    code === "EMFILE" ||
    code === "ENFILE" ||
    code === "ENOTEMPTY"
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build a Map<compareKey, EhcollMod> for fast lookup. The resolver
 * enforces unique compareKeys per manifest, so collisions cannot
 * happen in valid manifests; we trust that and last-write wins on
 * the rare bad input (parseManifest would have rejected it earlier).
 */
function buildManifestIndex(mods: EhcollMod[]): Map<string, EhcollMod> {
  const map = new Map<string, EhcollMod>();
  for (const m of mods) map.set(m.compareKey, m);
  return map;
}

/**
 * Build a CarriedModReportEntry for an orphaned mod the user chose
 * to keep. The orphan retains its previous-release lineage; we do
 * NOT enable it (the user said "keep" meaning "leave alone").
 *
 * Source kind is inferred from Vortex state — Nexus mods carry
 * `attributes.modId`, others are treated as external. The receipt's
 * `source` field is UI-only, so a mis-classification here is
 * cosmetic.
 */
function buildOrphanCarriedEntry(
  api: types.IExtensionApi,
  plan: DriverContext["plan"],
  orphan: OrphanedModDecision,
): CarriedModReportEntry {
  return {
    vortexModId: orphan.existingModId,
    name: orphan.name,
    source: inferModSource(api, plan.manifest.game.id, orphan.existingModId),
    reason: "orphan-keep",
    compareKey: orphan.originalCompareKey,
    installedFromVersion: orphan.installedFromVersion,
    enabledInProfile: false,
  };
}

function inferModSource(
  api: types.IExtensionApi,
  gameId: string,
  modId: string,
): "nexus" | "external" {
  const state = api.getState();
  const mod = (state as unknown as {
    persistent?: { mods?: Record<string, Record<string, {
      attributes?: { modId?: unknown; source?: unknown };
    }>> };
  }).persistent?.mods?.[gameId]?.[modId];
  if (!mod) return "external";
  const attrs = mod.attributes ?? {};
  if (attrs.modId !== undefined && attrs.modId !== null) return "nexus";
  if (typeof attrs.source === "string" && attrs.source.toLowerCase() === "nexus") {
    return "nexus";
  }
  return "external";
}

// ===========================================================================
// Misc
// ===========================================================================

function describeDecision(
  decision: ModDecision,
  decisions: UserConfirmedDecisions,
): string {
  switch (decision.kind) {
    case "nexus-download":
      return "downloading from Nexus";
    case "nexus-use-local-download":
      return "installing from local download";
    case "nexus-already-installed":
      return "re-using existing installed mod";
    case "external-use-bundled":
      return "extracting + installing bundled archive";
    case "external-use-local-download":
      return "installing from local download";
    case "external-already-installed":
      return "re-using existing installed mod";
    case "nexus-version-diverged":
    case "nexus-bytes-diverged":
    case "external-bytes-diverged": {
      // We don't have the compareKey here, so the caller surfaces a
      // generic label. For prettier UX the action layer can re-render
      // its own message.
      return decision.kind;
    }
    case "external-prompt-user":
      return "external-prompt-user (using user-supplied file)";
    default:
      return decision.kind;
  }
  // `decisions` is here for forward extensibility (slice 6c may
  // surface choice details in the progress message); consumed via
  // unused parameter.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  decisions;
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return JSON.stringify(err);
}

function assertNever(value: never): never {
  throw new Error(`Unexpected decision kind: ${JSON.stringify(value)}`);
}

/**
 * Check whether a manifest entry is a Nexus mod (narrowing helper
 * for callers; kept here so we don't import the discriminator
 * helper from elsewhere).
 *
 * Currently unused publicly; reserved for slice 6c.
 */
export function isNexusEhcollMod(mod: EhcollMod): mod is NexusEhcollMod {
  return mod.source.kind === "nexus";
}

// Used to preserve the EhcollManifest import for type tooling.
export type _EhcollManifestRef = EhcollManifest;

// ===========================================================================
// Slice 6c helpers — modId resolution maps + rules-application bookkeeping
// ===========================================================================

/**
 * Build the compareKey → vortex modId map used by both `applyModRules`
 * and `applyLoadOrder`. Sources, last-write-wins:
 *  1. `installedMods` — freshly-installed AND already-installed re-uses
 *     (the `*-already-installed` decision arms produce entries here).
 *  2. `carriedMods` — diverged-keep-existing (existing user mod kept)
 *     and orphan-keep (previous-release mod kept).
 *
 * Last-write-wins is fine: a single compareKey can appear at most once
 * across both lists by construction (the resolver enforces unique
 * compareKeys per plan).
 */
function buildPostInstallModIdMap(
  installedMods: InstalledModReportEntry[],
  carriedMods: CarriedModReportEntry[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of installedMods) map.set(m.compareKey, m.vortexModId);
  for (const c of carriedMods) map.set(c.compareKey, c.vortexModId);
  return map;
}

/**
 * Build vortex modId → display name. Used by `applyLoadOrder` to
 * populate `ILoadOrderEntry_2.name` (Vortex's array shape requires a
 * display name). We pull from the same install + carry buckets the
 * compareKey map uses so the display matches what the install
 * summary will show.
 */
function buildDisplayNameByModId(
  installedMods: InstalledModReportEntry[],
  carriedMods: CarriedModReportEntry[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of installedMods) map.set(m.vortexModId, m.name);
  for (const c of carriedMods) map.set(c.vortexModId, c.name);
  return map;
}

/**
 * Build the partial-Nexus-pin resolution map. For every Nexus-source
 * mod in the install/carry buckets, look up the underlying Vortex mod
 * record and index by `attributes.modId` (the Nexus mod id).
 *
 * Multiple installed files for the same Nexus modId would collide
 * here; last-write-wins matches what `applyModRules` documents
 * (curator intent is fuzzy by construction when they only pinned the
 * modId without a fileId).
 */
function buildNexusModIdMap(
  api: types.IExtensionApi,
  gameId: string,
  installedMods: InstalledModReportEntry[],
  carriedMods: CarriedModReportEntry[],
): Map<string, string> {
  const map = new Map<string, string>();
  const state = api.getState();
  const modsForGame = (
    state as unknown as {
      persistent?: {
        mods?: Record<
          string,
          Record<string, { attributes?: { modId?: unknown } }>
        >;
      };
    }
  ).persistent?.mods?.[gameId];
  if (!modsForGame) return map;

  const collect = (vortexModId: string, source: "nexus" | "external"): void => {
    if (source !== "nexus") return;
    const record = modsForGame[vortexModId];
    const nexusModId = record?.attributes?.modId;
    if (typeof nexusModId === "number") {
      map.set(String(nexusModId), vortexModId);
    } else if (typeof nexusModId === "string" && nexusModId.length > 0) {
      map.set(nexusModId, vortexModId);
    }
  };

  for (const m of installedMods) collect(m.vortexModId, m.source);
  for (const c of carriedMods) collect(c.vortexModId, c.source);

  return map;
}

/**
 * Walk Vortex's mod-rules state for every source mod in the rule
 * targets and return an `ExistingRule[]` projection keyed by source
 * vortex modId. This is what `applyModRules` consumes for the
 * collection-wins conflict pass.
 *
 * We only collect rules for mods we're *about* to add a rule on
 * (i.e. mods present in `modIdByCompareKey`). Pulling the entire
 * mod table would be wasteful for large profiles.
 */
function collectExistingRules(
  api: types.IExtensionApi,
  gameId: string,
  modIdByCompareKey: ReadonlyMap<string, string>,
): Map<string, ExistingRule[]> {
  const out = new Map<string, ExistingRule[]>();
  const state = api.getState();
  const modsForGame = (
    state as unknown as {
      persistent?: {
        mods?: Record<
          string,
          Record<
            string,
            {
              rules?: Array<{
                type?: unknown;
                reference?: {
                  id?: unknown;
                  repo?: { modId?: unknown; fileId?: unknown };
                  archiveId?: unknown;
                };
              }>;
            }
          >
        >;
      };
    }
  ).persistent?.mods?.[gameId];
  if (!modsForGame) return out;

  const sourceModIds = new Set(modIdByCompareKey.values());
  for (const sourceModId of sourceModIds) {
    const record = modsForGame[sourceModId];
    const rawRules = record?.rules ?? [];
    if (rawRules.length === 0) continue;

    const projected: ExistingRule[] = [];
    for (const r of rawRules) {
      if (typeof r.type !== "string") continue;
      const ref = r.reference ?? {};
      projected.push({
        type: r.type,
        reference: {
          id: typeof ref.id === "string" ? ref.id : undefined,
          repo:
            ref.repo &&
            typeof ref.repo === "object" &&
            ref.repo !== null
              ? {
                  modId:
                    typeof ref.repo.modId === "string"
                      ? ref.repo.modId
                      : undefined,
                  fileId:
                    typeof ref.repo.fileId === "string"
                      ? ref.repo.fileId
                      : undefined,
                }
              : undefined,
          archiveId:
            typeof ref.archiveId === "string" ? ref.archiveId : undefined,
        },
      });
    }
    if (projected.length > 0) {
      out.set(sourceModId, projected);
    }
  }

  return out;
}

/**
 * Initial empty value for the rules-application receipt. The driver
 * mutates this incrementally as each phase completes; the final
 * value lands in the receipt.
 */
function emptyRulesApplication(): RulesApplicationReceipt {
  return {
    appliedRuleCount: 0,
    overwrittenUserRuleCount: 0,
    skippedRules: [],
    appliedLoadOrderCount: 0,
    skippedLoadOrderEntries: [],
    baselinePluginOrder: [],
  };
}

function mergeRuleResult(
  base: RulesApplicationReceipt,
  ruleResult: ApplyModRulesResult,
): RulesApplicationReceipt {
  return {
    ...base,
    appliedRuleCount: base.appliedRuleCount + ruleResult.applied,
    overwrittenUserRuleCount:
      base.overwrittenUserRuleCount + ruleResult.overwrittenUserRules,
    skippedRules: [
      ...base.skippedRules,
      ...ruleResult.skipped.map((s) => ({
        ruleType: s.type,
        source: s.source,
        reference: s.reference,
        reason: s.reason,
      })),
    ],
  };
}

function mergeLoadOrderResult(
  base: RulesApplicationReceipt,
  loResult: ApplyLoadOrderResult,
): RulesApplicationReceipt {
  return {
    ...base,
    appliedLoadOrderCount: base.appliedLoadOrderCount + loResult.applied,
    skippedLoadOrderEntries: [
      ...base.skippedLoadOrderEntries,
      ...loResult.skipped.map((s) => ({
        compareKey: s.compareKey,
        pos: s.pos,
        reason: s.reason,
      })),
    ],
  };
}

// ===========================================================================
// Slice 6d — userlist-application bookkeeping
// ===========================================================================

/**
 * Initial empty value for the userlist-application receipt. Merged
 * incrementally as `applyUserlist` returns.
 */
function emptyUserlistApplication(): UserlistApplicationReceipt {
  return {
    appliedRuleCount: 0,
    appliedGroupAssignmentCount: 0,
    overwrittenGroupAssignmentCount: 0,
    appliedNewGroupCount: 0,
    appliedGroupRuleCount: 0,
    skippedUserlistEntries: [],
  };
}

function mergeUserlistResult(
  base: UserlistApplicationReceipt,
  ulResult: ApplyUserlistResult,
): UserlistApplicationReceipt {
  return {
    appliedRuleCount: base.appliedRuleCount + ulResult.appliedRuleCount,
    appliedGroupAssignmentCount:
      base.appliedGroupAssignmentCount + ulResult.appliedGroupAssignmentCount,
    overwrittenGroupAssignmentCount:
      base.overwrittenGroupAssignmentCount +
      ulResult.overwrittenGroupAssignmentCount,
    appliedNewGroupCount:
      base.appliedNewGroupCount + ulResult.appliedNewGroupCount,
    appliedGroupRuleCount:
      base.appliedGroupRuleCount + ulResult.appliedGroupRuleCount,
    skippedUserlistEntries: [
      ...base.skippedUserlistEntries,
      ...ulResult.skipped.map((s) => ({
        kind: s.kind,
        subject: s.subject,
        ruleKind: s.ruleKind,
        reference: s.reference,
        reason: s.reason,
      })),
    ],
  };
}
