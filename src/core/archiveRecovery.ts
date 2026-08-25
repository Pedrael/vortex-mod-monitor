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

import { AbortError, hashFileSha256 } from "./archiveHashing";
import type { AuditorMod } from "./getModsListForProfile";

/** A mod the build cannot identify, and the Nexus file that would fix it. */
export type RecoverableMod = {
  mod: AuditorMod;
  nexusModId: number;
  nexusFileId: number;
};

export type RecoveryOutcome =
  /** Downloaded and hashed; `archiveSha256` is now known. */
  | { kind: "recovered"; mod: AuditorMod; archiveSha256: string; downloadId: string }
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
};

export type RecoveryOptions = {
  onProgress?: (done: number, total: number, mod: AuditorMod) => void;
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
 * Which mods a recovery run would target.
 *
 * Cheap and pure — it reads Vortex state and nothing else, so it can be called
 * before the expensive hashing pass to warn that a build is going to fail.
 */
export function findRecoverableMods(mods: AuditorMod[]): {
  recoverable: RecoverableMod[];
  unattemptable: AuditorMod[];
} {
  const recoverable: RecoverableMod[] = [];
  const unattemptable: AuditorMod[] = [];

  for (const mod of mods) {
    if (mod.archiveSha256 !== undefined) continue;
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
  const recovered: RecoveryOutcome[] = [];
  const failed: RecoveryOutcome[] = [];

  const nexusDownload = api.ext?.nexusDownload;
  if (nexusDownload === undefined) {
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
    };
  }

  let done = 0;
  for (const target of targets) {
    if (options.signal?.aborted === true) throw new AbortError();
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
      recovered.push({ kind: "recovered", mod: target.mod, archiveSha256, downloadId });
    } catch (err) {
      if (err instanceof AbortError) throw err;
      failed.push({
        kind: "failed",
        mod: target.mod,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { recovered, failed, unattemptable: [] };
}

/** Fold a report back into the mod list, so the build can proceed. */
export function applyRecovery(
  mods: AuditorMod[],
  report: RecoveryReport,
): AuditorMod[] {
  const hashes = new Map<string, string>();
  for (const outcome of report.recovered) {
    if (outcome.kind === "recovered") {
      hashes.set(outcome.mod.id, outcome.archiveSha256);
    }
  }
  if (hashes.size === 0) return mods;
  return mods.map((mod) => {
    const sha = hashes.get(mod.id);
    return sha !== undefined ? { ...mod, archiveSha256: sha } : mod;
  });
}
