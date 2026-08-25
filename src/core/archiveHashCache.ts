/**
 * ──────────────────────────────────────────────────────────────────────
 * Remembering the hash of an archive we had to re-download.
 *
 * Recovering 226 archives is gigabytes and a long wait. Without somewhere to
 * put the result it is gigabytes and a long wait EVERY build, because nothing
 * in Vortex changes: the mod still points at a dead download record, and
 * Event Horizon deliberately does not rewrite Vortex's mod records to fix that
 * — re-linking another application's state is not ours to do.
 *
 * So the hash is kept here instead, and the cost is paid once.
 *
 * ## Why a Nexus file id is a safe key
 *
 * A Nexus `fileId` names one immutable uploaded file. Its bytes do not change,
 * so neither does its sha256. That is not a convenience assumption bolted on
 * here — it is the same assumption the manifest itself rests on, since a mod is
 * identified by `(modId, fileId, sha256)`. If a fileId could serve different
 * bytes over time, every collection ever built would already be unsound.
 *
 * External mods are deliberately NOT cached: they have no stable identity to
 * key on, and a filename is not one.
 *
 * ## The cache fills gaps; it never overrides bytes
 *
 * If the archive is on disk, it gets hashed. A cached value is consulted only
 * where there is no archive to read, which keeps a stale or poisoned entry from
 * ever contradicting the real file. Entries are only written from downloads
 * Vortex reported as `finished` — meaning it verified them — so a truncated
 * transfer cannot be remembered as fact.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as fsp from "fs/promises";
import * as path from "path";

import type { AuditorMod } from "./getModsListForProfile";

export const ARCHIVE_HASH_CACHE_FILE = "archive-hashes.json";

export type CachedArchiveHash = {
  sha256: string;
  /** Bytes, when known. Diagnostic only — never used for matching. */
  size?: number;
  /** ISO timestamp, so a suspect entry can be aged out by hand. */
  recoveredAt: string;
};

export type ArchiveHashCache = {
  schemaVersion: 1;
  entries: Record<string, CachedArchiveHash>;
};

export const emptyArchiveHashCache = (): ArchiveHashCache => ({
  schemaVersion: 1,
  entries: {},
});

/**
 * `file:<path>|<size>|<mtimeMs>` — a fingerprint of the file ON DISK.
 *
 * The other key answers "what was this Nexus file's hash?" for archives that
 * are gone. This one answers a different question: "have I already hashed
 * exactly these bytes?" — so a build does not re-read 730 archives, ~15 minutes
 * and tens of gigabytes, every single time the Build page is opened.
 *
 * Size AND modification time both have to match. Changing a file's contents
 * without changing either is not something that happens by accident: any write
 * updates mtime, and the pair is the standard fingerprint build tools use for
 * exactly this. A file replaced with different bytes of identical size at an
 * identical millisecond would be missed — that is a deliberate act, not a
 * failure mode, and the archive-level sha256 is what would catch it anyway.
 */
export function archiveFileCacheKey(
  absolutePath: string,
  size: number,
  mtimeMs: number,
): string {
  return `file:${absolutePath}|${size}|${Math.floor(mtimeMs)}`;
}

/**
 * A read-through cache of file hashes, as `enrichModsWithArchiveHashes` sees
 * it. Deliberately tiny: the hashing pass should not know about disk layout,
 * JSON, or when a save happens.
 */
export type ArchiveHashLookup = {
  get(key: string): string | undefined;
  set(key: string, sha256: string): void;
};

/** Wrap a loaded cache as a lookup, recording whatever gets added. */
export function makeHashLookup(cache: ArchiveHashCache): {
  lookup: ArchiveHashLookup;
  /** Entries added this run; empty means nothing needs saving. */
  added: Map<string, string>;
  hits: number;
} {
  const added = new Map<string, string>();
  let hits = 0;
  return {
    added,
    get hits() {
      return hits;
    },
    lookup: {
      get(key) {
        const hit = cache.entries[key]?.sha256;
        if (hit !== undefined) hits += 1;
        return hit;
      },
      set(key, sha256) {
        if (isHex64(sha256)) added.set(key, sha256);
      },
    },
  };
}

