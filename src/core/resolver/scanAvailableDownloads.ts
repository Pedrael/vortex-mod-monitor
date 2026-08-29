/**
 * ──────────────────────────────────────────────────────────────────────
 * Hash Vortex's download folder so the resolver can see what is already here.
 *
 * ─── THE BUG THIS EXISTS FOR ───────────────────────────────────────────
 * Until this existed, every call site passed `availableDownloads: undefined`,
 * which made the resolver's `*-use-local-download` arms unreachable. An
 * install therefore always asked Nexus for a file it might already be holding.
 * When it WAS holding it, Vortex had nothing to do, never reported an install,
 * and the driver sat forever on "downloading" a download that had finished.
 *
 * ─── WHY IT LIVES IN CORE RATHER THAN BESIDE ONE CALLER ────────────────
 * It first shipped as a private helper inside the install page's engine, and
 * the OTHER install pipeline — the Vortex action registered in `index.ts` —
 * kept passing `undefined`. Both paths reach `resolveInstallPlan`, so the bug
 * was only half fixed, and the test written to prevent exactly that read one
 * of the two files while its name claimed both.
 *
 * One implementation, imported by both, is the only version of this fix that
 * cannot be half-applied.
 *
 * ─── FAILURE IS THE STATUS QUO, NEVER AN INSTALL FAILURE ───────────────
 * Returns `undefined` on any error, which is not so much a fallback as the
 * value every call site used to pass unconditionally: the resolver's behaviour
 * with it is the behaviour shipped for months. A download scan that fails must
 * cost a re-download, never an install.
 * ──────────────────────────────────────────────────────────────────────
 */

import { selectors, types } from "@nexusmods/vortex-api";

import type { AvailableDownload } from "../../types/installPlan";

/**
 * Where Vortex keeps downloads for this game.
 *
 * `downloadPathForGame` is read defensively rather than imported as a typed
 * symbol: @nexusmods/vortex-api is types-only, so a name existing in the
 * .d.ts is not evidence the running Vortex has it.
 */
export function downloadsDirFor(
  api: types.IExtensionApi,
  gameId: string,
): string | undefined {
  try {
    const dir = (
      selectors as unknown as {
        downloadPathForGame?: (state: unknown, game: string) => unknown;
      }
    ).downloadPathForGame?.(api.getState(), gameId);
    return typeof dir === "string" && dir.length > 0 ? dir : undefined;
  } catch {
    return undefined;
  }
}

/** Never throws. See the note on failure above. */
export async function scanAvailableDownloads(args: {
  api: types.IExtensionApi;
  gameId: string;
  appDataPath: string;
  signal?: AbortSignal;
  /** Called per archive, so a multi-minute first scan is not a frozen window. */
  onProgress?: (done: number, total: number, name: string) => void;
}): Promise<AvailableDownload[] | undefined> {
  try {
    const dir = downloadsDirFor(args.api, args.gameId);
    if (dir === undefined) return undefined;

    const { loadArchiveHashCache, saveArchiveHashCache } = await import(
      "../archiveHashCache"
    );
    const { collectAvailableDownloads, describeDownloadScan } = await import(
      "./collectAvailableDownloads"
    );
    const { ehLog } = await import("../logging/ehLog");

    const cache = await loadArchiveHashCache(args.appDataPath);
    const result = await collectAvailableDownloads({
      state: args.api.getState(),
      gameId: args.gameId,
      downloadsDir: dir,
      cache,
      ...(args.signal !== undefined ? { signal: args.signal } : {}),
      ...(args.onProgress !== undefined ? { onProgress: args.onProgress } : {}),
    });
    // Saved even on a partial scan: every hash computed is one the next run
    // does not repeat, and the first run is the expensive one.
    await saveArchiveHashCache(args.appDataPath, result.cache);
    ehLog("info", "downloads.scan", {
      dir,
      summary: describeDownloadScan(result),
    });
    return result.downloads;
  } catch (err) {
    const { ehLog } = await import("../logging/ehLog");
    ehLog("warn", "downloads.scan.failed", {
      why: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}
