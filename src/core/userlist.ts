/**
 * Curator-side LOOT userlist capture (Phase 3 slice 6d).
 *
 * Reads `state.userlist` from Vortex's Redux store and projects it into a
 * portable shape the manifest can carry across machines. This is the third
 * "rule system" Event Horizon supports, alongside mod rules
 * (`state.persistent.mods.rules`) and per-game LoadOrder
 * (`state.persistent.loadOrder`) — and the only one that drives plugin
 * order via LOOT.
 *
 * ─── WHY THIS EXISTS ───────────────────────────────────────────────────
 * Vortex's plugin-management extension owns `state.userlist`. The shape
 * is identical to LOOT's `userlist.yaml`:
 *
 *   {
 *     globals: IMessage[],         // global LOOT messages — IGNORED.
 *     plugins: ILOOTPlugin[],      // per-plugin overrides + group assigns.
 *     groups: ILOOTGroup[],        // group definitions + group rules.
 *   }
 *
 * The persistor in `extension-plugin-management/src/util/UserlistPersistor.ts`
 * round-trips this Redux slice to/from `userlist.yaml` on disk. LOOT
 * reads the YAML at sort time (see `autosort.ts`), so anything we put
 * into Redux ends up influencing the user's `plugins.txt`.
 *
 * ─── WHAT WE CAPTURE ───────────────────────────────────────────────────
 *  - **plugins**: per-plugin `group` assignment + `after` / `req` /
 *    `inc` rules. Curator's `tag`, `dirty`, `msg`, `url` are NOT
 *    captured — they're noise for collection sharing (curator's
 *    machine-specific cleaning marks, locale-specific messages, etc.).
 *  - **groups**: every defined group + its `after` rules. Always full
 *    capture because group rules are global namespace constraints; we
 *    can't safely filter to "only groups our plugins use" without
 *    breaking transitive group ordering on the user side.
 *  - **globals**: NOT captured. They're LOOT's user-facing notes;
 *    irrelevant to install behavior.
 *
 * Reference encoding: Vortex's redux state stores `after` / `req` /
 * `inc` array entries as plain strings (the reducer does
 * `ref.toUpperCase()` directly on them — see
 * `extension-plugin-management/src/reducers/userlist.ts`). We mirror
 * that — the captured shape is `string[]`, not `ILootReference[]`.
 *
 * Plugin-name casing: LOOT, autosort, and the userlist reducer are all
 * case-insensitive on plugin names (`name.toUpperCase()` everywhere).
 * We preserve the curator's casing so the manifest reads naturally,
 * but the apply-side compares case-insensitively.
 *
 * ─── INVARIANTS ────────────────────────────────────────────────────────
 *   - Always returns a non-null result. Empty userlist → empty arrays.
 *   - Reads via `(state as any)?.userlist` — `state.userlist` isn't in
 *     `vortex-api`'s public typings (the slice belongs to a separate
 *     extension's Redux registration), so we narrow defensively.
 *   - Pure read. No I/O, no dispatch.
 */

import type { types } from "vortex-api";

export type CapturedUserlistPlugin = {
  /** Plugin filename. Case preserved as-stored on the curator's machine. */
  name: string;
  /** LOOT group assignment, when set. */
  group?: string;
  /** Names of plugins this plugin loads after. */
  after?: string[];
  /** Names of plugins required by this one (LOOT requirement metadata). */
  req?: string[];
  /** Names of plugins incompatible with this one. */
  inc?: string[];
};

export type CapturedUserlistGroup = {
  /** Group name. */
  name: string;
  /** Names of groups this group loads after (group → group ordering). */
  after?: string[];
};

export type CapturedUserlist = {
  plugins: CapturedUserlistPlugin[];
  groups: CapturedUserlistGroup[];
};

/**
 * Snapshot the curator's `state.userlist` into the portable shape.
 *
 * Returns empty arrays when the slice is missing, malformed, or the
 * extension hasn't loaded a userlist for the active game yet (which is
 * what happens for non-Bethesda games — `state.userlist` only exists
 * when `extension-plugin-management` is active).
 */
export function captureUserlist(state: types.IState): CapturedUserlist {
  const raw = (
    state as unknown as {
      userlist?: {
        plugins?: unknown;
        groups?: unknown;
      };
    }
  ).userlist;

  if (!raw || typeof raw !== "object") {
    return { plugins: [], groups: [] };
  }

  const plugins = Array.isArray(raw.plugins)
    ? capturePluginEntries(raw.plugins)
    : [];
  const groups = Array.isArray(raw.groups)
    ? captureGroupEntries(raw.groups)
    : [];

  return { plugins, groups };
}

function capturePluginEntries(raw: unknown[]): CapturedUserlistPlugin[] {
  const out: CapturedUserlistPlugin[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;

    if (typeof e.name !== "string" || e.name.length === 0) continue;

    const captured: CapturedUserlistPlugin = { name: e.name };

    if (typeof e.group === "string" && e.group.length > 0) {
      captured.group = e.group;
    }

    const after = readReferenceList(e.after);
    if (after.length > 0) captured.after = after;
    const req = readReferenceList(e.req);
    if (req.length > 0) captured.req = req;
    const inc = readReferenceList(e.inc);
    if (inc.length > 0) captured.inc = inc;

    // Skip plugins whose only state was noise we don't capture (msg,
    // tag, dirty, url). Keeps the manifest tight — the apply pass has
    // nothing actionable for these.
    if (
      captured.group === undefined &&
      captured.after === undefined &&
      captured.req === undefined &&
      captured.inc === undefined
    ) {
      continue;
    }

    out.push(captured);
  }
  return out;
}

function captureGroupEntries(raw: unknown[]): CapturedUserlistGroup[] {
  const out: CapturedUserlistGroup[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.name !== "string" || e.name.length === 0) continue;

    const captured: CapturedUserlistGroup = { name: e.name };
    const after = readReferenceList(e.after);
    if (after.length > 0) captured.after = after;
    out.push(captured);
  }
  return out;
}

/**
 * Tolerantly read a LOOT reference list. Vortex's reducer stores plain
 * strings, but the on-disk YAML format allows the full `ILootReference`
 * object form `{ name, display?, condition? }`. If the curator's state
 * happens to carry the object form (e.g., the file was loaded with
 * conditional rules), we collapse to `name`.
 *
 * Conditional refs lose their condition metadata in the collapse —
 * that's deliberate. v1 doesn't replay LOOT conditions on the user
 * side; preserving them would require a condition evaluator the
 * collection runtime doesn't have.
 */
function readReferenceList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.length > 0) {
      out.push(item);
      continue;
    }
    if (
      item &&
      typeof item === "object" &&
      typeof (item as { name?: unknown }).name === "string"
    ) {
      const name = (item as { name: string }).name;
      if (name.length > 0) out.push(name);
    }
  }
  return out;
}
