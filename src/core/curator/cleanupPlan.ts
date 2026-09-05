/**
 * ──────────────────────────────────────────────────────────────────────
 * What could be deleted, and — more importantly — what could not.
 *
 * Vortex never removes anything. Every version of every mod you have ever
 * downloaded stays in the download folder, and every superseded install stays
 * in staging. Measured on the real Skyrim profile: 163 GB of downloads, of
 * which 968 files across 371 mods are older versions of something — 73 GB.
 *
 * This is the planning half, and it is pure so that the dangerous half has
 * nothing to decide. It produces a report a human reads before anything is
 * touched; deleting is a separate, explicit act.
 *
 * ─── THE ORDER IS LOAD-BEARING ─────────────────────────────────────────
 * A mod entry is what HOLDS a reference to an archive. So an old version's
 * archive is not deletable while the old mod is still installed — remove the
 * mod first and the archive becomes an orphan, then it can go. The plan is
 * computed in that order and says so, because a curator who deletes archives
 * first is deleting the only copy of something Vortex still points at.
 *
 * ─── AND THE BUILD NEEDS ARCHIVES ──────────────────────────────────────
 * Event Horizon hashes the archive of every installed mod at build time. An
 * archive referenced by ANY mod record — enabled or not, any profile — is
 * never a candidate here. Getting that wrong recreates the "771 archives
 * missing" failure this project already had once.
 *
 * ─── AN ORPHAN IS NOT AUTOMATICALLY RUBBISH ────────────────────────────
 * An archive nothing references may be a superseded version, or it may be
 * something the curator downloaded on purpose and has not installed yet.
 * Those are indistinguishable by reference count alone, so they are split:
 * an orphan with a NEWER version of the same Nexus mod installed is
 * superseded; one with nothing installed is reported separately and never
 * selected by default. Deleting a deliberate download to save space is the
 * one outcome worse than not saving it.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { CuratorMod } from "./profileActions";

/** One archive as Vortex's download store describes it. */
export type DownloadEntry = {
  /** Vortex's download id — what `mod.archiveId` points at. */
  id: string;
  fileName: string;
  bytes: number;
  /** Nexus mod id, when Vortex recorded one. */
  nexusModId?: number;
  /** Nexus file id, when Vortex recorded one. */
  nexusFileId?: number;
};

export type ModRemoval = {
  mod: CuratorMod;
  /** The installed version that replaces it. */
  supersededBy: CuratorMod;
};

export type ArchiveRemoval = {
  entry: DownloadEntry;
  /**
   * - `orphan-superseded` — nothing references it AND a newer version of the
   *   same Nexus mod is installed. Safe.
   * - `freed-by-removal`  — referenced only by a mod this plan removes, so it
   *   becomes an orphan once that removal happens.
   */
  reason: "orphan-superseded" | "freed-by-removal";
};

export type CleanupPlan = {
  /** Old mod entries to remove, via Vortex so its state stays consistent. */
  removeMods: ModRemoval[];
  /** Archives deletable once the removals above have happened. */
  deleteArchives: ArchiveRemoval[];
  bytesFreed: number;
  /**
   * Orphans with NO version of that mod installed.
   *
   * Reported, never planned. A download the curator made deliberately and has
   * not installed looks exactly like a leftover from here.
   */
  unclearOrphans: { entry: DownloadEntry }[];
  unclearBytes: number;
  /** Archives left alone because a mod still points at them. */
  keptReferenced: number;
};

/**
 * Which installed mods are older versions of another installed mod.
 *
 * Only same-page duplicates with a comparable pair of file ids qualify: two
 * installs of the SAME file are a different problem, and without file ids
 * there is no ordering, so no way to say which is older.
 */
export function findSupersededMods(
  mods: readonly CuratorMod[],
): ModRemoval[] {
  const byModId = new Map<number, CuratorMod[]>();
  for (const mod of mods) {
    if (mod.nexusModId === undefined || mod.nexusFileId === undefined) continue;
    const list = byModId.get(mod.nexusModId);
    if (list === undefined) byModId.set(mod.nexusModId, [mod]);
    else list.push(mod);
  }

  const out: ModRemoval[] = [];
  for (const group of byModId.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(
      (a, b) => (b.nexusFileId ?? 0) - (a.nexusFileId ?? 0),
    );
    const newest = sorted[0]!;
    for (const older of sorted.slice(1)) {
      // Equal file ids are the same file installed twice — redundant, but not
      // a VERSION question, and picking a loser between identical twins is a
      // different decision than retiring an older release.
      if (older.nexusFileId === newest.nexusFileId) continue;
      out.push({ mod: older, supersededBy: newest });
    }
  }
  return out;
}

