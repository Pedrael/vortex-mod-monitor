/**
 * Verify a staging folder against the ARCHIVE it came from.
 *
 * The second reference. `captureStagingFiles` records the curator's disk, so a
 * curator whose own install silently lost files ships those omissions as the
 * etalon. This compares staging against what the archive itself declares, which
 * no one's extraction can corrupt.
 *
 * ─── MEASURED ON THE REAL PROFILE, NOT ASSUMED ────────────────────────
 * 14-mod sample of a 939-mod Fallout 4 setup, matching staged files to archive
 * entries by (size, crc32):
 *
 *   411 staged files, 397 matched  (96.6%)
 *    14 staged files with no archive counterpart
 *    37 of 434 archive entries never staged  (8.5%)
 *
 * Matching is by CONTENT, not path, and that is what makes 96.6% possible: a
 * FOMOD installs `<file source destination>`, so a staged file's path routinely
 * has no counterpart in the archive. Its bytes do.
 *
 * ─── WHY UNMATCHED IS "UNEXPLAINED", NEVER "CORRUPT" ──────────────────
 * One sampled mod matched ZERO files. Same mod version, same archive, same
 * three filenames — and every file differed in both size and CRC:
 *
 *   Main.ba2      1,430,914 archive  ->  1,369,294 staged
 *   Textures.ba2  122,430,936        ->  91,398,814
 *   *.esl         181,786            ->  185,023
 *
 * BA2s smaller, plugin larger: the signature of post-install tooling —
 * texture/BA2 repacking, plugin cleaning. Entirely legitimate, and common in
 * exactly the large curated setups this feature targets.
 *
 * So a staged file absent from its archive means "this content did not come
 * from the archive", which has several innocent causes. Reporting it as
 * corruption would fire hardest on the power users who optimise their setups.
 * The curator knows whether they ran an optimiser; the tool does not. We report
 * and let them judge.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { ArchiveEntry, ArchiveListing } from "./archiveContents";

/** A staged file as captured by the staging walker. */
export type StagedFileRef = {
  /** POSIX-style path relative to the mod's staging root. */
  path: string;
  size: number;
  /** Lowercase hex CRC32, when computed. Absent ⇒ can only match on size. */
  crc?: string;
};

export type StagedFileVerdict = {
  file: StagedFileRef;
  /**
   * - `matched`      — an archive entry has identical size AND crc.
   * - `size-only`    — sizes agree but one side has no crc. Weak evidence.
   * - `unexplained`  — no archive entry with this content. NOT "corrupt":
   *                    post-install tooling, generated files and Vortex
   *                    bookkeeping all land here. See the module note.
   */
  kind: "matched" | "size-only" | "unexplained";
  /** The archive entry that explained it, when one did. */
  via?: ArchiveEntry;
};

export type ArchiveVerificationResult = {
  verdicts: StagedFileVerdict[];
  matched: number;
  sizeOnly: number;
  unexplained: number;
  /**
   * Archive entries whose content appears nowhere in staging.
   *
   * The omission signal — but ambiguous on its own. A FOMOD legitimately
   * installs a subset, so "never staged" covers both "not selected" and
   * "Vortex lost it". Measured at 8.5% on a real profile, dominated by the
   * former. Disambiguating needs the FOMOD script; see `fomodReplay`.
   */
  archiveEntriesNotStaged: ArchiveEntry[];
  /**
   * Fraction of staged files explained by the archive, counting `size-only`.
   * `1` when the mod stages nothing.
   */
  explainedRatio: number;
  /** Echoed so callers can weigh the result — a listing with no CRCs is weak. */
  crcCoverage: number;
};

/**
 * Compare a staging file list against an archive listing.
 *
 * Pure: no I/O, no Vortex, no filesystem. Both inputs are captured elsewhere,
 * which keeps this testable and keeps the policy decision (what to DO about an
 * unexplained file) with the caller.
 */
export function verifyStagingAgainstArchive(
  staged: StagedFileRef[],
  listing: ArchiveListing,
): ArchiveVerificationResult {
  const entries = listing.entries;
  // Consumption is tracked PER ENTRY, not per content key. One archive entry
  // may be reachable both by an exact (size, crc) lookup and by a size-only
  // fallback, and it must not be spendable twice.
  const consumed = new Array<boolean>(entries.length).fill(false);

  // Two views over the same entries. The size-only view is required because a
  // STAGED file may lack a crc while the archive entry has one — keying the
  // fallback on the staged file's own (absent) crc would miss it entirely.
  const byExact = new Map<string, number[]>();
  const bySize = new Map<number, number[]>();
  entries.forEach((entry, i) => {
    if (entry.size !== undefined && entry.crc !== undefined) {
      const key = `${entry.size}:${entry.crc}`;
      const bucket = byExact.get(key);
      if (bucket === undefined) byExact.set(key, [i]);
      else bucket.push(i);
    }
    if (entry.size !== undefined) {
      const bucket = bySize.get(entry.size);
      if (bucket === undefined) bySize.set(entry.size, [i]);
      else bucket.push(i);
    }
  });

  const takeFirstUnconsumed = (indices: number[] | undefined): number | undefined => {
    if (indices === undefined) return undefined;
    for (const i of indices) {
      if (!consumed[i]) return i;
    }
    return undefined;
  };

  const verdicts: StagedFileVerdict[] = [];
  let matched = 0;
  let sizeOnly = 0;
  let unexplained = 0;

  for (const file of staged) {
    // Exact: both sides carry a crc and they agree.
    const exactIdx =
      file.crc === undefined
        ? undefined
        : takeFirstUnconsumed(byExact.get(`${file.size}:${file.crc}`));
    if (exactIdx !== undefined) {
      consumed[exactIdx] = true;
      matched += 1;
      verdicts.push({ file, kind: "matched", via: entries[exactIdx] });
      continue;
    }

    // Size-only: weak evidence, never promoted to `matched`. Reached when
    // either side lacks a crc — NOT when two crcs disagree, which is a real
    // content difference and must stay unexplained.
    const eitherSideLacksCrc = (idx: number): boolean =>
      file.crc === undefined || entries[idx].crc === undefined;
    const sizeCandidates = (bySize.get(file.size) ?? []).filter(
      (i) => !consumed[i] && eitherSideLacksCrc(i),
    );
    const looseIdx = sizeCandidates[0];
    if (looseIdx !== undefined) {
      consumed[looseIdx] = true;
      sizeOnly += 1;
      verdicts.push({ file, kind: "size-only", via: entries[looseIdx] });
      continue;
    }

    unexplained += 1;
    verdicts.push({ file, kind: "unexplained" });
  }

  const archiveEntriesNotStaged = entries.filter((_e, i) => !consumed[i]);

  return {
    verdicts,
    matched,
    sizeOnly,
    unexplained,
    archiveEntriesNotStaged,
    explainedRatio: staged.length === 0 ? 1 : (matched + sizeOnly) / staged.length,
    crcCoverage: listing.crcCoverage,
  };
}
