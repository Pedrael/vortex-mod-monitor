/**
 * Mod-install primitives — Phase 3 slice 6.
 *
 * Three install entry points, one per `ModResolution.decision.kind`
 * family that slice 6a supports:
 *
 *  1. {@link installNexusViaApi}            — `nexus-download`
 *  2. {@link installFromExistingDownload}   — `*-use-local-download`
 *  3. {@link installFromBundledArchive}     — `external-use-bundled`
 *
 * "Already installed" arms (`nexus-already-installed`,
 * `external-already-installed`) need no install primitive — the driver
 * just re-uses the existing Vortex mod id and enables it in the new
 * profile.
 *
 * Spec: docs/business/INSTALL_DRIVER.md (§ Mod install primitives)
 *
 * ─── EVENT WIRING ──────────────────────────────────────────────────────
 * Vortex's documented events (see vortex-api/docs/EVENTS.md):
 *
 *  • `start-install`           (archivePath, cb(err, modId))
 *      Install from an absolute archive path. Vortex copies the archive
 *      into the downloads folder, registers it, runs the installer
 *      pipeline, and dispatches the mod into the global pool.
 *
 *  • `start-install-download`  (downloadId, cb?)
 *      Install from an archive Vortex already knows about
 *      (i.e., it has an entry under `state.persistent.downloads.files`).
 *      Skips the copy step.
 *
 *  • `did-install-mod`         (gameId, archiveId, modId)
 *      Fired when an install pipeline completes. The driver uses this
 *      to learn the new modId when no synchronous callback is exposed.
 *
 *  • `nexusDownload(...)` (api.ext)
 *      Documented helper that downloads from Nexus and (with
 *      `allowInstall=true`) auto-triggers `start-install-download`.
 *      Returns the archiveId; we still listen for `did-install-mod` to
 *      learn the resulting modId.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

import { util } from "vortex-api";
import type { types } from "vortex-api";

import {
  type SevenZipApi,
  resolveSevenZip,
} from "../manifest/sevenZip";

/**
 * How long we'll wait for `did-install-mod` after starting an install
 * before giving up. Real installs of FOMODs with hundreds of files
 * routinely take 30–60s on slow disks; we err on the side of patience.
 */
const INSTALL_COMPLETION_TIMEOUT_MS = 10 * 60_000; // 10 minutes

/**
 * Install a Nexus mod by triggering Vortex's typed `nexusDownload`
 * helper with `allowInstall=true`. Returns the new Vortex mod id once
 * Vortex's install pipeline reports completion via `did-install-mod`.
 */
export async function installNexusViaApi(
  api: types.IExtensionApi,
  args: {
    gameId: string;
    nexusModId: number;
    nexusFileId: number;
    fileName?: string;
  },
): Promise<{ archiveId: string; vortexModId: string }> {
  if (!api.ext?.nexusDownload) {
    throw new Error(
      "Vortex's Nexus integration is not available. Is the Nexus extension " +
        "enabled and the user logged in?",
    );
  }

  // Subscribe BEFORE triggering — `did-install-mod` can fire before the
  // `nexusDownload` promise resolves on hot caches.
  const completed = waitForInstallCompletion(api, {
    gameId: args.gameId,
    matchArchiveId: undefined, // we don't know it yet; matched below
  });

  const archiveId = await api.ext.nexusDownload(
    args.gameId,
    args.nexusModId,
    args.nexusFileId,
    args.fileName,
    true, // allowInstall — Vortex auto-installs
  );

  if (typeof archiveId !== "string" || archiveId.length === 0) {
    throw new Error(
      `Nexus download for modId=${args.nexusModId}, fileId=${args.nexusFileId} ` +
        `returned no archiveId.`,
    );
  }

  // Now narrow the listener to this specific archiveId.
  completed.setExpectedArchiveId(archiveId);

  const result = await completed.promise;

  return { archiveId, vortexModId: result.modId };
}

