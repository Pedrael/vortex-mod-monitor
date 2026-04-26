import type { types } from "vortex-api";

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
export function captureLoadOrder(
  state: types.IState,
  gameId: string,
): CapturedLoadOrderEntry[] {
  const raw = (state as any)?.persistent?.loadOrder?.[gameId];

  if (!raw || typeof raw !== "object") {
    return [];
  }

  const entries: CapturedLoadOrderEntry[] = [];

  for (const [modId, rawEntry] of Object.entries(raw)) {
    if (!rawEntry || typeof rawEntry !== "object") {
      continue;
    }

    const entry = rawEntry as any;

    if (typeof entry.pos !== "number" || Number.isNaN(entry.pos)) {
      continue;
    }

    const captured: CapturedLoadOrderEntry = {
      modId,
      pos: entry.pos,
      enabled: entry.enabled === true,
    };

    if (entry.locked === true) {
      captured.locked = true;
    }

    if (entry.external === true) {
      captured.external = true;
    }

    entries.push(captured);
  }

  entries.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos;
    return a.modId < b.modId ? -1 : a.modId > b.modId ? 1 : 0;
  });

  return entries;
}
