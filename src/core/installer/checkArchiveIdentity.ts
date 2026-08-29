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
 *   - bytes DIFFER              → the archive is not what the collection was
 *     built from. That is the finding, and re-downloading will not change it
 *     either: Nexus will serve the same new bytes again.
 *
 * So it does not merely order the ladder, it usually ends it — with an answer
 * rather than another attempt.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as fsp from "fs/promises";

import { hashFileSha256 } from "../archiveHashing";
import {
  archiveFileCacheKey,
  type ArchiveHashCache,
} from "../archiveHashCache";

export type ArchiveIdentityCheck =
  /** The archive on disk is byte-identical to what the curator built from. */
  | { kind: "matches"; sha256: string }
  /**
   * Different bytes under the same identity. Usually a re-upload; possibly a
   * damaged file. Either way the collection was not built from this.
   */
  | { kind: "differs"; expected: string; actual: string }
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
    return actual.toLowerCase() === expected
      ? { kind: "matches", sha256: actual }
      : { kind: "differs", expected, actual };
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
        `${check.actual.slice(0, 16)}...). The most likely cause is that the ` +
        `mod was re-uploaded under the same file id since the collection was ` +
        `built, so the download now serves different bytes.`
      );
    case "unknown":
      return `The archive could not be compared: ${check.why}.`;
  }
}
