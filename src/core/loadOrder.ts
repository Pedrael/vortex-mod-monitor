import type { types } from "@nexusmods/vortex-api";

import { ehLog } from "./logging/ehLog";

/**
 * One entry from Vortex's per-game LoadOrder structure
 * (`state.persistent.loadOrder[gameId]`), normalized for portable export.
 *
 * Vortex's native shape is `{ [modId]: { pos, enabled, locked?, external?,
 * prefix?, data? } }`. We flatten it to an array (so the JSON has stable
 * iteration order) and keep only the fields that carry portable meaning.
 *
 * Dropped:
 *   - `prefix` — UI display string only.
 *   - `data` — game-extension-specific opaque payload (varies wildly).
 */
export type CapturedLoadOrderEntry = {
  /** Vortex internal mod id — matches `AuditorMod.id`. */
  modId: string;
  /** 0-indexed position in the load order. */
  pos: number;
  /** Whether this mod is enabled in the load-order view. */
  enabled: boolean;
  /** Locked entries cannot be moved by the user; informational only. */
  locked?: boolean;
  /** True for entries Vortex synthesized from on-disk files outside its mod table. */
  external?: boolean;
};

/**
 * Captured per-game load order, sorted by `pos` ascending.
 *
 * INVARIANT: empty array when the game does not use Vortex's LoadOrder API
 * (e.g., Skyrim SE pre-AE, Fallout 3, FNV — these games drive load order
 * via `plugins.txt` only). Never undefined.
 *
 * NOTE: this is **NOT** the same as `plugins.txt`. Plugins.txt covers ESPs
 * /ESMs/ESLs only; LoadOrder covers every mod (including script extenders,
 * ENB binaries, and other non-plugin payloads). For games that use both,
 * we capture both — the snapshot's `loadOrder` complements
 * `comparePlugins` analysis of `plugins.txt`.
 */
/**
 * ─── THE HIVE IS KEYED BY PROFILE, AND HOLDS TWO DIFFERENT SHAPES ──────
 * This read `persistent.loadOrder[gameId]` and required `entry.pos`, and it
 * could not succeed on either count.
 *
 * Vortex keys the hive by PROFILE id. Verified against a live store: the keys
 * present were `5Se3KaxbZ` and `ejo_JLCWJ`, both profile ids, and no game id
 * appeared as a key at all. Its own reducer agrees — `setLoadOrderEntry` is
 * `setSafe(state, [profileId, modId], entry)`.
 *
 * And there are two value shapes, because Vortex has two generations of this
 * API. The legacy one is a DICTIONARY of `{ [modId]: { pos, enabled, ... } }`;
 * the modern file-based one (FBLO) is an ARRAY of
 * `{ id, modId, name, enabled }` where position IS the index and there is no
 * `pos` at all. Reading the array with `Object.entries` yields "0", "1", "2"
 * as modIds and `pos === undefined`, so every entry was dropped.
 *
 * So this returned `[]` unconditionally — and `[]` is also the legitimate
 * answer for a game with no load order, which is what made it invisible.
 * Both shapes are accepted now, and an unusable hive is reported rather than
 * silently flattened into the same empty array as a legitimately empty one.
 */
export function captureLoadOrder(
  state: types.IState,
  profileId: string,
): CapturedLoadOrderEntry[] {
  const raw = (state as any)?.persistent?.loadOrder?.[profileId];

  if (!raw || typeof raw !== "object") {
    ehLog("debug", "loadorder.capture.empty", { profileId, found: false });
    return [];
  }

  const entries: CapturedLoadOrderEntry[] = [];
  let dropped = 0;

  /** One entry from either shape. `pos` is the index for the array form. */
  const take = (modId: string | undefined, rawEntry: unknown, pos: number): void => {
    if (!rawEntry || typeof rawEntry !== "object") {
      dropped += 1;
      return;
    }
    const entry = rawEntry as any;
    // The array form carries the mod under `modId`; the dictionary form has
    // it as the key. Either way, a load order entry with no mod is not one.
    const id = modId ?? (typeof entry.modId === "string" ? entry.modId : undefined);
    if (id === undefined || id === "") {
      dropped += 1;
      return;
    }

    const captured: CapturedLoadOrderEntry = {
      modId: id,
      pos,
      enabled: entry.enabled === true,
    };
    if (entry.locked === true) captured.locked = true;
    if (entry.external === true) captured.external = true;
    entries.push(captured);
  };

  if (Array.isArray(raw)) {
    // FBLO: position is the index.
    raw.forEach((entry, index) => take(undefined, entry, index));
  } else {
    for (const [modId, rawEntry] of Object.entries(raw)) {
      const entry = rawEntry as any;
      const pos =
        typeof entry?.pos === "number" && !Number.isNaN(entry.pos)
          ? entry.pos
          : undefined;
      if (pos === undefined) {
        dropped += 1;
        continue;
      }
      take(modId, rawEntry, pos);
    }
  }

  ehLog("info", "loadorder.captured", {
    profileId,
    shape: Array.isArray(raw) ? "array" : "dictionary",
    captured: entries.length,
    dropped,
  });

  entries.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos;
    return a.modId < b.modId ? -1 : a.modId > b.modId ? 1 : 0;
  });

  return entries;
}