/**
 * Install from an archive Vortex already knows about (one that has an
 * entry under `state.persistent.downloads.files`).
 */
export async function installFromExistingDownload(
  api: types.IExtensionApi,
  args: {
    gameId: string;
    archiveId: string;
  },
): Promise<{ vortexModId: string }> {
  const completed = waitForInstallCompletion(api, {
    gameId: args.gameId,
    matchArchiveId: args.archiveId,
  });

  api.events.emit("start-install-download", args.archiveId);

  const result = await completed.promise;
  return { vortexModId: result.modId };
}

/**
 * Install from a local archive on disk that Vortex does NOT yet know
 * about. Used in two paths:
 *
 *  - `external-prompt-user` decisions where the user picked a local
 *    file via the picker (slice 6b).
 *  - As the install half of {@link installFromBundledArchive} (after
 *    extraction).
 *
 * Vortex's `start-install` event accepts an absolute path to an
 * archive on disk; it copies the archive into the downloads folder,
 * registers it, runs the installer pipeline, and dispatches the mod
 * into the global pool.
 *
 * Returns the new Vortex mod id once Vortex confirms install
 * completion. The source file is NOT removed by this function — the
 * caller owns its lifecycle.
 */
export async function installFromLocalArchive(
  api: types.IExtensionApi,
  args: {
    gameId: string;
    archivePath: string;
  },
): Promise<{ vortexModId: string }> {
  const completed = waitForInstallCompletion(api, {
    gameId: args.gameId,
    matchArchiveId: undefined,
    acceptAny: true,
  });

  // Same dual-path race as installFromBundledArchive: synchronous
  // callback gives the modId fast; `did-install-mod` is the fallback
  // for Vortex builds that don't invoke the cb reliably (now actually
  // wired up — accepts the first did-install-mod for our gameId).
  const callbackPromise = new Promise<{ modId: string }>((resolve, reject) => {
    api.events.emit(
      "start-install",
      args.archivePath,
      (err: Error | null | undefined, modId: string) => {
        if (err) {
          reject(err);
          return;
        }
        if (!modId) {
          reject(new Error("start-install completed without a modId."));
          return;
        }
        resolve({ modId });
      },
    );
  });

  const result = await Promise.race([callbackPromise, completed.promise]);
  return { vortexModId: result.modId };
}

/**
 * Uninstall a Vortex mod entirely — file system + state + archive
 * association. Wraps `util.removeMods` (which Vortex itself uses for
 * "Remove Mod" in the UI), so the cleanup matches the user's
 * expectation: the mod's deployed files are unlinked, the mod entry
 * disappears from `state.persistent.mods[gameId]`, and Vortex's
 * staging folder for the mod is removed.
 *
 * Used by the install driver (slice 6b) for two purposes:
 *  - Replacing the user's existing mod when the user chose
 *    `replace-existing` for a `*-diverged` decision.
 *  - Removing an orphaned mod from a previous release of the same
 *    collection when the user chose `uninstall`.
 *
 * Throws if `util.removeMods` is not available (older Vortex builds)
 * or if the underlying removal fails. The driver translates the
 * throw into a `failed` result with the failing phase.
 */
export async function uninstallMod(
  api: types.IExtensionApi,
  args: { gameId: string; modId: string },
): Promise<void> {
  const removeMods = (util as unknown as {
    removeMods?: (
      api: types.IExtensionApi,
      gameId: string,
      modIds: string[],
    ) => Promise<void>;
  }).removeMods;

  if (typeof removeMods !== "function") {
    throw new Error(
      "Vortex's util.removeMods is not available. " +
        "Cannot remove existing mod safely; please update Vortex.",
    );
  }

  await removeMods(api, args.gameId, [args.modId]);
}

