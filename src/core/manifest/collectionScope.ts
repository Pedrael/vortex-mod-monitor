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
 * ## Several ENABLED installs of one mod are reported, not resolved
 *
 * Beyond exact-identity collisions, one Nexus mod often has several installs
 * at DIFFERENT file versions, both enabled — usually an upgrade whose old
 * folder was never removed, but sometimes deliberate (a mod split across
 * parts). Nothing here can tell those apart, so nothing here decides: the
 * curator gets a list and makes the call.
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
   * One Nexus mod with several enabled installs at different file versions.
   * Advisory: probably an upgrade leftover, possibly deliberate.
   */
  multipleInstalls: DuplicateInstallGroup[];
};

export type DuplicateInstallGroup = {
  /** `nexus:<modId>` for the version-level view, `nexus:<modId>:<fileId>` for identity. */
  key: string;
  mods: Array<{ id: string; name: string; version?: string; installationPath?: string }>;
};

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
    // Same mod page, different files: legal in a manifest, suspicious on disk.
    multipleInstalls: groupBy(included, (m) =>
      m.nexusModId !== undefined ? `nexus:${String(m.nexusModId)}` : undefined,
    ).filter((g) => {
      const versions = new Set(g.mods.map((x) => x.version ?? ""));
      return versions.size > 1;
    }),
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
        `"${group.mods[0]!.name}" has ${group.mods.length} enabled installs at ` +
          `different versions (${group.mods
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
