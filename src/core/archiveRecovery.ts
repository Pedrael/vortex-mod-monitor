/**
 * ──────────────────────────────────────────────────────────────────────
 * Getting a missing source archive back — WITHOUT reinstalling the mod.
 *
 * A mod is identified in the manifest by the SHA-256 of its source archive.
 * Vortex's download cache is not permanent: on the curator's profile 226 of
 * 956 enabled mods had no archive left, so the build could not identify them
 * and refused to pack. The mods themselves are fine — installed, staged,
 * exactly as the curator wants them. Only the bytes they came from are gone.
 *
 * ## Why this cannot go through a normal Vortex install
 *
 * Vortex's flow is download-and-install, and installing is precisely what must
 * not happen here. The mod is already installed, with FOMOD choices the
 * curator made once and may not remember; reinstalling would re-run the
 * installer, and a batch of reinstalls is the exact condition under which
 * Vortex is observed to drop files. Re-acquiring an archive must not be able
 * to damage the thing it is trying to describe.
 *
 * `api.ext.nexusDownload` takes an `allowInstall` flag, and passing `false`
 * fetches the archive into the download cache and stops there. Staging is
 * never touched.
 *
 * ## The mod's own archiveId is left alone
 *
 * A recovered download is a NEW download record with a NEW id; the mod still
 * points at the dead one. That does not matter and is deliberately not
 * "fixed": mutating Vortex's mod records to re-link them is a write we have no
 * business making. All that is needed is the hash, and the hash comes from the
 * file we just fetched.
 *
 * ## Sequential, always
 *
 * One download at a time. Partly so progress and cancellation mean something,
 * mostly because concurrency around Vortex's mod pipeline is what causes the
 * bug this whole project exists to catch.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as fs from "fs";
import * as path from "path";

import { selectors, types } from "@nexusmods/vortex-api";

import {
  AbortError,
  hashFileSha256,
  resolveModArchivePath,
} from "./archiveHashing";
import type { AuditorMod } from "./getModsListForProfile";
import { ehLog, beginOp } from "./logging/ehLog";

/** A mod the build cannot identify, and the Nexus file that would fix it. */
export type RecoverableMod = {
  mod: AuditorMod;
  nexusModId: number;
  nexusFileId: number;
};

export type RecoveryOutcome =
  /**
   * Downloaded and hashed; `archiveSha256` is now known.
   *
   * The Nexus ids are echoed back so the caller can persist the hash against a
   * stable identity — the whole point of paying for a download once.
   */
  | {
      kind: "recovered";
      mod: AuditorMod;
      archiveSha256: string;
      downloadId: string;
      nexusModId: number;
      nexusFileId: number;
      size?: number;
    }
  /** Nexus refused, the download failed, or the file never landed. */
  | { kind: "failed"; mod: AuditorMod; reason: string };

export type RecoveryReport = {
  recovered: RecoveryOutcome[];
  /** Mods still without identity, with the reason each one failed. */
  failed: RecoveryOutcome[];
  /**
   * Mods that cannot even be attempted: no Nexus ids, so there is nothing to
   * ask Nexus for. External mods and mods installed from a vanished source.
   */
  unattemptable: AuditorMod[];
  /** True when the run stopped early. `recovered` is still valid and kept. */
  aborted: boolean;
};

export type RecoveryOptions = {
  onProgress?: (done: number, total: number, mod: AuditorMod) => void;
  /**
   * Called after EACH archive is fetched and hashed, before the next download
   * starts, so the result can be persisted incrementally.
   *
   * This is not a nicety. A recovery run is hundreds of downloads over hours,
   * and if the hashes only landed at the end then a cancel — or a crash — would
   * discard all of it. Worse than discarding the hashes: the mod still points
   * at its dead download record, so nothing would find the archives that were
   * just fetched and the whole run would repeat.
   *
   * Awaited, so a slow write cannot interleave with the next download.
   */
  onRecovered?: (outcome: RecoveryOutcome) => void | Promise<void>;
  signal?: AbortSignal;
  /**
   * How long to wait for a download to reach `finished` after `nexusDownload`
   * resolves. Defaults to 5 minutes — large archives on slow links exist, and
   * giving up early would leave a half-file that hashes to nothing useful.
   */
  settleTimeoutMs?: number;
  /** Injected for tests. Defaults to polling Vortex's state. */
  now?: () => number;
};

