/**
 * ──────────────────────────────────────────────────────────────────────
 * What a curator can act on across their whole profile, decided in one place.
 *
 * Vortex manages mods one at a time and ships exactly one bulk operation —
 * update — which installs concurrently and loses files while doing it. The
 * rest a curator does by hand, several hundred times, or not at all.
 *
 * This is the decision layer for a view that offers those actions properly.
 * Pure: it takes a snapshot of what Vortex knows and returns what could be
 * done. Nothing here touches Vortex, the network or a disk, so every rule
 * below is testable without any of them.
 *
 * ─── ITS OWN SHAPE, NOT AuditorMod ─────────────────────────────────────
 * `AuditorMod` is the COLLECTION snapshot and carries what a package needs;
 * update availability and endorsement are Vortex view-state that no package
 * should record. Extending it was also measured as the wrong move on its own
 * terms: `impact` on `getModsForProfile` reports CRITICAL — 22 symbols across
 * build, install, doctor, resolver and actions — so a field added for this
 * view would ripple through five subsystems that have no use for it.
 *
 * ─── VERSIONS ARE COMPARED BY FILE ID, NEVER BY VERSION STRING ─────────
 * "1.10" sorts below "1.9" as a string and above it as a version, and authors
 * write versions in whatever shape they like — "v2", "2.0.1a", "1.0-RC3", a
 * date. Nexus's file id is an integer that only increases, and Vortex already
 * records the installed one and the newest one. So "is there an update" is a
 * comparison of two integers, and the version strings are carried only to
 * SHOW the curator, never to decide.
 *
 * ─── A DUPLICATE IS A LEAD, NOT A VERDICT ──────────────────────────────
 * Two installs from one Nexus page is usually an old version left behind, and
 * legitimately it is a main file plus an optional one from the same page.
 * Those are indistinguishable from here and only the curator knows which they
 * are, so the ambiguous case is reported as something to look at. The
 * unambiguous one — the SAME FILE installed twice — is stated plainly.
 * ──────────────────────────────────────────────────────────────────────
 */

/** One mod as the curator view sees it, read from live Vortex state. */
export type CuratorMod = {
  /** Vortex's mod id — the handle every action needs. */
  id: string;
  name: string;
  enabled: boolean;
  /** Vortex modType. Empty string is the default (deploys to Data). */
  modType: string;
  /** Installed version, for display only. */
  version?: string;
  /** Newest version Nexus knows about, for display only. */
  newestVersion?: string;
  nexusModId?: number;
  nexusFileId?: number;
  /** Newest file id Nexus knows about. The only thing update logic reads. */
  newestFileId?: number;
  /** Vortex's endorsement state: "Undecided" | "Endorsed" | "Abstained". */
  endorsed?: string;
  /**
   * Vortex's download id for the archive this mod was installed from.
   *
   * The cleanup planner's whole safety rule reads this: an archive any mod
   * points at is never deletable, because the build hashes it. Absent means
   * Vortex tracks no source, which protects nothing.
   */
  archiveId?: string;
  /**
   * OUR flag: the version the curator froze this mod at.
   *
   * Vortex has no mod pin concept — the only `pinned` in its API is for tools
   * — so this is an attribute of our own and means nothing to Vortex. It
   * cannot stop Vortex's own update button. What it does is keep the mod out
   * of OUR bulk update and make a version change afterwards visible.
   */
  frozenAtVersion?: string;
};

/** A mod with a newer file on Nexus, and nothing stopping it being taken. */
export type UpdateCandidate = {
  mod: CuratorMod;
  fromFileId: number;
  toFileId: number;
  fromVersion: string;
  toVersion: string;
};

const shown = (v: string | undefined): string => v ?? "unknown";

/**
 * Mods with a newer file available, excluding frozen ones.
 *
 * Frozen mods are filtered HERE rather than at the call site, so no future
 * caller can offer to update one by forgetting to ask.
 */
export function findUpdatable(mods: readonly CuratorMod[]): UpdateCandidate[] {
  const out: UpdateCandidate[] = [];
  for (const mod of mods) {
    if (mod.frozenAtVersion !== undefined) continue;
    if (mod.nexusFileId === undefined || mod.newestFileId === undefined) continue;
    // Strictly greater, not merely different. Vortex can carry a stale
    // `newestFileId` from before a mod was updated by hand, and treating that
    // as an update would install a file OLDER than the one present — a
    // downgrade wearing an update's clothes.
    if (mod.newestFileId <= mod.nexusFileId) continue;
    out.push({
      mod,
      fromFileId: mod.nexusFileId,
      toFileId: mod.newestFileId,
      fromVersion: shown(mod.version),
      toVersion: shown(mod.newestVersion),
    });
  }
  return out;
}

