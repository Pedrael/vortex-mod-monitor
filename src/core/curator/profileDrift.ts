/**
 * ──────────────────────────────────────────────────────────────────────
 * Did the profile move since we looked at it?
 *
 * A finished build holds the mod list it was computed from. Coming back to
 * that screen an hour later, the decisions on it — which diverged mods to
 * mirror, which to bundle — are about a profile that may no longer exist.
 *
 * The build result stays readable either way: it is a record of what WAS
 * built, and a package on disk does not become wrong because a mod was
 * enabled afterwards. So this does not gate anything. It exists so the
 * screen can SAY the picture is stale rather than presenting an old one as
 * current.
 *
 * ─── KEYED ON VORTEX'S OWN MOD ID ──────────────────────────────────────
 * Not on Nexus ids, and not on names. Vortex's mod id is the handle that
 * survives everything this comparison cares about — a mod being enabled, its
 * type changed, its attributes filled in later — and it is the only id every
 * mod has. A mod that was reinstalled gets a new one, which reads here as a
 * removal plus an addition; that is a real change and saying so is correct.
 *
 * ─── AND IT ONLY SEES WHAT VORTEX KNOWS ────────────────────────────────
 * A curator who edits a mesh inside a staging folder changes nothing here:
 * no mod was added, removed, toggled or re-versioned. That is a real limit,
 * not an oversight — detecting it means re-hashing the staging tree, which
 * is the minutes-long work this whole feature exists to avoid repeating. The
 * wording upstream must therefore never promise more than "Vortex reports no
 * changes".
 * ──────────────────────────────────────────────────────────────────────
 */

/** The little of a mod this comparison reads. */
export type DriftMod = {
  id: string;
  name: string;
  enabled: boolean;
  version?: string;
  modType?: string;
};

export type ProfileDrift = {
  /** In the profile now, not when we looked. */
  added: string[];
  /** Was there, gone now. */
  removed: string[];
  /** Same mod, switched on or off. */
  toggled: string[];
  /** Same mod, different version or kind. */
  changed: string[];
};

export function profileDriftSince(
  before: readonly DriftMod[],
  after: readonly DriftMod[],
): ProfileDrift {
  const wasById = new Map(before.map((m) => [m.id, m] as const));
  const drift: ProfileDrift = {
    added: [],
    removed: [],
    toggled: [],
    changed: [],
  };

  const seen = new Set<string>();
  for (const mod of after) {
    const was = wasById.get(mod.id);
    if (was === undefined) {
      drift.added.push(mod.name);
      continue;
    }
    seen.add(mod.id);
    if (was.enabled !== mod.enabled) {
      drift.toggled.push(mod.name);
      // A mod that was both toggled AND re-versioned is one changed mod, and
      // counting it twice would overstate how much moved.
      continue;
    }
    if (was.version !== mod.version || was.modType !== mod.modType) {
      drift.changed.push(mod.name);
    }
  }

  for (const mod of before) {
    if (!seen.has(mod.id)) drift.removed.push(mod.name);
  }

  return drift;
}

/** True when Vortex reports the profile exactly as it was. */
export function isProfileUnmoved(drift: ProfileDrift): boolean {
  return (
    drift.added.length === 0 &&
    drift.removed.length === 0 &&
    drift.toggled.length === 0 &&
    drift.changed.length === 0
  );
}

/**
 * The drift in a sentence.
 *
 * Says "Vortex reports" rather than "nothing changed", because a file edited
 * by hand inside a staging folder is invisible from here and the difference
 * between those two claims is the whole honesty of the message.
 */
export function describeProfileDrift(drift: ProfileDrift): string {
  if (isProfileUnmoved(drift)) {
    return "Vortex reports no changes to your profile since this build.";
  }
  const parts: string[] = [];
  if (drift.added.length > 0) parts.push(`${drift.added.length} added`);
  if (drift.removed.length > 0) parts.push(`${drift.removed.length} removed`);
  if (drift.toggled.length > 0) parts.push(`${drift.toggled.length} toggled`);
  if (drift.changed.length > 0) parts.push(`${drift.changed.length} changed`);
  return `Your profile has moved since this build — ${parts.join(", ")}.`;
}