/**
 * Mods whose archive Vortex cannot even point at, known BEFORE hashing.
 *
 * `resolveModArchivePath` reads state only — the mod's `archiveId`, then the
 * download record it names, then any download a previous recovery put the
 * archive in — so this costs nothing and can run the instant a build starts.
 * That matters: the alternative is discovering the same thing 15 minutes into a
 * hashing pass, or 45 minutes in when the manifest refuses.
 *
 * The recovered half of that lookup only answers if the caller restored those
 * links first (`applyCachedDownloadIds`). Without it a curator who has just
 * re-fetched every missing archive is told, one second into the next build,
 * that they are all still missing.
 *
 * It is a LOWER BOUND on the problem. A path that resolves can still point at
 * a file that has since been deleted, and only `stat` reveals that — those
 * surface during hashing as usual. Everything reported here is definitely
 * missing; not everything missing is reported here.
 */
export function findModsWithNoArchivePath(
  state: types.IState,
  gameId: string,
  mods: AuditorMod[],
): AuditorMod[] {
  return mods.filter(
    (mod) => resolveModArchivePath(state, mod, gameId) === undefined,
  );
}

/**
 * Which mods a recovery run would target.
 *
 * Keys off `archiveSha256`, so this is meaningful only AFTER the hashing pass —
 * before it, no mod has a hash and everything would look broken. For the
 * pre-hash warning use {@link findModsWithNoArchivePath}.
 */
export function findRecoverableMods(
  mods: AuditorMod[],
  opts?: {
    /**
     * Mods the curator has chosen to ship as external.
     *
     * They do not need an archive at all — they are identified by the
     * SHA-256 of their deployed files — so offering to re-download one is
     * offering to fix something that is not broken. Worse, the usual reason to
     * mark a mod external is that its Nexus page is GONE, so the download is
     * guaranteed to fail and leave a warning about it.
     *
     * That is the bug this closes: a curator marked a dead mod as external,
     * and was still told "1 archive could not be re-downloaded: Nexus returned
     * no download id" on every build.
     *
     * Optional so the pure "which mods lack a hash" question still has a
     * caller-free answer, but every UI caller passes it.
     */
    shipsAsExternal?: (mod: AuditorMod) => boolean;
  },
): {
  recoverable: RecoverableMod[];
  unattemptable: AuditorMod[];
} {
  const recoverable: RecoverableMod[] = [];
  const unattemptable: AuditorMod[] = [];

  for (const mod of mods) {
    if (mod.archiveSha256 !== undefined) continue;
    if (opts?.shipsAsExternal?.(mod) === true) continue;
    const modId = Number(mod.nexusModId);
    const fileId = Number(mod.nexusFileId);
    if (Number.isInteger(modId) && modId > 0 && Number.isInteger(fileId) && fileId > 0) {
      recoverable.push({ mod, nexusModId: modId, nexusFileId: fileId });
    } else {
      unattemptable.push(mod);
    }
  }
  return { recoverable, unattemptable };
}

function readDownload(
  api: types.IExtensionApi,
  downloadId: string,
): types.IDownload | undefined {
  const files = (api.getState() as unknown as {
    persistent?: { downloads?: { files?: Record<string, types.IDownload> } };
  })?.persistent?.downloads?.files;
  return files?.[downloadId];
}

/**
 * Wait until a download is actually on disk.
 *
 * `nexusDownload` resolving is not the same as the file being complete —
 * Vortex finalizes (hashes) after the transfer, and `localPath` is what tells
 * us where it landed. Hashing a `finalizing` file would read a moving target.
 */