/** A frozen mod, and whether the freeze still holds. */
export type FrozenMod = {
  mod: CuratorMod;
  frozenAtVersion: string;
  /** Present when the installed version no longer matches the frozen one. */
  driftedTo?: string;
  /** True when Nexus has something newer — the freeze is doing work. */
  updateWithheld: boolean;
};

/**
 * Every frozen mod, with the freeze's current standing.
 *
 * The drift arm is the entire point of freezing. We cannot stop Vortex
 * updating a mod from its own UI, so the guarantee is not "it cannot change"
 * but "you will know if it did" — and a promise to notice is only kept if
 * something actually looks.
 */
export function findFrozen(mods: readonly CuratorMod[]): FrozenMod[] {
  const out: FrozenMod[] = [];
  for (const mod of mods) {
    if (mod.frozenAtVersion === undefined) continue;
    const drifted =
      mod.version !== undefined && mod.version !== mod.frozenAtVersion;
    out.push({
      mod,
      frozenAtVersion: mod.frozenAtVersion,
      ...(drifted ? { driftedTo: mod.version } : {}),
      updateWithheld:
        mod.nexusFileId !== undefined &&
        mod.newestFileId !== undefined &&
        mod.newestFileId > mod.nexusFileId,
    });
  }
  return out;
}

/** Mods that can be endorsed: from Nexus, and not answered yet. */
export function findEndorsable(mods: readonly CuratorMod[]): CuratorMod[] {
  return mods.filter(
    (m) =>
      m.nexusModId !== undefined &&
      // Vortex writes "Undecided" for untouched and leaves the field absent on
      // mods it has never asked about. Both mean "not answered".
      (m.endorsed === undefined || m.endorsed === "Undecided"),
  );
}

export type DuplicateGroup = {
  nexusModId: number;
  mods: CuratorMod[];
  /**
   * - `same-file` — the identical Nexus file installed more than once. There
   *                 is no reading where both copies are wanted.
   * - `same-page` — one page, different files. Could be an old version left
   *                 behind, could be a main file plus an optional one. A lead
   *                 for the curator, never a verdict from us.
   */
  kind: "same-file" | "same-page";
};

/**
 * Installs that share a Nexus mod id.
 *
 * Reported in two kinds because they deserve different confidence. One
 * "duplicates" number would sit a legitimate main-plus-patch pair next to a
 * genuinely stale copy and invite the curator to delete either.
 */
export function findDuplicates(mods: readonly CuratorMod[]): DuplicateGroup[] {
  const byModId = new Map<number, CuratorMod[]>();
  for (const mod of mods) {
    if (mod.nexusModId === undefined) continue;
    const list = byModId.get(mod.nexusModId);
    if (list === undefined) byModId.set(mod.nexusModId, [mod]);
    else list.push(mod);
  }

  const out: DuplicateGroup[] = [];
  for (const [nexusModId, group] of byModId) {
    if (group.length < 2) continue;
    // One distinct file id across two or more installs means the same file
    // twice. `undefined` counts as one value, which is right: two installs
    // that both lack a file id are still indistinguishable from each other.
    const fileIds = new Set(group.map((m) => m.nexusFileId));
    out.push({
      nexusModId,
      mods: group,
      kind: fileIds.size === 1 ? "same-file" : "same-page",
    });
  }
  return out.sort((a, b) => a.nexusModId - b.nexusModId);
}

/** Headline counts, so the page can be read before it is used. */
export function summarizeProfile(mods: readonly CuratorMod[]): {
  total: number;
  enabled: number;
  updatable: number;
  frozen: number;
  frozenDrifted: number;
  endorsable: number;
  duplicateGroups: number;
} {
  const frozen = findFrozen(mods);
  return {
    total: mods.length,
    enabled: mods.filter((m) => m.enabled).length,
    updatable: findUpdatable(mods).length,
    frozen: frozen.length,
    frozenDrifted: frozen.filter((f) => f.driftedTo !== undefined).length,
    endorsable: findEndorsable(mods).length,
    duplicateGroups: findDuplicates(mods).length,
  };
}
