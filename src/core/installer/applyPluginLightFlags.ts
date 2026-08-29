/**
 * ──────────────────────────────────────────────────────────────────────
 * Restore the curator's ESL / "light" flags on the user's plugins.
 *
 * ─── THE FAILURE THIS PREVENTS ─────────────────────────────────────────
 * Regular plugins are addressed with one byte, so 254 can load; light plugins
 * share the `FE` index and cost nothing. On the profile this was built for,
 * 817 plugins fit only because 573 are light — 244 regular against a limit of
 * 254. Eleven missing flags and the game does not start.
 *
 * The flag lives inside the plugin file, so a curator who marks a plugin light
 * after installing it has a staged file the archive does not contain. The user
 * installs from that archive and gets the unflagged copy. Nothing downstream
 * catches it: verification sees different bytes, `judgeReinstall` consults the
 * archive, finds the user's copy matches it exactly, and concludes the
 * curator's staging diverged — which is true, and which for every other kind
 * of difference is the right answer. This is the one where accepting it breaks
 * the game, and it is why the flag is carried explicitly instead of being left
 * to file comparison.
 *
 * ─── WRITING TO THE DEPLOYED FILE IS THE POINT ─────────────────────────
 * This edits the plugin the game will load. With hardlink deployment that IS
 * the staged file, so the change persists across a re-deploy; with copy
 * deployment a purge could revert it, which is why the result is reported
 * rather than assumed permanent.
 *
 * Only four bytes change, and only the one bit inside them.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as path from "path";

import {
  readPluginFlags,
  setPluginLightFlag,
  REGULAR_PLUGIN_LIMIT,
} from "../manifest/pluginFlags";
import type { EhcollPluginEntry } from "../../types/ehcoll";

export type PluginFlagRepair = {
  /** Files whose flag was actually rewritten. */
  corrected: number;
  /** Already correct — the common case when the mod author shipped it light. */
  alreadyCorrect: number;
  /** The manifest did not record a flag: older package, or unreadable at build. */
  unknown: number;
  /** Not on disk, or not a readable plugin. */
  missing: number;
  /** Writes that failed, named — each one is a plugin closer to not loading. */
  failures: string[];
  /** Regular (non-light) plugins after the repair, for the limit check. */
  regularAfter: number;
};

export async function applyPluginLightFlags(args: {
  order: readonly EhcollPluginEntry[];
  /** The game's Data folder — where the plugins the game loads actually live. */
  dataDir: string | undefined;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}): Promise<PluginFlagRepair> {
  const result: PluginFlagRepair = {
    corrected: 0,
    alreadyCorrect: 0,
    unknown: 0,
    missing: 0,
    failures: [],
    regularAfter: 0,
  };
  if (args.dataDir === undefined) {
    result.failures.push("the game's Data folder could not be located");
    return result;
  }

  let done = 0;
  for (const plugin of args.order) {
    if (args.signal?.aborted === true) break;
    done += 1;
    args.onProgress?.(done, args.order.length);

    // Absent means the build could not read it. Leave the user's file alone
    // rather than clearing a flag on a guess.
    if (plugin.light === undefined) {
      result.unknown += 1;
      continue;
    }

    const file = path.join(args.dataDir, plugin.name);
    const current = await readPluginFlags(file);
    if (current === undefined) {
      result.missing += 1;
      continue;
    }

    if (current.isLight === plugin.light) {
      result.alreadyCorrect += 1;
      if (!plugin.light) result.regularAfter += 1;
      continue;
    }

    try {
      const changed = await setPluginLightFlag(file, plugin.light);
      if (changed) result.corrected += 1;
      else result.alreadyCorrect += 1;
      if (!plugin.light) result.regularAfter += 1;
    } catch (err) {
      result.failures.push(
        `${plugin.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
      // It kept whatever it had, so count it as it currently stands.
      if (!current.isLight) result.regularAfter += 1;
    }
  }
  return result;
}

/**
 * What to tell the user, or `undefined` when there is nothing worth saying.
 *
 * Silent on the happy path — restoring flags that were already right is not an
 * event. Loud when the plugin limit is actually breached, because that is the
 * difference between "a mod behaves oddly" and "the game will not start", and
 * the user needs to know which one they have before they go looking.
 */
export function describePluginFlagRepair(
  result: PluginFlagRepair,
): string[] | undefined {
  const overLimit = result.regularAfter > REGULAR_PLUGIN_LIMIT;
  if (result.corrected === 0 && result.failures.length === 0 && !overLimit) {
    return undefined;
  }

  const lines: string[] = [];
  if (overLimit) {
    lines.push(
      `This profile has ${result.regularAfter} regular plugins against a ` +
        `limit of ${REGULAR_PLUGIN_LIMIT}. The game will not start until that ` +
        `is under the limit — light (ESL) flags are what keep a collection ` +
        `this size loadable, and some could not be restored.`,
    );
  } else if (result.corrected > 0) {
    lines.push(
      `Restored the collection's ESL (light) flag on ${result.corrected} ` +
        `plugin(s). These do not use a regular load-order slot, which is what ` +
        `lets a collection this size load at all.`,
    );
  }
  if (result.failures.length > 0) {
    lines.push(
      `${result.failures.length} could not be changed: ` +
        `${result.failures.slice(0, 5).join("; ")}`,
    );
  }
  if (result.missing > 0) {
    lines.push(
      `  - ${result.missing} plugin(s) in the collection are not on disk here.`,
    );
  }
  return lines;
}
