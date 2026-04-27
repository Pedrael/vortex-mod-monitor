import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

import { selectors } from "vortex-api";
import type { types } from "vortex-api";

import type { AuditorMod } from "./getModsListForProfile";
import { AbortError } from "../utils/abortError";
import { pMap } from "../utils/pMap";

/**
 * Sentinel error emitted by `pMap` and `enrichModsWithArchiveHashes`
 * when an `AbortSignal` is aborted. Callers can identify a clean
 * cancellation by checking `err instanceof AbortError` (or
 * `err.name === "AbortError"`) and treat it as "user cancelled, no
 * recovery needed" rather than a real failure.
 *
 * Re-exported from `src/utils/abortError.ts` — see that file for the
 * canonical class. Kept here for backward compat with existing
 * `import { AbortError } from "../core/archiveHashing"` sites; new
 * code should import from `src/utils/abortError` directly.
 */
export { AbortError };

/**
 * Streaming SHA-256 of a file. Lower memory footprint than reading the
 * whole file into a buffer; mod archives can be hundreds of MB.
 *
 * Pass an `AbortSignal` (via the optional second arg) to abort an
 * in-flight hash. The underlying stream is destroyed and the promise
 * rejects with an `AbortError`.
 */
export function hashFileSha256(
  filePath: string,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    const onAbort = (): void => {
      stream.destroy();
      reject(new AbortError());
    };
    if (signal !== undefined) {
      signal.addEventListener("abort", onAbort, { once: true });
    }

    const cleanup = (): void => {
      if (signal !== undefined) {
        signal.removeEventListener("abort", onAbort);
      }
    };

    stream.on("error", (err) => {
      cleanup();
      reject(err);
    });
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => {
      cleanup();
      resolve(hash.digest("hex"));
    });
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

export type EnrichOptions = {
  /** Max concurrent file reads. Defaults to 4 — friendly to spinning rust. */
  concurrency?: number;
  /** Called for each mod after it has been processed (success or skip). */
  onProgress?: (done: number, total: number, mod: AuditorMod) => void;
  /**
   * Optional cancellation signal. When aborted:
   *   - new mods are no longer scheduled for hashing,
   *   - in-flight hash streams are destroyed,
   *   - the returned promise rejects with `AbortError`.
   *
   * Hashing is read-only, so abort is always safe — partial progress
   * is simply discarded.
   */
  signal?: AbortSignal;
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
  const { concurrency = 4, onProgress, signal } = options;

  let done = 0;

  return pMap(
    mods,
    concurrency,
    async (mod) => {
      if (signal?.aborted) {
        throw new AbortError();
      }
      const archivePath = getModArchivePath(state, mod.archiveId, gameId);

      let archiveSha256: string | undefined;

      if (archivePath) {
        try {
          const stat = await fs.promises.stat(archivePath);

          if (stat.isFile()) {
            archiveSha256 = await hashFileSha256(archivePath, signal);
          }
        } catch (err) {
          // Re-throw cancellation so pMap unwinds cleanly. Otherwise
          // swallow — file missing or unreadable is non-fatal: drift
          // is more useful than a hard stop.
          if (err instanceof AbortError) {
            throw err;
          }
          if ((err as Error | undefined)?.name === "AbortError") {
            throw err;
          }
        }
      }

      done += 1;
      onProgress?.(done, mods.length, mod);

      return archiveSha256 !== undefined ? { ...mod, archiveSha256 } : mod;
    },
    signal,
  );
}