/**
 * The whole plan, in the order it has to happen.
 *
 * `mods` must carry `archiveId` for the reference check to mean anything; a
 * mod whose archive is unknown protects nothing, so its archive is treated as
 * referenced rather than free.
 */
export function planCleanup(args: {
  mods: readonly CuratorMod[];
  downloads: readonly DownloadEntry[];
}): CleanupPlan {
  const { mods, downloads } = args;

  const removeMods = findSupersededMods(mods);
  const removedIds = new Set(removeMods.map((r) => r.mod.id));

  // Every archive still spoken for AFTER the removals above.
  const stillReferenced = new Set<string>();
  for (const mod of mods) {
    if (removedIds.has(mod.id)) continue;
    if (mod.archiveId !== undefined && mod.archiveId !== "") {
      stillReferenced.add(mod.archiveId);
    }
  }
  // What the removed mods were holding — these become free, and are the only
  // reason the removal has to happen first.
  const freedByRemoval = new Set<string>();
  for (const removal of removeMods) {
    const archiveId = removal.mod.archiveId;
    if (archiveId !== undefined && archiveId !== "" && !stillReferenced.has(archiveId)) {
      freedByRemoval.add(archiveId);
    }
  }

  /** Nexus mod ids the curator still has installed after the removals. */
  const installedNexusIds = new Set<number>();
  for (const mod of mods) {
    if (removedIds.has(mod.id)) continue;
    if (mod.nexusModId !== undefined) installedNexusIds.add(mod.nexusModId);
  }

  const deleteArchives: ArchiveRemoval[] = [];
  const unclearOrphans: { entry: DownloadEntry }[] = [];
  let keptReferenced = 0;

  for (const entry of downloads) {
    if (stillReferenced.has(entry.id)) {
      keptReferenced += 1;
      continue;
    }
    if (freedByRemoval.has(entry.id)) {
      deleteArchives.push({ entry, reason: "freed-by-removal" });
      continue;
    }
    // Orphan. Superseded only if some version of the same mod survives.
    if (
      entry.nexusModId !== undefined &&
      installedNexusIds.has(entry.nexusModId)
    ) {
      deleteArchives.push({ entry, reason: "orphan-superseded" });
    } else {
      unclearOrphans.push({ entry });
    }
  }

  return {
    removeMods,
    deleteArchives,
    bytesFreed: deleteArchives.reduce((n, a) => n + a.entry.bytes, 0),
    unclearOrphans,
    unclearBytes: unclearOrphans.reduce((n, o) => n + o.entry.bytes, 0),
    keptReferenced,
  };
}

/** Bytes as something a person reads. */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * The report a curator reads before anything is deleted.
 *
 * Leads with what will be REMOVED rather than what will be freed. A cleanup
 * screen that opens with a number is selling; this one has to be read.
 */
export function describeCleanupPlan(plan: CleanupPlan): string[] {
  const lines: string[] = [];
  if (plan.removeMods.length === 0 && plan.deleteArchives.length === 0) {
    lines.push("Nothing to clean up — no superseded installs, no loose archives.");
  } else {
    lines.push(
      `${plan.removeMods.length} old mod install(s) would be removed through ` +
        `Vortex, then ${plan.deleteArchives.length} archive(s) deleted ` +
        `permanently, freeing ${formatSize(plan.bytesFreed)}.`,
    );
    lines.push(
      "The order matters: a mod entry is what holds a reference to its " +
        "archive, so the installs go first and the archives become deletable " +
        "as a result.",
    );
  }
  if (plan.keptReferenced > 0) {
    lines.push(
      `${plan.keptReferenced} archive(s) are left alone because a mod still ` +
        `points at them. Event Horizon hashes those when you build.`,
    );
  }
  if (plan.unclearOrphans.length > 0) {
    lines.push(
      `${plan.unclearOrphans.length} archive(s) (${formatSize(plan.unclearBytes)}) ` +
        `belong to mods you have no version of installed. They could be ` +
        `leftovers, or downloads you have not installed yet — they look ` +
        `identical from here, so they are NOT included. Delete those by hand.`,
    );
  }
  return lines;
}
