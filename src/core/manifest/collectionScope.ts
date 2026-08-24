/**
 * ──────────────────────────────────────────────────────────────────────
 * Which of a profile's mods belong in the collection.
 *
 * Vortex's staging folder is NOT the profile. It holds every mod ever
 * installed for the game: mods belonging to other profiles, mods this profile
 * has switched off, and superseded duplicate installs. Measured on the
 * curator's own Fallout 4 profile — 992 staging folders, 939 tracked by the
 * profile, of which 37 disabled, and **123 Nexus mods occupying 304 folders**.
 *
 * `getModsForProfile` already narrows staging to what the profile tracks, by
 * mod id rather than by folder name. This narrows it the rest of the way.
 *
 * ## Disabled mods are not part of the collection
 *
 * A profile IS its set of enabled mods — that is what a profile is for. A mod
 * the curator switched off is not something they are shipping, so it does not
 * belong in the package, and paying to hash, walk and verify it is waste.
 *
 * This also resolves duplicate identities for free. Two installs of the same
 * Nexus file produce the same `compareKey`, and a manifest cannot hold two
 * mods with one identity — that is 7 hard build errors on this profile. In
 * every one of those 7, exactly one copy is enabled, so scoping to enabled
 * removes the collision without needing a tie-break rule at all. The
 * both-enabled and neither-enabled cases do not occur here, but they are
 * reported rather than silently guessed at.
 *
 * ## Several ENABLED installs of the SAME mod are reported, not resolved
 *
 * An upgrade whose old folder was never removed leaves two enabled installs of
 * one mod at different versions. Worth telling the curator about; not worth
 * deciding for them, since a second install is occasionally deliberate.
 *
 * The trap is that a Nexus MOD PAGE is not a mod. One page routinely hosts many
 * distinct files that are all meant to be installed together — a base plus its
 * addons, four different guns, five icon packs. Grouping by page id and
 * flagging version differences therefore flags all of those: measured on the
 * curator's profile, **74 groups, and all 74 were different files**. A
 * detector with a 100% false-positive rate does not just waste the reader's
 * time, it teaches them to ignore the warnings that matter.
 *
 * So membership requires the same page id AND the same underlying mod, by
 * normalising Vortex's `<name>-<modId>-<version>-<timestamp>` folder
 * convention back to the name. That convention is not guaranteed, so when
 * normalisation fails the two look like different mods and nothing is
 * reported — under-reporting rather than crying wolf.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { AuditorMod } from "../getModsListForProfile";

export type CollectionScope = {
  /** Mods that belong in the collection: the profile's enabled mods. */
  included: AuditorMod[];
  /** Excluded because the profile has them switched off. */
  excludedDisabled: AuditorMod[];
  /**
   * Identities that would still collide after scoping — i.e. more than one
   * ENABLED install of the same Nexus file. Empty on a healthy profile;
   * non-empty means the manifest will reject the build, so say so early.
   */
  collidingIdentities: DuplicateInstallGroup[];
  /**
   * The SAME mod installed more than once and left enabled. Advisory: usually
   * an upgrade whose old folder survived.
   */
  multipleInstalls: DuplicateInstallGroup[];
};

export type DuplicateInstallGroup = {
  /** `nexus:<modId>` for the version-level view, `nexus:<modId>:<fileId>` for identity. */
  key: string;
  mods: Array<{ id: string; name: string; version?: string; installationPath?: string }>;
};

/**
 * Reduce a staging folder name to the mod behind it.
 *
 * Vortex names an install folder `<name>-<modId>-<version>-<timestamp>` and
 * appends `.1`, `.2` … when the same archive is installed again. Stripping
 * both leaves the name, which is what distinguishes "the same mod twice" from
 * "two files off one mod page".
 */
function normalizeInstallName(m: AuditorMod): string {
  const raw = m.installationPath ?? m.name;
  const reinstall = /^(.*)\.\d+$/.exec(raw);
  const base = reinstall !== null ? reinstall[1]! : raw;
  return base
    .replace(/-\d+(-[0-9A-Za-z]+)*-\d{9,}$/, "")
    .trim()
    .toLowerCase();
}

const describe = (m: AuditorMod): DuplicateInstallGroup["mods"][number] => ({
  id: m.id,
  name: m.name,
  ...(m.version !== undefined ? { version: m.version } : {}),
  ...(m.installationPath !== undefined ? { installationPath: m.installationPath } : {}),
});

function groupBy(
  mods: AuditorMod[],
  key: (m: AuditorMod) => string | undefined,
): DuplicateInstallGroup[] {
  const buckets = new Map<string, AuditorMod[]>();
  for (const mod of mods) {
    const k = key(mod);
    if (k === undefined) continue;
    const bucket = buckets.get(k);
    if (bucket === undefined) buckets.set(k, [mod]);
    else bucket.push(mod);
  }
  return [...buckets.entries()]
    .filter(([, v]) => v.length > 1)
    .map(([k, v]) => ({ key: k, mods: v.map(describe) }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Narrow a profile's mods to those the collection should contain.
 *
 * Pure and total: no I/O, and it never throws. A profile with nothing enabled
 * yields an empty `included`, which the caller should treat as "nothing to
 * build" rather than as an error from here.
 */
export function scopeCollectionMods(mods: AuditorMod[]): CollectionScope {
  const included: AuditorMod[] = [];
  const excludedDisabled: AuditorMod[] = [];
  for (const mod of mods) {
    if (mod.enabled) included.push(mod);
    else excludedDisabled.push(mod);
  }

  return {
    included,
    excludedDisabled,
    // Exact identity — what buildManifest's compareKey rejects.
    collidingIdentities: groupBy(included, (m) =>
      m.nexusModId !== undefined && m.nexusFileId !== undefined
        ? `nexus:${String(m.nexusModId)}:${String(m.nexusFileId)}`
        : undefined,
    ),
    // The same mod, installed twice and both left on. Keyed by page id AND
    // normalised name, because one page hosts many genuinely distinct files.
    multipleInstalls: groupBy(included, (m) =>
      m.nexusModId !== undefined
        ? `nexus:${String(m.nexusModId)}|${normalizeInstallName(m)}`
        : undefined,
    ),
  };
}

/** Curator-facing lines for {@link CollectionScope}. Empty when nothing to say. */
export function describeScope(scope: CollectionScope): string[] {
  const out: string[] = [];

  for (const group of scope.collidingIdentities) {
    out.push(
      `${group.mods.length} enabled installs share one identity (${group.key}): ` +
        `${group.mods.map((m) => `"${m.name}"`).join(", ")}. A collection cannot ` +
        `contain the same mod twice — disable or remove all but one before building.`,
    );
  }

  if (scope.multipleInstalls.length > 0) {
    const shown = scope.multipleInstalls.slice(0, 8);
    for (const group of shown) {
      out.push(
        `"${group.mods[0]!.name}" is installed ${group.mods.length} times and all ` +
          `copies are enabled (versions: ${group.mods
            .map((m) => m.version ?? "?")
            .join(", ")}). Usually an upgrade whose old folder was never removed — ` +
          `worth checking, but shipped as-is.`,
      );
    }
    if (scope.multipleInstalls.length > shown.length) {
      out.push(
        `${scope.multipleInstalls.length - shown.length} further mod(s) have ` +
          `multiple enabled installs; see the event-horizon log for the full list.`,
      );
    }
  }

  return out;
}
