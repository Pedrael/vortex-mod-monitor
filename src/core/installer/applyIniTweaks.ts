/**
 * ──────────────────────────────────────────────────────────────────────
 * Turn back on the INI tweaks the curator had turned on.
 *
 * A mod can ship optional `.ini` fragments in an `ini tweaks` folder — a
 * performance preset, a rain toggle, a "disable intro movie". Vortex leaves
 * them all OFF by default and the user ticks the ones they want; ticking one
 * is what makes Vortex merge that fragment into the game's INI at deploy.
 *
 * The curator's ticks were captured into `state.enabledINITweaks` from the
 * beginning and then never applied to anything, which is the worst place for
 * this to fail. A tweak is invisible: it does not add a file to the mod list,
 * it does not change a plugin count, and its absence looks exactly like its
 * presence right up until the game runs differently. A collection that ships
 * a performance preset and silently does not enable it has reproduced
 * everything the user can see and none of what they will feel.
 *
 * ── What this does NOT do ──
 * It never DISABLES a tweak. The user may have enabled something on their own
 * mods, and a collection that quietly untick things it did not tick would be
 * reaching outside what it installed. Additive only, same as the mod rules.
 * ──────────────────────────────────────────────────────────────────────
 */

import { actions } from "@nexusmods/vortex-api";
import type { types } from "@nexusmods/vortex-api";

import { ehLog } from "../logging/ehLog";
import type { EhcollMod } from "../../types/ehcoll";

export type IniTweakApplication = {
  /** Tweaks turned on, as `modName :: tweakFile` for the receipt. */
  enabled: string[];
  /**
   * Tweaks the manifest asked for on mods this install did not produce.
   * Not an error — a skipped or carried mod has no new id to tick against —
   * but recorded so a missing tweak is explainable rather than mysterious.
   */
  skipped: string[];
};

export function emptyIniTweakApplication(): IniTweakApplication {
  return { enabled: [], skipped: [] };
}

/**
 * Enable each captured tweak on the mod this install produced for it.
 *
 * `installed` maps compareKey → the Vortex mod id created here, which is the
 * only correct target: the manifest's own mod id is the CURATOR's, and ticking
 * a tweak against it would either do nothing or, worse, land on an unrelated
 * mod that happens to share the id on this machine.
 */
export function applyIniTweaks(args: {
  api: types.IExtensionApi;
  gameId: string;
  /** compareKey → the Vortex mod id this install produced. */
  installed: ReadonlyMap<string, string>;
  manifestMods: readonly EhcollMod[];
}): IniTweakApplication {
  const out = emptyIniTweakApplication();

  for (const mod of args.manifestMods) {
    const tweaks = mod.state.enabledINITweaks ?? [];
    if (tweaks.length === 0) continue;

    const vortexModId = args.installed.get(mod.compareKey);
    if (vortexModId === undefined) {
      for (const tweak of tweaks) out.skipped.push(`${mod.name} :: ${tweak}`);
      continue;
    }

    for (const tweak of tweaks) {
      try {
        args.api.store?.dispatch(
          (
            actions as unknown as {
              setINITweakEnabled: (
                gameId: string,
                modId: string,
                tweak: string,
                enabled: boolean,
              ) => unknown;
            }
          ).setINITweakEnabled(args.gameId, vortexModId, tweak, true),
        );
        out.enabled.push(`${mod.name} :: ${tweak}`);
      } catch (err) {
        // One tweak that will not tick is not worth failing an install over,
        // but it IS worth saying — see describeIniTweaks.
        out.skipped.push(`${mod.name} :: ${tweak}`);
        ehLog("warn", "installer.ini-tweak-failed", {
          tweak,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  ehLog("info", "installer.ini-tweaks-applied", {
    enabled: out.enabled.length,
    skipped: out.skipped.length,
  });
  return out;
}

/**
 * What to tell the user, and only when there is something they can act on.
 *
 * Successes are silent: a tweak that worked is indistinguishable from a
 * collection that had none, and neither needs a sentence. A tweak that did NOT
 * get enabled is the one worth naming, because it is otherwise invisible —
 * the game just behaves differently and nothing on screen says why.
 */
export function describeIniTweaks(result: IniTweakApplication): string[] {
  if (result.skipped.length === 0) return [];

  const lines = [
    `${result.skipped.length} INI tweak(s) the curator had enabled could not ` +
      `be enabled here, because the mods they belong to were skipped or ` +
      `already present. INI tweaks change how the game runs without changing ` +
      `anything you can see in the mod list, so this is worth a look:`,
  ];
  for (const entry of result.skipped.slice(0, 5)) lines.push(`  • ${entry}`);
  if (result.skipped.length > 5) {
    lines.push(`  • and ${result.skipped.length - 5} more.`);
  }
  lines.push(
    `You can tick them yourself on each mod's INI Tweaks tab in Vortex.`,
  );
  return lines;
}