/** Merge freshly-computed hashes into a cache. Input is not mutated. */
export function mergeHashes(
  cache: ArchiveHashCache,
  added: ReadonlyMap<string, string>,
  at: string,
): ArchiveHashCache {
  if (added.size === 0) return cache;
  const entries = { ...cache.entries };
  for (const [key, sha256] of added) {
    entries[key] = { sha256, recoveredAt: at };
  }
  return { schemaVersion: 1, entries };
}

/** `nexus:<modId>:<fileId>` — the same identity the manifest uses. */
export function archiveHashCacheKey(
  nexusModId: string | number,
  nexusFileId: string | number,
): string {
  return `nexus:${String(nexusModId)}:${String(nexusFileId)}`;
}

function cacheKeyForMod(mod: AuditorMod): string | undefined {
  return mod.nexusModId !== undefined && mod.nexusFileId !== undefined
    ? archiveHashCacheKey(mod.nexusModId, mod.nexusFileId)
    : undefined;
}

const isHex64 = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{64}$/.test(value);

/**
 * Read the cache, tolerating every way the file can be wrong.
 *
 * A cache is an optimisation, so a missing, truncated or hand-edited file must
 * degrade to "no cached hashes" rather than failing a build. Entries that are
 * not a plausible sha256 are dropped individually — one bad line should not
 * discard the other two hundred.
 */
export async function loadArchiveHashCache(
  dataDir: string,
): Promise<ArchiveHashCache> {
  let raw: string;
  try {
    raw = await fsp.readFile(path.join(dataDir, ARCHIVE_HASH_CACHE_FILE), "utf8");
  } catch {
    return emptyArchiveHashCache();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyArchiveHashCache();
  }

  const entries = (parsed as ArchiveHashCache | undefined)?.entries;
  if (entries === null || typeof entries !== "object") {
    return emptyArchiveHashCache();
  }

  const clean: Record<string, CachedArchiveHash> = {};
  for (const [key, value] of Object.entries(entries as Record<string, unknown>)) {
    const entry = value as Partial<CachedArchiveHash> | undefined;
    if (!isHex64(entry?.sha256)) continue;
    clean[key] = {
      sha256: entry!.sha256!,
      ...(typeof entry!.size === "number" ? { size: entry!.size } : {}),
      recoveredAt:
        typeof entry!.recoveredAt === "string" ? entry!.recoveredAt : "unknown",
    };
  }
  return { schemaVersion: 1, entries: clean };
}

export async function saveArchiveHashCache(
  dataDir: string,
  cache: ArchiveHashCache,
): Promise<void> {
  await fsp.mkdir(dataDir, { recursive: true });
  const target = path.join(dataDir, ARCHIVE_HASH_CACHE_FILE);
  const tmp = `${target}.tmp`;
  // Write-then-rename: a build interrupted mid-save must not leave a truncated
  // cache that the next run silently reads as "no hashes".
  await fsp.writeFile(tmp, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  await fsp.rename(tmp, target);
}

/** Record a hash. Returns a new cache; the input is not mutated. */
export function rememberArchiveHash(
  cache: ArchiveHashCache,
  args: {
    nexusModId: string | number;
    nexusFileId: string | number;
    sha256: string;
    size?: number;
    at: string;
  },
): ArchiveHashCache {
  if (!isHex64(args.sha256)) return cache;
  return {
    schemaVersion: 1,
    entries: {
      ...cache.entries,
      [archiveHashCacheKey(args.nexusModId, args.nexusFileId)]: {
        sha256: args.sha256,
        ...(args.size !== undefined ? { size: args.size } : {}),
        recoveredAt: args.at,
      },
    },
  };
}

/**
 * Fill in hashes for mods whose archive is gone, and ONLY those.
 *
 * A mod that already has an `archiveSha256` was hashed from bytes on disk this
 * run; that always wins. The cache cannot overrule a real file.
 */
export function applyCachedHashes(
  mods: AuditorMod[],
  cache: ArchiveHashCache,
): { mods: AuditorMod[]; filled: number } {
  let filled = 0;
  const out = mods.map((mod) => {
    if (mod.archiveSha256 !== undefined) return mod;
    const key = cacheKeyForMod(mod);
    if (key === undefined) return mod;
    const hit = cache.entries[key];
    if (hit === undefined) return mod;
    filled += 1;
    return { ...mod, archiveSha256: hit.sha256 };
  });
  return filled === 0 ? { mods, filled: 0 } : { mods: out, filled };
}
