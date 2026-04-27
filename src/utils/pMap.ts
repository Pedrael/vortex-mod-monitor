import { AbortError } from "./abortError";

/**
 * Bounded-concurrency map. Lighter than pulling in p-limit for one
 * function. Workers loop over a shared cursor; cancellation makes
 * idle workers exit and aborts the returned promise with
 * `AbortError`.
 *
 * Used by:
 *  - `core/archiveHashing.ts` to hash mod source archives (4-wide).
 *  - `core/manifest/captureStagingFiles.ts` to walk + optionally
 *    hash files inside curator staging folders (4-wide).
 *
 * Design notes:
 *  - Already-completed work is discarded on abort. We don't surface a
 *    partial results array because every caller's `onProgress` hook
 *    has already had a chance to record per-item state.
 *  - Concurrency is clamped to `[1, items.length]`. An empty input
 *    skips worker creation entirely and resolves to `[]` immediately.
 */
export async function pMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  if (signal?.aborted) {
    throw new AbortError();
  }

  if (items.length === 0) {
    return results;
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const workers: Promise<void>[] = [];

  for (let w = 0; w < workerCount; w++) {
    workers.push(
      (async () => {
        while (cursor < items.length) {
          if (signal?.aborted) return;
          const idx = cursor++;
          results[idx] = await fn(items[idx], idx);
        }
      })(),
    );
  }

  await Promise.all(workers);
  if (signal?.aborted) {
    throw new AbortError();
  }
  return results;
}
