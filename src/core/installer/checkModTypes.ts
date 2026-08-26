/**
 * ──────────────────────────────────────────────────────────────────────
 * Did each mod install as the KIND of mod the curator had?
 *
 * Vortex's "modType" decides where a mod's files are deployed. The default
 * type goes to the game's Data folder; `dinput` goes to the game ROOT, and
 * that is how a script extender's DLL ends up next to the executable where
 * the loader can find it.
 *
 * Nothing on the install side sets modType, and that is correct — Vortex
 * derives it from the archive through the game extension's own detection, and
 * a collection overriding that would be claiming to know better than the tool
 * that owns the concept.
 *
 * But when the derivation disagrees with what the curator had, the failure is
 * both severe and silent. Measured on the real 954-mod collection, exactly one
 * mod is `dinput`: **F4SE**. If it installs as a default-type mod, its DLL
 * lands in Data, the game launches without the script extender, and every mod
 * that depends on it does nothing. The collection looks installed. Verification
 * of staged FILES passes, because the files are all present and correct — they
 * are simply in the wrong place.
 *
 * So this does not fix anything. It notices, and says so, which is the
 * difference between "the alpha tester's game is subtly broken" and "the alpha
 * tester knows which mod to reinstall".
 * ──────────────────────────────────────────────────────────────────────
 */

import type { types } from "@nexusmods/vortex-api";

import type { EhcollMod } from "../../types/ehcoll";

export type ModTypeMismatch = {
  name: string;
  /** What the curator's copy was. Empty string is Vortex's default type. */
  expected: string;
  /** What this install produced. */
  actual: string;
};

/** Mods whose installed type differs from the curator's. */
export function findModTypeMismatches(args: {
  api: types.IExtensionApi;
  gameId: string;
  /** compareKey → the Vortex mod id this install produced. */
  installed: ReadonlyMap<string, string>;
  manifestMods: readonly EhcollMod[];
}): ModTypeMismatch[] {
  let modsInState: Record<string, { type?: string; attributes?: unknown }>;
  try {
    modsInState =
      ((args.api.getState() as unknown as {
        persistent?: { mods?: Record<string, Record<string, { type?: string }>> };
      }).persistent?.mods?.[args.gameId] ?? {}) as never;
  } catch {
    // Unreadable state is not a mismatch. Reporting one would be inventing a
    // problem, which is worse than missing one here.
    return [];
  }

  const out: ModTypeMismatch[] = [];
  for (const mod of args.manifestMods) {
    const vortexModId = args.installed.get(mod.compareKey);
    if (vortexModId === undefined) continue;

    const expected = mod.state.modType ?? "";
    const actual = modsInState[vortexModId]?.type ?? "";
    if (normalise(expected) === normalise(actual)) continue;

    out.push({ name: mod.name, expected, actual });
  }
  return out;
}

const normalise = (t: string): string => t.trim().toLowerCase();

/**
 * What to tell the user, in terms of what will actually go wrong.
 *
 * Naming the type would mean nothing to most people, so the message leads with
 * the consequence — the files are in the wrong folder — and names the type
 * second, for whoever is going to fix it by hand.
 */
export function describeModTypeMismatches(
  mismatches: readonly ModTypeMismatch[],
): string[] {
  if (mismatches.length === 0) return [];

  const label = (t: string): string => (t.length === 0 ? "a normal mod" : `"${t}"`);
  const lines = [
    `${mismatches.length} mod(s) installed as a different KIND of mod than the ` +
      `curator had, which means Vortex will deploy their files to a different ` +
      `folder. They are installed and their files are correct — they are in the ` +
      `wrong place, so the game may not load them.`,
  ];
  for (const m of mismatches.slice(0, 5)) {
    lines.push(
      `  • "${m.name}": the curator had ${label(m.expected)}, this installed as ` +
        `${label(m.actual)}.`,
    );
  }
  if (mismatches.length > 5) {
    lines.push(`  • and ${mismatches.length - 5} more.`);
  }
  lines.push(
    `Reinstalling the mod through Vortex usually re-detects the right kind. A ` +
      `script extender is the one that matters most: it must sit next to the ` +
      `game executable, not in Data.`,
  );
  return lines;
}
