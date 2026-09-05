/**
 * ──────────────────────────────────────────────────────────────────────
 * Enabling, disabling, and setting a mod's kind — in bulk, and only where it
 * changes something.
 *
 * Both are state writes rather than installs, so neither needs the sequential
 * treatment: no files move and nothing races. What they DO need is to write
 * only real changes. Vortex re-deploys on profile changes, and dispatching
 * "enabled: true" for nine hundred mods that are already enabled is nine
 * hundred store writes and the deploy that follows them.
 *
 * ─── WHY modType IS OFFERED AT ALL ─────────────────────────────────────
 * Vortex derives a mod's type from its archive, and for most mods that answer
 * is right. It cannot derive a type a HUMAN set: SSE Engine Fixes Part 2 is
 * loose binaries that belong beside the game executable and no detection rule
 * recognises them, so a curator managing it through Vortex picks the type by
 * hand — one mod at a time, through a dropdown, for every such mod.
 *
 * The value here is naming NOTHING. This module knows no mod names and no
 * types beyond the string it is handed; deciding that "SKSE means dinput"
 * belongs to the curator, who can see their own setup.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { CuratorMod } from "./profileActions";

export type EnableChange = { mod: CuratorMod; to: boolean };

/**
 * Which mods actually need their enabled state written.
 *
 * A mod already in the wanted state is skipped: the write is not free, and a
 * profile change is what makes Vortex re-deploy.
 */
export function planEnableChanges(
  mods: readonly CuratorMod[],
  to: boolean,
): EnableChange[] {
  return mods.filter((mod) => mod.enabled !== to).map((mod) => ({ mod, to }));
}

export type TypeChange = { mod: CuratorMod; from: string; to: string };

/**
 * Which mods actually need their type written.
 *
 * Comparison is trimmed and case-folded because Vortex's own types are lower
 * case identifiers and a curator typing "dinput " should not produce a change
 * that is really a no-op — nor a second, differently-spelled type.
 */
export function planTypeChanges(
  mods: readonly CuratorMod[],
  to: string,
): TypeChange[] {
  const wanted = to.trim().toLowerCase();
  return mods
    .filter((mod) => mod.modType.trim().toLowerCase() !== wanted)
    .map((mod) => ({ mod, from: mod.modType, to: wanted }));
}

/** What the curator is told before anything is written. */
export function describeEnableChanges(changes: readonly EnableChange[]): string {
  if (changes.length === 0) {
    return "Every selected mod is already in that state — nothing to write.";
  }
  const verb = changes[0]!.to ? "Enable" : "Disable";
  return (
    `${verb} ${changes.length} mod(s). Vortex re-deploys after a profile ` +
    `change, so this is one deploy rather than one per mod.`
  );
}

export function describeTypeChanges(changes: readonly TypeChange[]): string {
  if (changes.length === 0) {
    return "Every selected mod is already that kind — nothing to write.";
  }
  const label = (t: string): string => (t.length === 0 ? "a normal mod" : `"${t}"`);
  const to = label(changes[0]!.to);
  return (
    `Change ${changes.length} mod(s) to ${to}. A mod's kind decides WHERE its ` +
    `files deploy — the default goes to Data, "dinput" goes to the game folder ` +
    `beside the executable. Deploy afterwards for it to take effect.`
  );
}
