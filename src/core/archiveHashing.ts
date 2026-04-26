import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

import { selectors } from "vortex-api";
import type { types } from "vortex-api";

import type { AuditorMod } from "./getModsListForProfile";

/**
 * Streaming SHA-256 of a file. Lower memory footprint than reading the
 * whole file into a buffer; mod archives can be hundreds of MB.
 */
export function hashFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

/**
 * Resolve a mod's source archive on disk via Vortex's download cache.
 *
 * Vortex stores downloads at `selectors.downloadPathForGame(state, gameId)`
 * with `IDownload.localPath` as the relative filename. Archives are keyed
 * by `archiveId`, which we already capture on `AuditorMod`.
 */
export function getModArchivePath(
  state: types.IState,
  archiveId: string | undefined,
  gameId: string,
): string | undefined {
  if (!archiveId) {
    return undefined;
  }

  const downloads =
    ((state as any)?.persistent?.downloads?.files ?? {}) as Record<
      string,
      { localPath?: string; game?: string[] } | undefined
    >;

  const download = downloads[archiveId];
  if (!download?.localPath) {
    return undefined;
  }

  // downloadPathForGame returns an absolute per-game directory.
  const baseDir = selectors.downloadPathForGame(state, gameId);
  if (!baseDir) {
    return undefined;
  }

  return path.join(baseDir, download.localPath);
}

/**
 * Bounded-concurrency map. We don't pull in p-limit just for this.
 */
async function pMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const workers: Promise<void>[] = [];

  for (let w = 0; w < workerCount; w++) {
    workers.push(
      (async () => {
        while (cursor < items.length) {
          const idx = cursor++;
          results[idx] = await fn(items[idx], idx);
        }
      })(),
    );
  }

  await Promise.all(workers);
  return results;
}

export type EnrichOptions = {
  /** Max concurrent file reads. Defaults to 4 — friendly to spinning rust. */
  concurrency?: number;
  /** Called for each mod after it has been processed (success or skip). */
  onProgress?: (done: number, total: number, mod: AuditorMod) => void;
};

/**
 * Compute SHA-256 for each mod's source archive (where one exists) and
 * return a new array of `AuditorMod` with `archiveSha256` populated.
 *
 * Mods without a resolvable archive (no `archiveId`, missing download
 * record, or file not present on disk) pass through unchanged. We do
 * not throw on individual failures — drift is more useful than a hard
 * stop when one file is missing.
 */
export async function enrichModsWithArchiveHashes(
  state: types.IState,
  gameId: string,
  mods: AuditorMod[],
  options: EnrichOptions = {},
): Promise<AuditorMod[]> {
  const { concurrency = 4, onProgress } = options;

  let done = 0;

  return pMap(mods, concurrency, async (mod) => {
    const archivePath = getModArchivePath(state, mod.archiveId, gameId);

    let archiveSha256: string | undefined;

    if (archivePath) {
      try {
        const stat = await fs.promises.stat(archivePath);

        if (stat.isFile()) {
          archiveSha256 = await hashFileSha256(archivePath);
        }
      } catch {
        // File missing or unreadable — leave hash undefined and continue.
      }
    }

    done += 1;
    onProgress?.(done, mods.length, mod);

    return archiveSha256 !== undefined ? { ...mod, archiveSha256 } : mod;
  });
}
