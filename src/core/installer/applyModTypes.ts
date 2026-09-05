/**
 * ──────────────────────────────────────────────────────────────────────
 * Put each mod back into the KIND of mod the curator had, before deploying.
 *
 * Vortex's `modType` decides where a mod's files land. The default type goes
 * to the game's Data folder; `dinput` goes to the game ROOT, which is how a
 * script extender's loader ends up beside the executable. On the curator's
 * real 1753-mod Skyrim profile exactly one mod is `dinput` — SKSE64 — and
 * Vortex writes a separate `vortex.deployment.dinput.json` listing the 129
 * files it put in the game folder.
 *
 * ─── WHY THIS IS NOT "OVERRIDING VORTEX" ───────────────────────────────
 * The install side used to set nothing here, on the reasoning that Vortex
 * derives the type from the archive and a collection claiming to know better
 * would be overreach. That reasoning holds for a type Vortex DERIVED, and it
 * fails completely for one a human SET.
 *
 * Vortex offers the type as a control precisely because detection cannot
 * always answer it. SSE Engine Fixes Part 2 is the case in point: loose
 * binaries in a plain archive that must go to the game root, which no
 * detection rule recognises, so a curator who wants Vortex to manage it has to
 * pick the type by hand. Re-deriving on the user's machine cannot reproduce a
 * choice that was never derived in the first place — it will confidently
 * answer "default", and the DLLs land in Data where nothing loads them.
 *
 * So this replays a decision a person made. That is the entire job.
 *
 * ─── BEFORE THE DEPLOY, WHICH IS THE ONLY MOMENT IT IS FREE ────────────
 * The mismatch check that preceded this ran AFTER deployment, so it could only
 * report files that were already in the wrong folder and ask the user to go
 * and fix it. Setting the type first costs nothing: automatic deployment is
 * off (the install gate enforces it), so nothing has been linked anywhere yet
 * and the driver's single deploy puts every file in the right place first
 * time.
 *
 * ─── AND ONLY EVER TO A VALUE THE CURATOR RECORDED ─────────────────────
 * Never invents a type, never guesses one from an archive, never touches a mod
 * whose type already agrees. The only input is what was captured on the
 * curator's machine.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { types } from "@nexusmods/vortex-api";

import type { EhcollMod } from "../../types/ehcoll";

export type ModTypeChange = {
  name: string;
  vortexModId: string;
  /** What this install produced. Empty string is Vortex's default type. */
  from: string;
  /** What the curator had. */
  to: string;
};

const normalise = (t: string): string => t.trim().toLowerCase();

/**
 * Which mods need their type corrected, and to what.
 *
 * Pure, so the decision is testable without a Vortex store. Reading state is
 * the caller's job.
 */
export function planModTypeChanges(args: {
  /** compareKey → the Vortex mod id this install produced. */
  installed: ReadonlyMap<string, string>;
  /** modId → the type Vortex currently has for it. */
  currentTypes: ReadonlyMap<string, string>;
  manifestMods: readonly EhcollMod[];
}): ModTypeChange[] {
  const out: ModTypeChange[] = [];
  for (const mod of args.manifestMods) {
    const vortexModId = args.installed.get(mod.compareKey);
    if (vortexModId === undefined) continue;

    // `?? ""` reads an ABSENT type as Vortex's default, which is a claim about
    // the curator's machine rather than a fact from it — so it is only safe
    // while every package records the field. It does: `AuditorMod.modType` is
    // a required string, `getModsListForProfile` sets it to "" when Vortex has
    // no type, and `buildManifest` writes it unconditionally. A current build
    // therefore always carries it, "" included.
    //
    // The type says `modType?: string` and the parser accepts it missing, so
    // the FORMAT still permits a state the producer never emits — reachable
    // only from a package built before modType capture existed, or a
    // hand-edited manifest. Backward compatibility is not carried here by
    // decision, so absent stays "default" rather than growing a branch for a
    // case that cannot arrive. If that ever changes, this is the line: absent
    // would have to mean "unknown, leave the user's type alone", the way
    // `capturePluginFlags` already treats a header it could not read.
    const to = mod.state.modType ?? "";
    const from = args.currentTypes.get(vortexModId) ?? "";
    if (normalise(from) === normalise(to)) continue;

    out.push({ name: mod.name, vortexModId, from, to });
  }
  return out;
}

/**
 * Read every installed mod's current type out of Vortex's state.
 *
 * Defensive: a state shape we cannot read yields an empty map, which makes
 * `planModTypeChanges` plan nothing. Failing to correct a type is a warning
 * later; throwing here would take down an install that was otherwise fine.
 */
export function readCurrentModTypes(
  api: types.IExtensionApi,
  gameId: string,
): Map<string, string> {
  const out = new Map<string, string>();
  try {
    const mods = (
      api.getState() as unknown as {
        persistent?: { mods?: Record<string, Record<string, { type?: string }>> };
      }
    ).persistent?.mods?.[gameId];
    for (const [modId, mod] of Object.entries(mods ?? {})) {
      out.set(modId, typeof mod?.type === "string" ? mod.type : "");
    }
  } catch {
    // Unreadable state means "no opinion", never "everything is default".
  }
  return out;
}

/**
 * Apply the plan. Returns what was actually dispatched.
 *
 * Each dispatch is independent and guarded: one mod Vortex refuses must not
 * cost the other corrections, because they are unrelated mods and the ones
 * that succeed are still worth having.
 */
export function applyModTypeChanges(
  api: types.IExtensionApi,
  gameId: string,
  changes: readonly ModTypeChange[],
  vortexActions: { setModType: (g: string, m: string, t: string) => unknown },
): ModTypeChange[] {
  const applied: ModTypeChange[] = [];
  for (const change of changes) {
    try {
      api.store?.dispatch(
        vortexActions.setModType(gameId, change.vortexModId, change.to) as never,
      );
      applied.push(change);
    } catch {
      // Reported by the post-deploy check, which still runs.
    }
  }
  return applied;
}

/**
 * What the user is told, when a correction was made.
 *
 * Worth saying rather than doing silently: it explains a mod appearing outside
 * Data, which otherwise looks like the collection misbehaving.
 */
export function describeModTypeChanges(
  changes: readonly ModTypeChange[],
): string[] {
  if (changes.length === 0) return [];
  const label = (t: string): string =>
    t.length === 0 ? "a normal mod" : `"${t}"`;
  const lines = [
    `${changes.length} mod(s) were set back to the kind of mod the curator ` +
      `had, so their files deploy to the folder they belong in. A script ` +
      `extender or an engine fix installs beside the game executable rather ` +
      `than in Data, and Vortex cannot always tell that from the archive.`,
  ];
  for (const c of changes.slice(0, 5)) {
    lines.push(`  • "${c.name}": ${label(c.from)} → ${label(c.to)}.`);
  }
  if (changes.length > 5) lines.push(`  • and ${changes.length - 5} more.`);
  return lines;
}
