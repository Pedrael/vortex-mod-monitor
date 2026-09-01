/**
 * ──────────────────────────────────────────────────────────────────────
 * Doing the repair.
 *
 * Every cure here re-runs a step of the install pipeline, using the SAME
 * function the install used. That is the point: a second implementation of
 * "apply the collection's rules" would drift from the first, and the whole
 * promise of this feature is that healing puts the machine back into a state
 * the installer would have produced.
 *
 * ─── REINSTALL IS A HANDOFF, NOT A REIMPLEMENTATION ────────────────────
 * Five of the six are single calls. `reinstall-mods` is not: it needs a
 * resolved install plan, conflict decisions, download retries, extraction
 * budgets and the stall watchdog — the entire driver. Rebuilding a small
 * version of that here would be a second install path, and this repo has
 * already learned three separate times what happens when two install routes
 * exist and only one gets a fix.
 *
 * So it hands the package to the installer the user already has. That flow is
 * idempotent — mods already correct are skipped — so "reinstall the 3 that
 * changed" and "run the installer again" are the same operation, and only one
 * of them needs maintaining.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { types } from "@nexusmods/vortex-api";

import type { EhcollManifest } from "../../types/ehcoll";
import type { InstallReceipt } from "../../types/installLedger";
import { rebuildPluginOrder } from "./heal";
import type { HealAction } from "./health";

export type HealOutcome =
  /** Done. `summary` is shown to the user. */
  | { kind: "done"; summary: string }
  /** Open the installer on this package — see the header. */
  | { kind: "handoff"; ehcollPath: string; summary: string }
  /** Could not run, and why. Never a silent no-op. */
  | { kind: "blocked"; reason: string };

export interface RunHealDeps {
  api: types.IExtensionApi;
  gameId: string;
  receipt: InstallReceipt;
  /** Present only when the `.ehcoll` was found and read. */
  manifest?: EhcollManifest;
  ehcollPath?: string;
  signal?: AbortSignal;
}

/**
 * Maps `applyModRules` needs to resolve the manifest's rule references.
 *
 * Built from the RECEIPT rather than from Vortex's current mod list: the
 * receipt says which mod ids this collection installed, so a rule cannot
 * accidentally be applied to a mod the user installed themselves that happens
 * to share a Nexus id.
 */
function resolveModMaps(receipt: InstallReceipt): {
  modIdByCompareKey: Map<string, string>;
  modIdByNexusModId: Map<string, string>;
  ambiguousNexusModIds: Set<string>;
} {
  const modIdByCompareKey = new Map<string, string>();
  const modIdByNexusModId = new Map<string, string>();
  const seenNexusIds = new Map<string, number>();

  for (const mod of receipt.mods) {
    modIdByCompareKey.set(mod.compareKey, mod.vortexModId);
    const parts = mod.compareKey.split(":");
    if (parts[0] !== "nexus" || parts[1] === undefined) continue;
    const nexusModId = parts[1];
    modIdByNexusModId.set(nexusModId, mod.vortexModId);
    seenNexusIds.set(nexusModId, (seenNexusIds.get(nexusModId) ?? 0) + 1);
  }

  // A partial pin naming one of these cannot be resolved — the map holds
  // whichever came last, and resolving a conflict rule onto the wrong variant
  // silently reverses the conflict it was meant to settle.
  const ambiguousNexusModIds = new Set(
    [...seenNexusIds.entries()].filter(([, n]) => n > 1).map(([id]) => id),
  );

  return { modIdByCompareKey, modIdByNexusModId, ambiguousNexusModIds };
}

