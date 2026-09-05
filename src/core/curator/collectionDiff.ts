/**
 * ──────────────────────────────────────────────────────────────────────
 * What changed between the collection you shipped and the profile you have.
 *
 * The question a curator asks before pressing Rebuild, and until now the
 * dashboard could only answer it as a yes: it knew the profile had moved and
 * said nothing about how. This is the diff — added, removed, updated, toggled
 * — so the next version is something the curator chose rather than something
 * that happened.
 *
 * ─── IT IS KEYED ON THE COLLECTION'S OWN VOCABULARY ────────────────────
 * `compareKey` is what a manifest uses to name a mod, and for a Nexus mod it
 * is `nexus:<modId>:<fileId>` — derivable from a live profile for free, and
 * identical to what the build will compute. Comparing on anything else would
 * report changes the build then disagrees with.
 *
 * ─── AND EXACT ONLY WHERE IT CAN BE ────────────────────────────────────
 * An EXTERNAL mod's key is the sha256 of its archive, or a hash over its whole
 * staging folder. Both mean reading gigabytes, which is not something a view
 * that opens beside a button may do. So external mods are matched by NAME and
 * counted separately as approximate, rather than being silently compared on a
 * weaker basis or silently dropped.
 *
 * A rename of an external mod therefore reads as one removal and one addition.
 * That is wrong-looking but honest, and the alternative — inventing a match —
 * would tell the curator their collection is unchanged when it is not.
 * ──────────────────────────────────────────────────────────────────────
 */

import { nexusCompareKey } from "../identity/compareKey";
import { isNexusSourced } from "../identity/nexusSourced";
import type { AuditorMod } from "../getModsListForProfile";
import type { EhcollMod } from "../../types/ehcoll";

/**
 * The little of a shipped mod this diff needs.
 *
 * Deliberately NOT `EhcollMod`: that carries `state.stagingFiles`, which on a
 * 963-mod collection is a list of every file of every mod. A view that holds
 * the whole manifest to answer "what changed" pays megabytes of React state
 * for four fields.
 */
export type BuiltModSummary = {
  compareKey: string;
  name: string;
  version?: string;
  enabled: boolean;
};

/** Project a manifest down to what the diff reads. */
export function summarizeBuiltMods(
  mods: readonly EhcollMod[],
): BuiltModSummary[] {
  return mods.map((mod) => ({
    compareKey: mod.compareKey,
    name: mod.name,
    ...(mod.version !== undefined ? { version: mod.version } : {}),
    // Absent means enabled: the manifest omits `false` only for mods that
    // were on, and an older package may not carry the field at all.
    enabled: mod.state?.enabled !== false,
  }));
}

export type DiffEntry = {
  name: string;
  /** Present when known on both sides or the one side that has it. */
  version?: string;
};

export type UpdatedEntry = {
  name: string;
  fromVersion: string;
  toVersion: string;
};

export type ToggledEntry = {
  name: string;
  nowEnabled: boolean;
};

export type CollectionDiff = {
  /** In the profile, not in the shipped collection. */
  added: DiffEntry[];
  /** In the shipped collection, not in the profile any more. */
  removed: DiffEntry[];
  /** Same Nexus mod, different file. */
  updated: UpdatedEntry[];
  /** Same mod, but switched on or off since the build. */
  toggled: ToggledEntry[];
  /** Matched and identical. Counted, because it is the boring majority. */
  unchanged: number;
  /**
   * How many mods could only be matched by NAME.
   *
   * External mods, whose real key needs a hash of the archive or the whole
   * staging folder. Surfaced so "no changes" is never read as stronger than
   * the evidence behind it.
   */
  approximate: number;
};

const shown = (v: string | undefined): string => v ?? "unknown";

/** The key a Nexus mod will have in the next manifest, computed the same way. */
function keyFor(mod: AuditorMod): string | undefined {
  return isNexusSourced(mod)
    ? nexusCompareKey(mod.nexusModId as number, mod.nexusFileId as number)
    : undefined;
}

/** The Nexus mod id inside a `nexus:<modId>:<fileId>` key. */
function nexusModIdOf(compareKey: string): string | undefined {
  const parts = compareKey.split(":");
  return parts[0] === "nexus" && parts.length === 3 ? parts[1] : undefined;
}

