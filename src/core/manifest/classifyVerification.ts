/**
 * Combine the two references so neither one's weakness becomes a false alarm.
 *
 * ─── THE PROBLEM THIS SOLVES ──────────────────────────────────────────
 * `verifyModInstall` compares the user's staging folder against the CURATOR'S
 * staging folder. That silently assumes the curator's files are the archive's
 * files. They frequently are not: BA2 repacking, texture optimisation and
 * plugin cleaning all rewrite staged files in place, and are routine in exactly
 * the large curated setups this extension targets. Confirmed on the real
 * profile — one mod's staged files differed from its own archive in both size
 * and CRC across all three files (BA2s smaller, plugin larger).
 *
 * The consequence is not cosmetic. The driver treats a verification failure as
 * a reason to UNINSTALL AND REINSTALL the mod, re-verify, and then surface a
 * failure to the user. A curator who optimised their setup would therefore make
 * every optimised mod fail on every user's machine, pay a full reinstall for
 * each, fail again — because reinstalling reproduces the ARCHIVE's bytes, never
 * the curator's optimised ones — and end with an alarming report about files
 * that were never broken.
 *
 * ─── WHY TWO REFERENCES FIX IT ────────────────────────────────────────
 * Each reference is authoritative about a different thing:
 *
 *   curator staging → WHICH files should exist (post-FOMOD, post-installer).
 *                     Trustworthy about the SET even when content was mutated.
 *   archive         → what the bytes should BE. Trustworthy about CONTENT even
 *                     when the curator's copy was rewritten.
 *
 * Asking both turns an ambiguous mismatch into a specific answer: a user file
 * that disagrees with the curator but agrees with the archive is the CURATOR's
 * divergence, not the user's corruption — and must not trigger a reinstall,
 * because reinstalling is exactly what produced the file in hand.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { ArchiveListing } from "./archiveContents";
import type { StagedFileRef } from "./verifyAgainstArchive";

/**
 * What the curator recorded for one file. `crc`/`sha256` may be absent when the
 * curator built at a level that only captured sizes.
 */
export type CuratorFileRef = {
  path: string;
  size: number;
  crc?: string;
};

export type FileVerdict =
  /** User's file matches what the curator recorded. Nothing to say. */
  | { kind: "ok"; path: string }
  /**
   * Present on the user side, differs from the curator's copy, but matches an
   * entry in the archive.
   *
   * The CURATOR's file diverged from its own archive — post-install tooling.
   * The user is correct. MUST NOT trigger a reinstall: a reinstall reproduces
   * the archive bytes, which is precisely what the user already has.
   */
  | { kind: "curator-diverged"; path: string }
  /**
   * Differs from the curator AND matches nothing in the archive.
   *
   * The only verdict that justifies a reinstall. Even here it is "unexplained
   * by either reference" rather than proof of corruption — the user may run
   * their own optimiser too.
   */
  | { kind: "unexplained"; path: string }
  /**
   * The curator recorded this file and the user does not have it.
   *
   * The omission signal, and the one case where the curator's staging is the
   * RIGHT reference: it knows the post-FOMOD file set. Content mutation does
   * not affect presence, so this stays trustworthy even for optimised setups.
   */
  | { kind: "missing"; path: string }
  /** Present for the user, never recorded by the curator. Informational. */
  | { kind: "extra"; path: string };

export type VerificationClassification = {
  verdicts: FileVerdict[];
  ok: number;
  curatorDiverged: number;
  unexplained: number;
  missing: number;
  extra: number;
  /**
   * True when nothing warrants a reinstall.
   *
   * `curator-diverged` is deliberately NOT a reason: the file already matches
   * the archive, so reinstalling cannot improve it and would cost the user a
   * full re-extract per optimised mod.
   */
  reinstallWarranted: boolean;
};

function sameContent(a: { size: number; crc?: string }, b: { size: number; crc?: string }): boolean {
  if (a.size !== b.size) return false;
  // Both crcs known → they must agree. One missing → size agreement is all we
  // have, and is treated as "not contradicted" rather than as proof.
  if (a.crc !== undefined && b.crc !== undefined) return a.crc === b.crc;
  return true;
}

/**
 * Classify one mod's user-side staging against both references.
 *
 * Pure and side-effect free; the caller decides policy. `archive` may be
 * `undefined` when the archive could not be listed — in that case a file that
 * disagrees with the curator can only be reported as `unexplained`, because
 * there is no second opinion available. That is a degradation, and callers
 * should say so rather than presenting it as a confident result.
 */
export function classifyVerification(
  curatorFiles: CuratorFileRef[],
  userFiles: StagedFileRef[],
  archive: ArchiveListing | undefined,
): VerificationClassification {
  const byPath = new Map(curatorFiles.map((f) => [f.path, f]));
  const userByPath = new Map(userFiles.map((f) => [f.path, f]));

  // Content index over the archive, path-independent: a FOMOD renames on
  // install, so only the bytes are comparable.
  const archiveContent = new Set<string>();
  const archiveSizes = new Set<number>();
  for (const entry of archive?.entries ?? []) {
    if (entry.size === undefined) continue;
    archiveSizes.add(entry.size);
    if (entry.crc !== undefined) archiveContent.add(`${entry.size}:${entry.crc}`);
  }
  const archiveHas = (file: StagedFileRef): boolean => {
    if (file.crc !== undefined && archiveContent.has(`${file.size}:${file.crc}`)) return true;
    // No crc on one side — size alone is the only signal left.
    if (file.crc === undefined) return archiveSizes.has(file.size);
    return false;
  };

  const verdicts: FileVerdict[] = [];
  let ok = 0;
  let curatorDiverged = 0;
  let unexplained = 0;
  let missing = 0;
  let extra = 0;

  for (const expected of curatorFiles) {
    const actual = userByPath.get(expected.path);
    if (actual === undefined) {
      missing += 1;
      verdicts.push({ kind: "missing", path: expected.path });
      continue;
    }
    if (sameContent(expected, actual)) {
      ok += 1;
      verdicts.push({ kind: "ok", path: expected.path });
      continue;
    }
    if (archive !== undefined && archiveHas(actual)) {
      curatorDiverged += 1;
      verdicts.push({ kind: "curator-diverged", path: expected.path });
      continue;
    }
    unexplained += 1;
    verdicts.push({ kind: "unexplained", path: expected.path });
  }

  for (const actual of userFiles) {
    if (byPath.has(actual.path)) continue;
    extra += 1;
    verdicts.push({ kind: "extra", path: actual.path });
  }

  return {
    verdicts,
    ok,
    curatorDiverged,
    unexplained,
    missing,
    extra,
    reinstallWarranted: missing > 0 || unexplained > 0,
  };
}
