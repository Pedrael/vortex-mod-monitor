/**
 * Vortex per-game LoadOrder application — Phase 3 slice 6c.
 *
 * Translates the manifest's `EhcollLoadOrderEntry[]` (compareKey-keyed
 * curator capture) into Vortex's per-game LoadOrder shape and
 * dispatches the redux action that owns
 * `state.persistent.loadOrder[gameId]`.
 *
 * ─── DESIGN NOTES ──────────────────────────────────────────────────────
 *
 * Distinct from plugins.txt:
 *   - plugins.txt covers ESPs/ESMs/ESLs only — Bethesda's plugin engine
 *     reads it directly. Vortex's gamebryo-plugin-management owns it.
 *   - LoadOrder covers EVERY mod Vortex manages (script extenders, ENB
 *     binaries, non-plugin payloads, generic-game mods on titles like
 *     Starfield that don't use plugins.txt at all). Vortex's generic
 *     LoadOrder API owns it.
 *
 * Why we apply BOTH (one for each axis they cover):
 *   - Bethesda games may have both kinds simultaneously. plugins.txt
 *     tells the GAME the order; LoadOrder tells VORTEX the deploy
 *     order for non-plugin mods that still conflict at filesystem
 *     level (e.g. two ENB presets shipping the same .ini).
 *   - For games that only use the LoadOrder API (Starfield), this is
 *     the sole sequencing source.
 *
 * Strategy ("rules-only" — locked design choice):
 *   We do NOT attempt to enforce a frozen plugins.txt. The user is
 *   free to add their own mods on top of the collection; LOOT (or
 *   Vortex's auto-sort) will then re-order using the curator's mod
 *   rules + the user's local LOOT masterlist. The manifest's
 *   plugins.order is still written (it's the seed Vortex's plugin
 *   manager picks up), but slight LOOT drift is expected.
 *
 * Conflict policy:
 *   The user's pre-existing LoadOrder for the active game is REPLACED
 *   by ours. This matches the "fresh-profile by default" install
 *   model — when the install lands in a brand-new profile (the
 *   common case), there's nothing to conflict with. In current-profile
 *   mode we still replace, because the user already saw the conflict
 *   summary at plan time and chose to proceed.
 *
 * INVARIANTS:
 *   - This module never reads from Vortex state. The caller passes
 *     the post-install compareKey → modId map, exactly like
 *     `applyModRules`.
 *   - Manifest entries whose compareKey can't be resolved to a vortex
 *     modId are dropped with a recorded reason. Position numbering is
 *     densified after the drop so the resulting LoadOrder is a
 *     contiguous 0..N-1 sequence.
 *   - All dispatches are best-effort. Failure logs and surfaces a
 *     skipped-entry record; the install never aborts on LoadOrder.
 * ──────────────────────────────────────────────────────────────────────
 */

import { actions, types } from "vortex-api";

import type { EhcollLoadOrderEntry } from "../../types/ehcoll";

export type ApplyLoadOrderInput = {
  api: types.IExtensionApi;
  gameId: string;
  entries: EhcollLoadOrderEntry[];
  /**
   * compareKey → vortex modId. Same map shape `applyModRules` uses;
   * the driver builds it once and passes it to both phases.
   */
  modIdByCompareKey: ReadonlyMap<string, string>;
  /**
   * vortex modId → display name. Used to populate `ILoadOrderEntry_2.name`
   * (Vortex's modern array shape requires it). Missing entries fall
   * back to the modId as the display name.
   */
  displayNameByModId?: ReadonlyMap<string, string>;
  signal?: AbortSignal;
};

export type ApplyLoadOrderResult = {
  /** Number of entries successfully written to Vortex's LoadOrder. */
  applied: number;
  /** Manifest entries we couldn't apply, with reason. */
  skipped: SkippedLoadOrderEntry[];
};

export type SkippedLoadOrderEntry = {
  compareKey: string;
  pos: number;
  reason: string;
};

class AbortError extends Error {
  constructor() {
    super("Aborted");
    this.name = "AbortError";
  }
}