async function waitForDownload(
  api: types.IExtensionApi,
  downloadId: string,
  opts: RecoveryOptions,
): Promise<types.IDownload> {
  const now = opts.now ?? Date.now;
  const deadline = now() + (opts.settleTimeoutMs ?? 5 * 60_000);

  for (;;) {
    if (opts.signal?.aborted === true) throw new AbortError();
    const dl = readDownload(api, downloadId);
    if (dl !== undefined) {
      if (dl.state === "finished" && dl.localPath !== undefined) return dl;
      if (dl.state === "failed") {
        const detail = dl.failCause as { message?: string } | undefined;
        throw new Error(
          `Nexus download failed${detail?.message !== undefined ? `: ${detail.message}` : "."}`,
        );
      }
    }
    if (now() >= deadline) {
      throw new Error(
        `Download did not finish within the timeout (state: ${dl?.state ?? "unknown"}).`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * Re-acquire the source archives for mods that lost them, and hash each one.
 *
 * Never installs, never writes to Vortex's mod records, and never runs two
 * downloads at once. Individual failures are collected rather than thrown — a
 * mod deleted from Nexus must not stop the other 200 being recovered.
 */
export async function recoverMissingArchives(
  api: types.IExtensionApi,
  gameId: string,
  targets: RecoverableMod[],
  options: RecoveryOptions = {},
): Promise<RecoveryReport> {
  const op = beginOp("archive-recovery.run", {
    targets: targets.length,
    gameId,
  });
  const recovered: RecoveryOutcome[] = [];
  const failed: RecoveryOutcome[] = [];

  const nexusDownload = api.ext?.nexusDownload;
  if (nexusDownload === undefined) {
    const err = new Error("Vortex's Nexus integration is not available.");
    op.fail(err, { targets: targets.length });
    return {
      recovered: [],
      failed: targets.map(({ mod }) => ({
        kind: "failed" as const,
        mod,
        reason:
          "Vortex's Nexus integration is not available. Is the Nexus extension " +
          "enabled and are you logged in?",
      })),
      unattemptable: [],
      aborted: false,
    };
  }

  let done = 0;
  for (const target of targets) {
    // Cancelling RETURNS what has been recovered so far rather than throwing it
    // away. "Stop after this one" has to mean the work is kept, or it is a
    // button that silently destroys hours of downloading.
    if (options.signal?.aborted === true) {
      ehLog("info", "archive-recovery.aborted", {
        recovered: recovered.length,
        failed: failed.length,
        remaining: targets.length - done,
      });
      op.ok({ recovered: recovered.length, failed: failed.length, aborted: true });
      return { recovered, failed, unattemptable: [], aborted: true };
    }
    done += 1;
    options.onProgress?.(done, targets.length, target.mod);

    try {
      // `false` is the whole point: fetch the archive, do NOT install it.
      const downloadId = await nexusDownload(
        gameId,
        target.nexusModId,
        target.nexusFileId,
        undefined,
        false,
      );
      if (typeof downloadId !== "string" || downloadId.length === 0) {
        throw new Error("Nexus returned no download id.");
      }

      const dl = await waitForDownload(api, downloadId, options);
      const baseDir = selectors.downloadPathForGame(api.getState(), gameId);
      if (!baseDir) {
        throw new Error(`Could not resolve the download folder for "${gameId}".`);
      }
      const archivePath = path.join(baseDir, dl.localPath!);
      const stat = await fs.promises.stat(archivePath);
      if (!stat.isFile()) {
        throw new Error(`Downloaded path is not a file: ${archivePath}`);
      }

      const archiveSha256 = await hashFileSha256(archivePath, options.signal);
      const outcome: RecoveryOutcome = {
        kind: "recovered",
        mod: target.mod,
        archiveSha256,
        downloadId,
        nexusModId: target.nexusModId,
        nexusFileId: target.nexusFileId,
        size: stat.size,
      };
      recovered.push(outcome);
      op.step("recovered", {
        mod: target.mod.name,
        nexusModId: target.nexusModId,
        nexusFileId: target.nexusFileId,
        size: stat.size,
      });
      // Persist before the next download begins.
      await options.onRecovered?.(outcome);
    } catch (err) {
      if (err instanceof AbortError) {
        ehLog("info", "archive-recovery.aborted", {
          recovered: recovered.length,
          failed: failed.length,
        });
        op.ok({ recovered: recovered.length, failed: failed.length, aborted: true });
        return { recovered, failed, unattemptable: [], aborted: true };
      }
      failed.push({
        kind: "failed",
        mod: target.mod,
        reason: err instanceof Error ? err.message : String(err),
      });
      ehLog("warn", "archive-recovery.item-failed", {
        mod: target.mod.name,
        nexusModId: target.nexusModId,
        nexusFileId: target.nexusFileId,
        err,
      });
    }
  }

  op.ok({ recovered: recovered.length, failed: failed.length, aborted: false });
  return { recovered, failed, unattemptable: [], aborted: false };
}

/** Fold a report back into the mod list, so the build can proceed. */
export function applyRecovery(
  mods: AuditorMod[],
  report: RecoveryReport,
): AuditorMod[] {
  // Both facts, together. The hash makes the mod identifiable; the download id
  // is the only thing that can still find its bytes, because the mod's own
  // record is the one that died.
  const found = new Map<string, { sha256: string; downloadId: string }>();
  for (const outcome of report.recovered) {
    if (outcome.kind === "recovered") {
      found.set(outcome.mod.id, {
        sha256: outcome.archiveSha256,
        downloadId: outcome.downloadId,
      });
    }
  }
  if (found.size === 0) return mods;
  return mods.map((mod) => {
    const hit = found.get(mod.id);
    return hit !== undefined
      ? {
          ...mod,
          archiveSha256: hit.sha256,
          recoveredDownloadId: hit.downloadId,
        }
      : mod;
  });
}
