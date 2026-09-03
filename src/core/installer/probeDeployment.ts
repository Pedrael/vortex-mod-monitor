/**
 * ──────────────────────────────────────────────────────────────────────
 * Can Vortex actually put mods into the game folder? Asked BEFORE the hour.
 *
 * Staging a mod and DEPLOYING it are separate steps. Deployment is what links
 * the staged files into the game directory, and when no method is usable the
 * mods download, extract and stage perfectly while the game sees nothing.
 *
 * A tester lost seventy minutes to this: 963 of 967 mods staged, then Vortex
 * threw `ProcessCanceled("No deployment method active")`. The four mods that
 * needed deploying mid-run had failed with it an hour earlier.
 *
 * ─── ASKING VORTEX ITS OWN QUESTION ────────────────────────────────────
 * `util.getCurrentActivator(state, gameId, true)` is the exact resolution
 * Vortex performs before it throws — selected method first, otherwise the
 * first registered method that supports every mod type of this game. It
 * returns `undefined` rather than throwing, and that `undefined` IS the
 * condition. So this is the real check, not a proxy for it, and it costs one
 * synchronous call with no side effects.
 *
 * Reading `settings.mods.activator[gameId]` would NOT do. Unset is the normal
 * state for most users — Vortex auto-picks — so blocking on it would refuse
 * installs on healthy machines. That is the "unknown treated as broken"
 * mistake, and it is worse than the bug it would be trying to prevent.
 *
 * ─── AND IT FAILS OPEN ─────────────────────────────────────────────────
 * `getCurrentActivator` is not part of the documented extension API surface
 * we can rely on forever. If it is missing, or throws, or Vortex reorganises
 * it, the answer is `unknown` and the install proceeds. A preflight that
 * blocks a working install because it could not run its own check has done
 * more damage than the failure it guards against — the driver still stops at
 * the first real occurrence, so nothing is lost by being unsure here.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { types } from "@nexusmods/vortex-api";

export type DeploymentProbe =
  /** A method is available; deployment will work. */
  | { kind: "ok"; methodId: string }
  /** Vortex would refuse to deploy. This is the one worth blocking on. */
  | { kind: "none" }
  /** Could not check. NEVER treated as a problem — see the header. */
  | { kind: "unknown"; why: string };

export interface ProbeDeps {
  api: types.IExtensionApi;
  gameId: string;
  /**
   * Injected so the probe is testable without a Vortex.
   *
   * Defaults to `util.getCurrentActivator` — Vortex's own resolver.
   */
  getCurrentActivator?: (
    state: unknown,
    gameId: string,
    allowDefault: boolean,
  ) => { id?: string } | undefined;
}

export function probeDeploymentMethod(deps: ProbeDeps): DeploymentProbe {
  let resolve = deps.getCurrentActivator;
  if (resolve === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const vortex = require("@nexusmods/vortex-api") as {
        util?: {
          getCurrentActivator?: (
            state: unknown,
            gameId: string,
            allowDefault: boolean,
          ) => { id?: string } | undefined;
        };
      };
      resolve = vortex.util?.getCurrentActivator;
    } catch {
      resolve = undefined;
    }
  }
  if (typeof resolve !== "function") {
    return {
      kind: "unknown",
      why: "this Vortex does not expose getCurrentActivator",
    };
  }

  try {
    const state = deps.api.getState();
    // `allowDefault: true` mirrors what Vortex passes on the deployment path:
    // an unset method is fine as long as SOMETHING supports the game's mod
    // types. Passing false here would report trouble for every user who never
    // picked one by hand, which is most of them.
    const activator = resolve(state, deps.gameId, true);
    if (activator === undefined || activator === null) return { kind: "none" };
    return {
      kind: "ok",
      methodId: typeof activator.id === "string" ? activator.id : "unknown",
    };
  } catch (err) {
    return {
      kind: "unknown",
      why: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * What the user is told when the probe says `none`.
 *
 * Written to be read by someone about to spend an hour, so it leads with the
 * consequence rather than the mechanism: the mods will install and the game
 * will not change.
 */
export function describeDeploymentBlock(wine: boolean): {
  title: string;
  body: string;
} {
  return {
    title: "Vortex cannot put mods into the game folder",
    body:
      "Vortex has no working deployment method for this game. The collection " +
      "would download and install every mod, and none of it would reach the " +
      "game — deploying is the step that links staged mods into the game " +
      "folder, and Vortex has no way to do it right now.\n\n" +
      "Fix it in Vortex under Settings → Mods → Deployment Method, then " +
      "start the install again." +
      (wine
        ? "\n\nOn Linux/Proton this is usually hardlink deployment: it needs " +
          "the staging folder and the game folder on the SAME filesystem " +
          "inside the prefix. Moving the staging folder next to the game, or " +
          "choosing a different method, resolves it."
        : ""),
  };
}