/**
 * Build the user-side LoadOrder payload from the manifest entries and
 * dispatch `actions.setLoadOrder` once. Returns a summary the driver
 * attaches to the receipt.
 *
 * No-ops cleanly for empty manifests — Vortex's LoadOrder for the
 * game is left untouched. We never write `{}` over an existing order.
 */
export function applyLoadOrder(
  input: ApplyLoadOrderInput,
): ApplyLoadOrderResult {
  const result: ApplyLoadOrderResult = {
    applied: 0,
    skipped: [],
  };

  if (input.entries.length === 0) return result;

  if (input.signal?.aborted) throw new AbortError();

  // Sort defensively — the manifest is supposed to be densely numbered
  // 0..N-1 already, but a hand-edited file might not be.
  const sorted = [...input.entries].sort((a, b) => a.pos - b.pos);

  // Vortex's modern `setLoadOrder` action takes an ARRAY in
  // load-order order. The ILoadOrderEntry_2 shape (per
  // node_modules/vortex-api/lib/api.d.ts) is:
  //   { id: string, enabled: boolean, name: string,
  //     locked?: LockedState, modId?: string }
  // We populate `id` AND `modId` with the vortex modId — most games
  // use them interchangeably; `id` is the load-order entry id, and
  // setting `modId` keeps the link to the underlying Vortex mod
  // record explicit. `name` falls back to the modId when no display
  // name was supplied.
  const payload: Array<{
    id: string;
    enabled: boolean;
    name: string;
    modId: string;
    locked?: "true" | "false";
  }> = [];

  for (const entry of sorted) {
    const modId = input.modIdByCompareKey.get(entry.compareKey);
    if (modId === undefined) {
      result.skipped.push({
        compareKey: entry.compareKey,
        pos: entry.pos,
        reason:
          `Entry's mod is not present in the post-install state. ` +
          `(The mod was skipped, removed, or never installed.)`,
      });
      continue;
    }

    const name = input.displayNameByModId?.get(modId) ?? modId;
    payload.push({
      id: modId,
      enabled: entry.enabled,
      name,
      modId,
      ...(entry.locked === true ? { locked: "true" as const } : {}),
    });
    result.applied += 1;
  }

  if (result.applied === 0) {
    // Every entry was skipped. Don't dispatch — leave the user's
    // LoadOrder as-is. The skipped[] list still surfaces in the
    // receipt for the post-install report.
    return result;
  }

  try {
    // `actions.setLoadOrder` is `(gameId: string, order: any[])` in
    // the published typings. The cast keeps us source-compatible with
    // older Vortex builds where the signature was wrapped.
    const setLoadOrderAction = (
      actions as unknown as {
        setLoadOrder?: (gameId: string, order: unknown[]) => unknown;
      }
    ).setLoadOrder;

    if (typeof setLoadOrderAction !== "function") {
      // Older Vortex builds — gracefully degrade. Mark every applied
      // entry as skipped instead of silently losing the data.
      for (const entry of sorted) {
        const modId = input.modIdByCompareKey.get(entry.compareKey);
        if (modId !== undefined) {
          result.skipped.push({
            compareKey: entry.compareKey,
            pos: entry.pos,
            reason:
              "Vortex's setLoadOrder action is not exposed in this build. " +
              "LoadOrder payload was prepared but not dispatched.",
          });
        }
      }
      result.applied = 0;
      return result;
    }

    input.api.store?.dispatch(
      setLoadOrderAction(input.gameId, payload) as never,
    );
  } catch (err) {
    // Couldn't dispatch the whole thing — record every applied entry
    // as skipped and return so the receipt is honest about what
    // landed and what didn't.
    const reason =
      `Vortex rejected setLoadOrder dispatch: ` +
      (err instanceof Error ? err.message : String(err));
    for (const entry of sorted) {
      const modId = input.modIdByCompareKey.get(entry.compareKey);
      if (modId !== undefined) {
        result.skipped.push({
          compareKey: entry.compareKey,
          pos: entry.pos,
          reason,
        });
      }
    }
    result.applied = 0;
  }

  return result;
}
