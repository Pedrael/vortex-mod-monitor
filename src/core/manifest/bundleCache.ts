/**
 * ──────────────────────────────────────────────────────────────────────
 * Don't 7z the same bytes twice.
 *
 * Bundling repacks a mod's staging folder into an archive on every build.
 * DynDOLOD output is commonly several gigabytes and almost never changes
 * between two builds of the same collection, so a curator publishing v1.0.8
 * after v1.0.7 pays minutes to produce a file identical to the one they
 * produced last time.
 *
 * ─── THE KEY IS THE CONTENT, NOT THE MOD ───────────────────────────────
 * The old output was `<modId>.zip`, deleted and rewritten each run — a name
 * that says which mod but nothing about which VERSION of it, so it could
 * never be trusted for reuse. The key here is `computeStagingSetHash`: the
 * same set of files with the same contents, in any order, on any machine.
 *
 * That function returns `undefined` when any staged file lacks a sha256, and
 * that is exactly the case where reuse would be a guess. No key, no cache —
 * repack, as before.
 *
 * ─── A HIT MUST NOT COST WHAT A MISS COSTS ─────────────────────────────
 * The archive's own sha256 is the mod's identity, and re-hashing a 6 GB file
 * to learn something we already knew would spend most of what caching saves.
 * So each archive gets a small sidecar recording its size and hash, and a hit
 * is a stat plus a few bytes of JSON. The size is re-checked because that is
 * what catches the one failure this design can suffer — an archive truncated
 * by a crash mid-write — and it is free.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as path from "path";

/** What a cached archive is, once it has been produced. */
export type CachedBundle = {
  /** sha256 of the archive file. The mod's identity. */
  sha256: string;
  bytes: number;
};

/** Keep a mod id usable as a filename without inventing collisions. */
export function sanitizeModId(id: string): string {
  return id.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
}

/**
 * The archive's name, carrying both the mod and the content it holds.
 *
 * The mod id is in there so a stale version can be found and dropped without
 * reading anything; the key is what makes reuse correct.
 */
export function bundleFileName(modId: string, contentKey: string): string {
  return `${sanitizeModId(modId)}-${contentKey}.zip`;
}

/** Where the sidecar for that archive lives. */
export function bundleSidecarPath(archivePath: string): string {
  return `${archivePath}.json`;
}

/**
 * Does this file belong to this mod's cache?
 *
 * Used to sweep older versions after a build. Matches on the mod segment
 * only, so a mod whose id is a prefix of another's cannot claim its files —
 * the separator has to be there.
 */
export function isBundleOfMod(fileName: string, modId: string): boolean {
  const prefix = `${sanitizeModId(modId)}-`;
  if (!fileName.startsWith(prefix)) return false;
  const rest = fileName.slice(prefix.length);
  return /^[0-9a-f]{64}\.zip(\.json)?$/.test(rest);
}

/**
 * Cached archives of this mod that are NOT the one just used.
 *
 * The policy is one archive per bundled mod: the cache is then bounded at
 * roughly what the collection itself weighs, which is a cost the curator has
 * already accepted. Sweeping happens after a successful build so a failure
 * never destroys the copy that would have made the retry fast.
 */
export function staleBundlesFor(args: {
  fileNames: readonly string[];
  modId: string;
  keep: string;
}): string[] {
  const keepArchive = path.basename(args.keep);
  const keepSidecar = `${keepArchive}.json`;
  return args.fileNames
    .filter((f) => isBundleOfMod(f, args.modId))
    .filter((f) => f !== keepArchive && f !== keepSidecar)
    .sort();
}

/**
 * Is a sidecar's claim about its archive still true?
 *
 * Only the size is checked. Re-hashing would be the thorough answer and would
 * also spend the entire saving; a size mismatch is what a crash mid-write
 * actually leaves behind, and a file of exactly the right length whose bytes
 * changed underneath is not a failure mode this cache can create — nothing
 * but this writes there.
 */
export function sidecarMatches(
  cached: CachedBundle | undefined,
  actualBytes: number,
): cached is CachedBundle {
  return (
    cached !== undefined &&
    typeof cached.sha256 === "string" &&
    /^[0-9a-f]{64}$/.test(cached.sha256) &&
    cached.bytes === actualBytes
  );
}