/**
 * Install from a `.ehcoll`'s bundled archive. The bundled archive is
 * extracted from the package ZIP into a temp directory, then handed to
 * Vortex's `start-install` which takes care of the rest (installer
 * pipeline, FOMOD UI if applicable, mod-pool dispatch).
 *
 * The temp file is left in place after install — Vortex copies it into
 * the downloads folder during `start-install`, so it's safe to delete.
 * The driver's caller is responsible for cleanup at the end of the
 * install run.
 *
 * @returns the resulting Vortex mod id and the temp archive path so
 *   the caller can clean up after the run completes.
 */
export async function installFromBundledArchive(
  api: types.IExtensionApi,
  args: {
    gameId: string;
    ehcollZipPath: string;
    bundledZipEntry: string; // e.g. "bundled/abc...123.zip"
    sevenZip?: SevenZipApi;
  },
): Promise<{ vortexModId: string; extractedPath: string }> {
  const sevenZip = args.sevenZip ?? resolveSevenZip();

  const extractedPath = await extractBundledFromEhcoll(
    args.ehcollZipPath,
    args.bundledZipEntry,
    sevenZip,
  );

  const completed = waitForInstallCompletion(api, {
    gameId: args.gameId,
    // start-install registers a NEW archiveId we cannot know in
    // advance. acceptAny: true makes the did-install-mod listener a
    // real fallback for Vortex builds where the synchronous callback
    // below isn't invoked reliably.
    matchArchiveId: undefined,
    acceptAny: true,
  });

  // `start-install` accepts a callback `(err, modId) => void`. We use
  // both: the callback gives us the most precise modId (Vortex resolves
  // it synchronously after install), and `did-install-mod` is a fallback
  // for older Vortex builds that don't invoke the cb reliably.
  const callbackPromise = new Promise<{ modId: string }>((resolve, reject) => {
    api.events.emit(
      "start-install",
      extractedPath,
      (err: Error | null | undefined, modId: string) => {
        if (err) {
          reject(err);
          return;
        }
        if (!modId) {
          reject(new Error("start-install completed without a modId."));
          return;
        }
        resolve({ modId });
      },
    );
  });

  // Whichever resolves first wins. The other settles silently.
  const result = await Promise.race([callbackPromise, completed.promise]);

  return { vortexModId: result.modId, extractedPath };
}

// ===========================================================================
// Helpers
// ===========================================================================

/**
 * Subscribe to Vortex's `did-install-mod` event and wrap it in a
 * promise. The listener auto-removes after a successful match or
 * timeout.
 *
 * Two matching modes:
 *
 *  - **exact**: only `did-install-mod` with `archiveId === matchArchiveId`
 *    resolves the promise. Used by Nexus and existing-download flows
 *    where the archiveId is known up-front (or set later via
 *    {@link setExpectedArchiveId}).
 *  - **any-after-start**: the first `did-install-mod` for our gameId
 *    that fires AFTER the listener is registered resolves the promise.
 *    Used by `installFromBundledArchive` / `installFromLocalArchive`
 *    where Vortex's `start-install` allocates a new archiveId we
 *    cannot know in advance. Combined with the synchronous
 *    `start-install` callback via `Promise.race`, this gives us a
 *    real fallback if the callback is unreliable on a given Vortex
 *    build.
 *
 * The historical "buffer events until expectedArchiveId is set"
 * behavior is preserved for the exact-mode flow (it covers the
 * `nexusDownload` race where `did-install-mod` can fire before the
 * promise from `nexusDownload` resolves).
 */
