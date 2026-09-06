/**
 * Read the current state of the machine, so {@link evaluateHealth} can compare
 * it against the receipt.
 *
 * All the I/O and all the Vortex-shape guessing lives here, which is what
 * keeps the diagnosis itself pure and testable. The split is the point: this
 * file is hard to test and easy to reason about, the other one is the reverse.
 *
 * ─── EVERY READ FAILS SOFT, AND SAYS SO ────────────────────────────────
 * A reader that throws would take the whole health check down over one
 * unfamiliar state shape. A reader that returns a plausible-looking default
 * would be worse: `0` rules present reads as "all your rules are gone", which
 * is a false alarm that sends someone re-applying rules they never lost.
 *
 * So every field is `| undefined`, and `undefined` means "could not read this"
 * — which the checks render as `unknown` rather than as a pass or a failure.
 * That is the whole reason HealthStatus has five states.
 */

import type { types } from "@nexusmods/vortex-api";

import { beginOp, ehLog } from "../logging/ehLog";
import type { HealthObservations } from "./health";

/** Profiles that exist for a game, by id. */
function readProfileIds(state: unknown, gameId: string): string[] {
  const profiles = (
    state as {
      persistent?: { profiles?: Record<string, { gameId?: string }> };
    }
  )?.persistent?.profiles;
  if (profiles === null || typeof profiles !== "object") return [];
  return Object.entries(profiles)
    .filter(([, p]) => p?.gameId === gameId)
    .map(([id]) => id);
}

function readInstalledModIds(state: unknown, gameId: string): string[] {
  const mods = (
    state as { persistent?: { mods?: Record<string, Record<string, unknown>> } }
  )?.persistent?.mods?.[gameId];
  if (mods === null || typeof mods !== "object" || mods === undefined) return [];
  return Object.keys(mods);
}

/**
 * Mods enabled in a specific profile.
 *
 * Note this reads the RECEIPT's profile, not the active one. A collection
 * installed into its own profile is still perfectly healthy while the user is
 * looking at a different profile — that is a separate check, and conflating
 * them would report every mod as disabled the moment someone switched away.
 */
function readEnabledModIds(state: unknown, profileId: string): string[] {
  const modState = (
    state as {
      persistent?: {
        profiles?: Record<string, { modState?: Record<string, { enabled?: boolean }> }>;
      };
    }
  )?.persistent?.profiles?.[profileId]?.modState;
  if (modState === null || typeof modState !== "object" || modState === undefined) {
    return [];
  }
  return Object.entries(modState)
    .filter(([, v]) => v?.enabled === true)
    .map(([id]) => id);
}

/** Total mod rules currently set for a game, across every mod. */
function countModRules(state: unknown, gameId: string): number | undefined {
  const mods = (
    state as {
      persistent?: { mods?: Record<string, Record<string, { rules?: unknown[] }>> };
    }
  )?.persistent?.mods?.[gameId];
  if (mods === null || typeof mods !== "object" || mods === undefined) {
    return undefined;
  }
  let total = 0;
  for (const mod of Object.values(mods)) {
    if (Array.isArray(mod?.rules)) total += mod.rules.length;
  }
  return total;
}

export interface GatherOptions {
  api: types.IExtensionApi;
  gameId: string;
  /** The profile the receipt says the collection lives in. */
  receiptProfileId: string;
  /**
   * Compare keys whose staging folders drifted, from a deep scan.
   *
   * Omitted on the cheap pass. Left `undefined` rather than `[]` because an
   * empty array means "checked, nothing drifted" and that is a much stronger
   * claim than "did not look".
   */
  driftedCompareKeys?: readonly string[];
}

/**
 * Everything the checks need, read from Vortex and disk.
 *
 * Cheap by default: the only I/O is one plugins.txt read. The expensive part —
 * hashing every mod's files — is passed in by the caller when the user asks
 * for it.
 */
export async function gatherObservations(
  opts: GatherOptions,
): Promise<HealthObservations> {
  const { api, gameId, receiptProfileId } = opts;
  const op = beginOp("doctor.gather", {
    gameId,
    receiptProfileId,
    deepScan: opts.driftedCompareKeys !== undefined,
  });
  const state = api.getState();

  const [{ getActiveProfileId }, { readUserPluginsTxt }, { captureUserlist }] =
    await Promise.all([
      import("../getModsListForProfile"),
      import("../installer/checkPluginOrder"),
      import("../userlist"),
    ]);

  // Keeps `enabled`. Flattening to names here is what forced the health
  // check to compare positions blind and call every healthy install drifted.
  let currentPluginOrder: { name: string; enabled: boolean }[] | undefined;
  try {
    // Store-aware: a GOG Skyrim SE keeps plugins.txt under a different
    // folder, and reading the Steam name reports an empty order as though
    // the game simply had none.
    const { discoveredStore } = await import("../comparePlugins");
    const entries = await readUserPluginsTxt(gameId, discoveredStore(state, gameId));
    // undefined means "this game has no plugins.txt", which the check renders
    // as not-applicable rather than as a problem.
    currentPluginOrder = entries?.map((e) => ({ name: e.name, enabled: e.enabled }));
  } catch (err) {
    // Swallowed on purpose (see file header) — but silence here is exactly
    // what makes "no plugins.txt" indistinguishable from "could not read it".
    ehLog("debug", "doctor.gather.plugins-txt-unreadable", { gameId, err });
    currentPluginOrder = undefined;
  }

  let currentUserlistRuleCount: number | undefined;
  try {
    const captured = captureUserlist(state);
    // Count PLUGIN entries, matching what the install records as
    // userlistApplication.appliedRuleCount. Counting groups too would compare
    // two different numbers and report permanent drift.
    currentUserlistRuleCount = captured.plugins.length;
  } catch (err) {
    ehLog("debug", "doctor.gather.userlist-unreadable", { err });
    currentUserlistRuleCount = undefined;
  }

  let activeProfileId: string | undefined;
  try {
    activeProfileId = getActiveProfileId(state);
  } catch (err) {
    ehLog("debug", "doctor.gather.active-profile-unreadable", { err });
    activeProfileId = undefined;
  }

  const observations: HealthObservations = {
    existingProfileIds: readProfileIds(state, gameId),
    activeProfileId,
    installedModIds: readInstalledModIds(state, gameId),
    enabledModIds: readEnabledModIds(state, receiptProfileId),
    driftedCompareKeys: opts.driftedCompareKeys,
    currentPluginOrder,
    currentModRuleCount: countModRules(state, gameId),
    currentUserlistRuleCount,
  };
  op.ok({
    profiles: observations.existingProfileIds.length,
    installedMods: observations.installedModIds.length,
    enabledMods: observations.enabledModIds.length,
    driftedCompareKeys: observations.driftedCompareKeys?.length,
    pluginOrderEntries: observations.currentPluginOrder?.length,
    modRules: observations.currentModRuleCount,
    userlistRules: observations.currentUserlistRuleCount,
  });
  return observations;
}