export async function runHeal(
  action: HealAction,
  deps: RunHealDeps,
): Promise<HealOutcome> {
  const { api, gameId, receipt } = deps;

  switch (action) {
    case "switch-profile": {
      const { switchToProfile } = await import("../installer/profile");
      await switchToProfile(api, receipt.vortexProfileId, deps.signal);
      return {
        kind: "done",
        summary: `Switched to ${receipt.vortexProfileName}.`,
      };
    }

    case "enable-mods": {
      const { enableModInProfile } = await import("../installer/profile");
      let enabled = 0;
      for (const mod of receipt.mods) {
        enableModInProfile(api, receipt.vortexProfileId, mod.vortexModId);
        enabled += 1;
      }
      return {
        kind: "done",
        summary: `Re-enabled ${enabled} mod${enabled === 1 ? "" : "s"} in ${receipt.vortexProfileName}.`,
      };
    }

    case "repin-plugin-order": {
      const recorded = receipt.rulesApplication?.baselinePluginOrder;
      if (recorded === undefined || recorded.length === 0) {
        // The check that offers this button requires a baseline, so reaching
        // here means the receipt changed underneath us. Say so rather than
        // pinning an empty order, which would clear plugins.txt.
        return {
          kind: "blocked",
          reason:
            "This receipt did not record a plugin order, so there is nothing " +
            "to restore.",
        };
      }
      const [{ readUserPluginsTxt }, { applyPluginOrder }] = await Promise.all([
        import("../installer/checkPluginOrder"),
        import("../installer/applyPluginOrder"),
      ]);
      const current = (await readUserPluginsTxt(gameId)) ?? [];
      // Names only. The receipt's own enabled flags are dropped on purpose:
      // they describe install time, and re-pinning with them would undo every
      // plugin the user has toggled since.
      const order = rebuildPluginOrder(
        recorded.map((e) => e.name),
        current,
      );
      const result = await applyPluginOrder({
        api,
        gameId,
        collectionId: receipt.packageId,
        order,
        ...(deps.signal !== undefined ? { signal: deps.signal } : {}),
      });
      // applyPluginOrder never throws — a load order it could not set is a
      // worse outcome, not an exception — so the outcome has to be read out
      // of the result rather than assumed from the absence of a throw.
      return result.written || result.pinned
        ? {
            kind: "done",
            summary: `Restored the recorded order for ${order.length} plugins.`,
          }
        : {
            kind: "blocked",
            reason:
              result.notes.length > 0
                ? `Vortex would not set the plugin order: ${result.notes.join("; ")}.`
                : "Vortex did not apply the plugin order.",
          };
    }

    case "reapply-rules": {
      if (deps.manifest === undefined) {
        return { kind: "blocked", reason: MISSING_PACKAGE };
      }
      const { applyModRules } = await import("../installer/applyModRules");
      const maps = resolveModMaps(receipt);
      const result = applyModRules({
        api,
        gameId,
        rules: deps.manifest.rules ?? [],
        modIdByCompareKey: maps.modIdByCompareKey,
        modIdByNexusModId: maps.modIdByNexusModId,
        ambiguousNexusModIds: maps.ambiguousNexusModIds,
      });
      return {
        kind: "done",
        summary: `Re-applied ${result.applied} of ${
          deps.manifest.rules?.length ?? 0
        } collection rules.`,
      };
    }

    case "reapply-userlist": {
      if (deps.manifest === undefined) {
        return { kind: "blocked", reason: MISSING_PACKAGE };
      }
      const userlist = deps.manifest.userlist;
      if (userlist === undefined) {
        return {
          kind: "blocked",
          reason: "This collection did not record any LOOT rules.",
        };
      }
      const { applyUserlist } = await import("../installer/applyUserlist");
      const result = applyUserlist({
        api,
        userlist,
        ...(deps.signal !== undefined ? { signal: deps.signal } : {}),
      });
      return {
        kind: "done",
        summary: `Re-applied ${result.appliedRuleCount} LOOT plugin rules.`,
      };
    }

    case "reinstall-mods": {
      if (deps.ehcollPath === undefined) {
        return { kind: "blocked", reason: MISSING_PACKAGE };
      }
      return {
        kind: "handoff",
        ehcollPath: deps.ehcollPath,
        summary:
          "Opening the installer on this collection. Mods that are already " +
          "correct are skipped, so only what changed gets reinstalled.",
      };
    }
  }
}

const MISSING_PACKAGE =
  "This repair re-runs a step that reads the collection itself, and the " +
  ".ehcoll file could not be found. Point at it to continue.";