function waitForInstallCompletion(
  api: types.IExtensionApi,
  opts: {
    gameId: string;
    /**
     * For exact-mode: the archiveId to match. Undefined ⇒ "match
     * mode is exact, but we don't know the id yet; the caller will
     * call setExpectedArchiveId later." For any-after-start mode,
     * leave undefined and pass `acceptAny: true`.
     */
    matchArchiveId: string | undefined;
    /**
     * When true, the listener resolves on the FIRST `did-install-mod`
     * for `opts.gameId` regardless of archiveId. Cannot be combined
     * with `matchArchiveId`.
     */
    acceptAny?: boolean;
  },
): {
  promise: Promise<{ modId: string; archiveId: string }>;
  setExpectedArchiveId: (archiveId: string) => void;
} {
  if (opts.acceptAny && opts.matchArchiveId !== undefined) {
    throw new Error(
      "waitForInstallCompletion: cannot combine acceptAny with matchArchiveId.",
    );
  }

  let expectedArchiveId = opts.matchArchiveId;
  const acceptAny = opts.acceptAny === true;
  /**
   * Buffered events that arrived before `expectedArchiveId` was set.
   * Only used in exact-mode — in any-after-start mode the first
   * matching event resolves the promise immediately.
   */
  const buffer: Array<{
    gameId: string;
    archiveId: string;
    modId: string;
  }> = [];

  let resolveFn: (v: { modId: string; archiveId: string }) => void;
  let rejectFn: (err: Error) => void;
  let settled = false;

  const promise = new Promise<{ modId: string; archiveId: string }>(
    (resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    },
  );

  const onDidInstall = (
    gameId: string,
    archiveId: string,
    modId: string,
  ): void => {
    if (settled) return;
    if (gameId !== opts.gameId) return;

    if (acceptAny) {
      settled = true;
      cleanup();
      resolveFn({ modId, archiveId });
      return;
    }

    if (expectedArchiveId === undefined) {
      buffer.push({ gameId, archiveId, modId });
      return;
    }

    if (archiveId !== expectedArchiveId) return;

    settled = true;
    cleanup();
    resolveFn({ modId, archiveId });
  };

  api.events.on("did-install-mod", onDidInstall);

  const timeout = setTimeout(() => {
    if (settled) return;
    settled = true;
    cleanup();
    rejectFn(
      new Error(
        `Mod install did not complete within ${
          INSTALL_COMPLETION_TIMEOUT_MS / 1000
        }s.`,
      ),
    );
  }, INSTALL_COMPLETION_TIMEOUT_MS);

  function cleanup(): void {
    api.events.removeListener("did-install-mod", onDidInstall);
    clearTimeout(timeout);
  }

  return {
    promise,
    setExpectedArchiveId: (archiveId: string) => {
      expectedArchiveId = archiveId;

      // Drain the buffer for any events we got before we knew the id.
      const match = buffer.find((entry) => entry.archiveId === archiveId);
      if (match && !settled) {
        settled = true;
        cleanup();
        resolveFn({ modId: match.modId, archiveId: match.archiveId });
      }
    },
  };
}

/**
 * Extract a single bundled archive entry out of a `.ehcoll` package
 * into a uniquely-named temp file. Returns the absolute path of the
 * extracted file.
 *
 * The extraction directory is deliberately fresh per-call so two
 * concurrent extractions can't trample each other.
 */
export async function extractBundledFromEhcoll(
  ehcollZipPath: string,
  bundledZipEntry: string,
  sevenZip: SevenZipApi,
): Promise<string> {
  const tempDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), "event-horizon-install-"),
  );

  await new Promise<void>((resolve, reject) => {
    const stream = sevenZip.extract(ehcollZipPath, tempDir, {
      $cherryPick: [bundledZipEntry],
    });
    stream.on("end", () => resolve());
    stream.on("error", (err: Error) =>
      reject(
        new Error(
          `7z failed to extract "${bundledZipEntry}" from "${ehcollZipPath}": ${err.message}.`,
        ),
      ),
    );
  });

  // The cherry-pick preserves the entry's path inside `tempDir`.
  const extracted = path.join(tempDir, ...bundledZipEntry.split("/"));

  // Sanity-check: confirm the file actually landed.
  await fsp.access(extracted);

  return extracted;
}

/**
 * Best-effort cleanup of a directory created by
 * {@link extractBundledFromEhcoll}. Errors are swallowed — the OS
 * temp GC will eventually reclaim leftovers.
 */
export async function safeRmTempDir(filePath: string): Promise<void> {
  try {
    const dir = path.dirname(filePath);
    await fsp.rm(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}
