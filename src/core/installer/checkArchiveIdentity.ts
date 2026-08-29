/**
 * ──────────────────────────────────────────────────────────────────────
 * Are these the bytes the curator built from?
 *
 * Every Nexus mod in a manifest carries a MANDATORY `source.sha256` — the
 * hash of what Nexus served the curator. Its docblock states that the
 * installer "downloads via Nexus IDs, then verifies against this hash.
 * Mismatch ⇒ HARD FAIL (Nexus served different bytes)."
 *
 * That was a description of an intention. The only place the installer read
 * `source.sha256` was to locate a bundled archive inside the package; a
 * downloaded archive was never checked against it at all.
 *
 * The gap matters because the thing it guards against genuinely happens: a
 * mod author can re-upload under the same file id, and Nexus will serve the
 * new bytes to a download request that names the old one. The collection then
 * installs a mod the curator never tested, and every downstream symptom —
 * files that do not match, a verification that fails, a mod that behaves
 * differently — points anywhere except at the actual cause.
 *
 * ─── WHY THIS IS THE RUNG BEFORE RE-DOWNLOADING ────────────────────────
 * The obvious next step after a failed reinstall is "download it again". This
 * answers the same question for the cost of one hash instead of one download:
 *
 *   - bytes MATCH the manifest  → the archive is the curator's. Downloading it
 *     again fetches the same bytes, so it cannot help; the fault is
 *     downstream, in extraction or in what happened after.
 *   - bytes DIFFER, archive READABLE → the archive is a different, intact
 *     file. Re-downloading will not change that: Nexus serves the same new
 *     bytes again. The likely cause is a re-upload under the same file id.
 *   - bytes DIFFER, archive UNREADABLE → the file on disk is damaged, and
 *     re-downloading is the ONE thing that fixes it.
 *
 * ─── WHY THAT LAST CASE IS SPLIT OUT ───────────────────────────────────
 * A hash mismatch alone cannot tell a re-upload from a half-finished
 * download, and the first version of this file collapsed both into "probably
 * re-uploaded". That is the failure this project treats as worse than saying
 * nothing: naming one cause out of two it cannot distinguish, in a diagnostic,
 * where it reads as evidence. It sent the user to ask the curator about a
 * re-upload when their own download had been truncated, and it sent the
 * curator hunting a mod they never changed.
 *
 * A truncated archive is not a hypothetical here — `collectAvailableDownloads`
 * already skips incomplete downloads by comparing bytes on disk against the
 * recorded size, which exists because partial files genuinely occur.
 *
 * Parsing the header separates them for the cost of a header read: a truncated
 * or corrupt archive has no readable central directory, an intact one does.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as fsp from "fs/promises";

import { hashFileSha256 } from "../archiveHashing";
import {
  archiveFileCacheKey,
  type ArchiveHashCache,
} from "../archiveHashCache";
import { listArchiveNativeFirst } from "../manifest/listArchive";
import type { SevenZipApi } from "../manifest/sevenZip";

export type ArchiveIdentityCheck =
  /** The archive on disk is byte-identical to what the curator built from. */
  | { kind: "matches"; sha256: string }
  /**
   * Different bytes under the same identity, in a file that still parses as
   * an archive. The collection was not built from this, and downloading it
   * again would fetch the same thing.
   */
  | { kind: "differs"; expected: string; actual: string }
  /**
   * Different bytes AND no reader can open it — a truncated or corrupted
   * download. This is the one case where downloading again actually helps,
   * and it is the user's problem rather than the curator's.
   */
  | { kind: "damaged"; expected: string; actual: string; why: string }
  /** No archive, or no recorded hash. States why rather than implying either. */
  | { kind: "unknown"; why: string };

/**
 * Never throws. This runs while explaining another failure, and an
 * explanation that fails leaves the user with strictly less than they had.
 */
export async function checkArchiveIdentity(args: {
  archivePath: string | undefined;
  /** `source.sha256` from the manifest. Mandatory for Nexus, optional for external. */
  expectedSha256: string | undefined;
  /** Reused so a mod already hashed by the download scan is not read twice. */
  cache?: ArchiveHashCache;
  /** Injection point for tests; defaults to Vortex's own SevenZip. */
  sevenZip?: SevenZipApi;
  signal?: AbortSignal;
}): Promise<ArchiveIdentityCheck> {
  if (args.expectedSha256 === undefined || args.expectedSha256.length === 0) {
    return {
      kind: "unknown",
      why: "the collection did not record a hash for this mod's archive",
    };
  }
  if (args.archivePath === undefined) {
    return {
      kind: "unknown",
      why: "the archive is no longer on disk to compare",
    };
  }

  try {
    const stat = await fsp.stat(args.archivePath);
    if (!stat.isFile()) {
      return { kind: "unknown", why: "the archive path is not a file" };
    }

    // The download scan hashes everything in the download folder and caches it
    // on a path|size|mtime fingerprint. On a resumed install this archive was
    // very likely hashed minutes ago; re-reading a 2 GB file to learn the same
    // number is the kind of heavy work that buys nothing.
    const key = archiveFileCacheKey(args.archivePath, stat.size, stat.mtimeMs);
    const cached = args.cache?.entries[key];
    const actual =
      cached?.sha256 ?? (await hashFileSha256(args.archivePath, args.signal));

    const expected = args.expectedSha256.toLowerCase();
    if (actual.toLowerCase() === expected) {
      return { kind: "matches", sha256: actual };
    }

    // Different bytes. Now the question that decides who should act: is this a
    // DIFFERENT archive, or a BROKEN one? Only the second is fixed by
    // downloading again, and only the first is worth the curator's time.
    // Header read, and only on a path we already know has failed twice.
    const attempt = await listArchiveNativeFirst({
      archivePath: args.archivePath,
      ...(args.sevenZip !== undefined ? { sevenZip: args.sevenZip } : {}),
      ...(args.signal !== undefined ? { signal: args.signal } : {}),
    });
    if (attempt.kind === "unreadable") {
      return { kind: "damaged", expected, actual, why: attempt.why };
    }
    return { kind: "differs", expected, actual };
  } catch (err) {
    return {
      kind: "unknown",
      why: `the archive could not be read: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

/**
 * One line for the curator's report.
 *
 * The `differs` wording is the load-bearing one: it names a re-upload as the
 * likely cause, because that is the explanation a curator can actually check
 * and the one they will otherwise never think of.
 */
export function describeArchiveIdentity(check: ArchiveIdentityCheck): string {
  switch (check.kind) {
    case "matches":
      return (
        `The archive on this machine is byte-identical to the one the ` +
        `collection was built from, so downloading it again would change ` +
        `nothing — whatever went wrong happened after the download.`
      );
    case "differs":
      return (
        `The archive on this machine is NOT the one the collection was built ` +
        `from (expected ${check.expected.slice(0, 16)}..., got ` +
        `${check.actual.slice(0, 16)}...), but it is an intact archive. The ` +
        `most likely cause is that the mod was re-uploaded under the same ` +
        `file id since the collection was built, so the download now serves ` +
        `different bytes.`
      );
    case "damaged":
      return (
        `The archive on this machine is damaged — no reader can open it ` +
        `(${check.why}), and its bytes do not match what the collection was ` +
        `built from. This is a corrupted or incomplete download rather than ` +
        `anything wrong with the collection.`
      );
    case "unknown":
      return `The archive could not be compared: ${check.why}.`;
  }
}
