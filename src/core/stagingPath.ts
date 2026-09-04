/**
 * ──────────────────────────────────────────────────────────────────────
 * Where a mod's files live on this machine.
 *
 * Vortex stages every mod at `<installRoot>/<mod.installationPath>`. Six
 * places built that path by hand, and three of them guarded the folder name's
 * LENGTH while three checked only its type — `path.join(root, "")` returns
 * root, so on the permissive three a mod with a blank folder name pointed at
 * the entire staging tree. That is what an absent shared helper looks like:
 * not a wrong answer everywhere, a different answer in half the places.
 *
 * ─── TWO INPUTS, ON PURPOSE ────────────────────────────────────────────
 * The callers do not all hold the same thing, and flattening that would be
 * its own bug:
 *
 *   - The BUILD side has an `AuditorMod` whose `installationPath` was read
 *     from Vortex moments earlier by `getModsListForProfile`. Re-reading state
 *     for it would be asking the same question twice.
 *   - The INSTALL and DOCTOR sides have a Vortex mod id for a mod that was
 *     just created ON THIS MACHINE. There is no curator-side object to trust,
 *     and live state is the only thing that knows the folder Vortex chose.
 *
 * So this exposes both, sharing the one thing they must agree on: what counts
 * as a usable folder name.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as path from "path";

import { selectors } from "@nexusmods/vortex-api";
import type { types } from "@nexusmods/vortex-api";

/**
 * Vortex's staging root for a game, or undefined when it cannot say.
 *
 * Wrapped so the seven callers that need it stop each deciding what a falsy
 * return means.
 */
export function installRootFor(
  state: types.IState,
  gameId: string,
): string | undefined {
  try {
    const root = selectors.installPathForGame(state, gameId);
    return typeof root === "string" && root.length > 0 ? root : undefined;
  } catch {
    // A game Vortex cannot resolve a path for is not an exception here; every
    // caller already treats "no root" as "nothing to check".
    return undefined;
  }
}

/**
 * Join a staging root to a mod's folder name.
 *
 * The blank check is the whole point. `path.join(root, "")` is `root`, so a
 * mod with an empty `installationPath` would silently address every mod in the
 * collection at once — and a verifier pointed at that finds every expected
 * file present and reports a mountain of extras rather than failing.
 */
export function stagingRootFromFolder(
  installRoot: string | undefined,
  installationPath: unknown,
): string | undefined {
  if (installRoot === undefined) return undefined;
  if (typeof installationPath !== "string" || installationPath.length === 0) {
    return undefined;
  }
  return path.join(installRoot, installationPath);
}

/** The `installationPath` Vortex currently records for a mod id. */
export function installationPathFromState(
  state: types.IState,
  gameId: string,
  vortexModId: string,
): string | undefined {
  const mod = (
    state as unknown as {
      persistent?: { mods?: Record<string, Record<string, unknown>> };
    }
  )?.persistent?.mods?.[gameId]?.[vortexModId] as
    | { installationPath?: unknown }
    | undefined;
  const folder = mod?.installationPath;
  return typeof folder === "string" && folder.length > 0 ? folder : undefined;
}

/**
 * Staging folder for a mod id, read from live Vortex state.
 *
 * For the install and doctor sides, where the mod was created on this machine
 * and the manifest's own ids belong to the curator.
 */
export function stagingRootForModId(
  state: types.IState,
  gameId: string,
  vortexModId: string,
): string | undefined {
  return stagingRootFromFolder(
    installRootFor(state, gameId),
    installationPathFromState(state, gameId, vortexModId),
  );
}