/**
 * Diff the shipped collection against the live profile.
 *
 * Pure. `built` is the manifest of the version currently published; `current`
 * is what `getModsForProfile` reports right now.
 */
export function diffCollectionAgainstProfile(args: {
  built: readonly BuiltModSummary[];
  current: readonly AuditorMod[];
}): CollectionDiff {
  const { built, current } = args;

  const builtByKey = new Map<string, BuiltModSummary>();
  const builtByName = new Map<string, BuiltModSummary>();
  for (const mod of built) {
    builtByKey.set(mod.compareKey, mod);
    if (!builtByName.has(mod.name)) builtByName.set(mod.name, mod);
  }

  const diff: CollectionDiff = {
    added: [],
    removed: [],
    updated: [],
    toggled: [],
    unchanged: 0,
    approximate: 0,
  };

  /** Built mods accounted for, so the leftovers are genuine removals. */
  const seen = new Set<string>();

  for (const mod of current) {
    const key = keyFor(mod);
    let match = key === undefined ? undefined : builtByKey.get(key);
    let approximate = false;

    if (match === undefined && key === undefined) {
      // External: the real key costs a hash of the archive or the whole
      // staging folder, which a view opening beside a button cannot spend.
      match = builtByName.get(mod.name);
      approximate = match !== undefined;
    }

    if (match === undefined && key !== undefined) {
      // A Nexus mod with no exact match may still be a NEWER FILE of a mod the
      // collection already has — that is an update, not an addition, and
      // calling it an addition would also make the old file look removed.
      const modId = nexusModIdOf(key);
      const sameMod =
        modId === undefined
          ? undefined
          : built.find(
              (b) => !seen.has(b.compareKey) && nexusModIdOf(b.compareKey) === modId,
            );
      if (sameMod !== undefined) {
        seen.add(sameMod.compareKey);
        diff.updated.push({
          name: mod.name,
          fromVersion: shown(sameMod.version),
          toVersion: shown(mod.version),
        });
        continue;
      }
    }

    if (match === undefined) {
      diff.added.push({
        name: mod.name,
        ...(mod.version !== undefined ? { version: mod.version } : {}),
      });
      continue;
    }

    seen.add(match.compareKey);
    if (approximate) diff.approximate += 1;

    const wasEnabled = match.enabled;
    if (wasEnabled !== mod.enabled) {
      diff.toggled.push({ name: mod.name, nowEnabled: mod.enabled });
    } else {
      diff.unchanged += 1;
    }
  }

  for (const mod of built) {
    if (seen.has(mod.compareKey)) continue;
    diff.removed.push({
      name: mod.name,
      ...(mod.version !== undefined ? { version: mod.version } : {}),
    });
  }

  return diff;
}

/** True when the profile still matches what was shipped. */
export function isUnchanged(diff: CollectionDiff): boolean {
  return (
    diff.added.length === 0 &&
    diff.removed.length === 0 &&
    diff.updated.length === 0 &&
    diff.toggled.length === 0
  );
}

/**
 * The summary line above the diff.
 *
 * Says what a rebuild WOULD do rather than what happened, because that is the
 * decision in front of the curator.
 */
export function describeCollectionDiff(diff: CollectionDiff): string {
  if (isUnchanged(diff)) {
    return (
      `Your profile still matches the published version — ${diff.unchanged} ` +
      `mod(s), nothing added, removed, updated or toggled.`
    );
  }
  const parts: string[] = [];
  if (diff.added.length > 0) parts.push(`${diff.added.length} added`);
  if (diff.removed.length > 0) parts.push(`${diff.removed.length} removed`);
  if (diff.updated.length > 0) parts.push(`${diff.updated.length} updated`);
  if (diff.toggled.length > 0) parts.push(`${diff.toggled.length} toggled`);
  const head = `Rebuilding would ship ${parts.join(", ")}.`;
  return diff.approximate > 0
    ? `${head} ${diff.approximate} external mod(s) could only be matched by ` +
        `name — their real identity is a hash of the archive, which is only ` +
        `computed during a build.`
    : head;
}
