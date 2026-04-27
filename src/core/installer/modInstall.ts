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
 * Install completion is policed by **two** timers, not one:
 *
 *  1. {@link INSTALL_STALL_WATCHDOG_MS} — the **stall watchdog**. We
 *     reset it every time we observe a relevant progress signal (a
 *     download chunk landed, the entry's state transitioned, the mod
 *     count for our gameId mutated, etc.). If Vortex makes zero
 *     observable progress for this long we conclude the pipeline is
 *     hung and reject. This is the timer that actually matters for
 *     real-world UX — most installs reset it dozens of times per
 *     second during the download phase, so it never trips on a
 *     healthy install no matter how big the archive is.
 *
 *  2. {@link INSTALL_ABSOLUTE_CAP_MS} — the **absolute cap**. Pure
 *     safety net for the pathological case where Vortex is reporting
 *     progress but is actually livelocked (e.g. retrying a network
 *     call forever). In healthy operation this never trips.
 *
 * Why not a single fixed deadline? The previous design used a 10 min
 * fixed deadline, which was simultaneously too short for slow
 * connections (a 4 GB download on 10 Mbps is ~55 min, all of it
 * Vortex working fine) and too long for diagnosing real hangs (a
 * stuck FOMOD dialog had to sit for 10 min before we'd error out).
 * The two-timer design solves both: hangs surface in 90s; legitimate
 * long-running installs are bounded only by the 60 min absolute cap.
 */
const INSTALL_STALL_WATCHDOG_MS = 90_000; // 90s of zero progress = hung
const INSTALL_ABSOLUTE_CAP_MS = 60 * 60_000; // 60 min hard ceiling

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
    /**
     * Optional cancellation token. If aborted before
     * `did-install-mod` fires, the awaited promise rejects with an
     * `AbortError`. Vortex's `nexusDownload` itself cannot be
     * cancelled (the API doesn't expose a hook), but the driver
     * stops blocking immediately.
     */
    signal?: AbortSignal;
  },
): Promise<{ archiveId: string; vortexModId: string }> {
  if (!api.ext?.nexusDownload) {
    throw new Error(
      "Vortex's Nexus integration is not available. Is the Nexus extension " +
        "enabled and the user logged in?",
    );
  }

  if (args.signal?.aborted) {
    throw makeAbortErrorLocal("nexus install");
  }

  // Subscribe BEFORE triggering — `did-install-mod` can fire before the
  // `nexusDownload` promise resolves on hot caches.
  const completed = waitForInstallCompletion(api, {
    gameId: args.gameId,
    matchArchiveId: undefined, // we don't know it yet; matched below
    signal: args.signal,
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
    /** Optional cancellation token; see {@link installNexusViaApi}. */
    signal?: AbortSignal;
  },
): Promise<{ vortexModId: string }> {
  if (args.signal?.aborted) {
    throw makeAbortErrorLocal("install from existing download");
  }

  const completed = waitForInstallCompletion(api, {
    gameId: args.gameId,
    matchArchiveId: args.archiveId,
    signal: args.signal,
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
    /** Optional cancellation token; see {@link installNexusViaApi}. */
    signal?: AbortSignal;
  },
): Promise<{ vortexModId: string }> {
  if (args.signal?.aborted) {
    throw makeAbortErrorLocal("install from local archive");
  }

  const completed = waitForInstallCompletion(api, {
    gameId: args.gameId,
    matchArchiveId: undefined,
    acceptAny: true,
    signal: args.signal,
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
 * install run via {@link safeRmTempDir} on `tempDir`.
 *
 * Failure modes that own cleanup here (rather than the driver):
 *  - 7z extraction fails before we can hand the file to Vortex →
 *    {@link extractBundledFromEhcoll} cleans up its own tempDir.
 *  - `start-install` rejects (synchronous callback path) before
 *    Vortex copies the archive into its downloads folder → we
 *    cleanup tempDir here. The driver's cleanup list never sees it.
 *
 * @returns the resulting Vortex mod id, the extracted path on disk,
 *   and the temp directory the caller must remove once Vortex has
 *   finished with the archive.
 */
export async function installFromBundledArchive(
  api: types.IExtensionApi,
  args: {
    gameId: string;
    ehcollZipPath: string;
    bundledZipEntry: string; // e.g. "bundled/abc...123.zip"
    sevenZip?: SevenZipApi;
    /** Optional cancellation token; see {@link installNexusViaApi}. */
    signal?: AbortSignal;
  },
): Promise<{
  vortexModId: string;
  extractedPath: string;
  tempDir: string;
}> {
  const sevenZip = args.sevenZip ?? resolveSevenZip();

  if (args.signal?.aborted) {
    throw makeAbortErrorLocal("install from bundled archive");
  }

  const { extractedPath, tempDir } = await extractBundledFromEhcoll(
    args.ehcollZipPath,
    args.bundledZipEntry,
    sevenZip,
  );

  try {
    if (args.signal?.aborted) {
      // User aborted between extraction and start-install; skip the
      // start-install dispatch entirely. The catch below cleans up
      // tempDir.
      throw makeAbortErrorLocal("install from bundled archive");
    }

    const completed = waitForInstallCompletion(api, {
      gameId: args.gameId,
      // start-install registers a NEW archiveId we cannot know in
      // advance. acceptAny: true makes the did-install-mod listener a
      // real fallback for Vortex builds where the synchronous callback
      // below isn't invoked reliably.
      matchArchiveId: undefined,
      acceptAny: true,
      signal: args.signal,
    });

    // `start-install` accepts a callback `(err, modId) => void`. We use
    // both: the callback gives us the most precise modId (Vortex resolves
    // it synchronously after install), and `did-install-mod` is a fallback
    // for older Vortex builds that don't invoke the cb reliably.
    const callbackPromise = new Promise<{ modId: string }>(
      (resolve, reject) => {
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
      },
    );

    // Whichever resolves first wins. The other settles silently.
    const result = await Promise.race([callbackPromise, completed.promise]);

    return { vortexModId: result.modId, extractedPath, tempDir };
  } catch (err) {
    // start-install rejected before Vortex took ownership of the
    // archive — no copy was made into the downloads folder, so we
    // own the tempDir and must clean it up here. Otherwise it leaks
    // until OS temp GC.
    await safeRmTempDir(tempDir);
    throw err;
  }
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
     *
     * SAFETY: this mode is only sound when callers guarantee at most
     * one install pipeline is running globally for `opts.gameId` —
     * otherwise we can race and resolve with a modId that belongs to
     * a *different* concurrent install. Today that invariant is held
     * by EHRuntime (see src/ui/runtime/ehRuntime.ts), which serializes
     * EH's build/install pipelines, AND by the install driver itself
     * which installs mods sequentially. If you ever want parallel
     * installs, do NOT use acceptAny.
     */
    acceptAny?: boolean;
    /**
     * If provided, the promise rejects with an `AbortError` as soon
     * as the signal aborts. The synchronous `start-install` callback
     * in {@link installFromBundledArchive} / {@link installFromLocalArchive}
     * cannot itself be cancelled (Vortex's API doesn't expose that),
     * but at least the *driver* stops blocking on this promise so
     * the rest of the abort cleanup can proceed. Vortex's pipeline
     * eventually completes or errors on its own.
     */
    signal?: AbortSignal;
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

  // ── Two-timer watchdog (see header for rationale) ────────────────
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  let absoluteCapTimer: ReturnType<typeof setTimeout> | undefined;
  let storeUnsubscribe: (() => void) | undefined;
  let lastProgressAt = Date.now();

  /**
   * Snapshot of the download entry under
   * `state.persistent.downloads.files[expectedArchiveId]` from the
   * last time we observed it. We detect "progress" as any change in
   * `received` (download chunk landed), `state` (lifecycle
   * transition), or `size` (Vortex learned the total bytes).
   */
  let lastDownloadSnapshot:
    | { received: number; state: string; size: number }
    | undefined;
  /**
   * Mod count for our gameId at the last observation. Used as a
   * coarse-grained progress signal when archiveId isn't known yet
   * (Nexus path before nexusDownload returns) or when the install
   * pipeline phase doesn't update download.received (post-extract,
   * pre-deploy).
   */
  let lastModCount = -1;

  const armStallWatchdog = (): void => {
    if (stallTimer !== undefined) clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      const idleSec = Math.round((Date.now() - lastProgressAt) / 1000);
      rejectFn(
        new Error(
          `Mod install stalled — Vortex made no observable progress for ` +
            `${idleSec}s. The install pipeline may be waiting on a stuck ` +
            `dialog (FOMOD prompt, error notification) or be hung. Check ` +
            `Vortex's notification panel and try again.`,
        ),
      );
    }, INSTALL_STALL_WATCHDOG_MS);
  };

  const noteProgress = (): void => {
    lastProgressAt = Date.now();
    armStallWatchdog();
  };

  /**
   * Redux store listener. Fires after every action — we filter to
   * just the slices that move during a healthy install: the download
   * entry for our archive, and the mod pool for our gameId.
   *
   * Cost: ~O(1) state-tree walks per redux action. setTimeout
   * arm/disarm is similarly cheap. This is fine even during the
   * "100 progress events per second" early phase of a fast download.
   */
  const onStoreChange = (): void => {
    if (settled) return;

    // api.getState() is vortex-api's typed accessor; the underlying
    // ThunkStore exposes getState/subscribe but its TypeScript surface
    // doesn't, so we go through api.getState() for reads and cast for
    // the subscribe handle below.
    const state = api.getState() as unknown as
      | {
          persistent?: {
            downloads?: {
              files?: Record<
                string,
                {
                  received?: number;
                  state?: string;
                  size?: number;
                }
              >;
            };
            mods?: Record<string, Record<string, unknown>>;
          };
        }
      | undefined;
    if (!state) return;

    // Signal 1: the specific download entry we expect (Nexus &
    // existing-download paths). expectedArchiveId starts undefined
    // for the Nexus flow and gets filled in by setExpectedArchiveId.
    if (expectedArchiveId !== undefined) {
      const entry = state?.persistent?.downloads?.files?.[expectedArchiveId];
      if (entry) {
        const snap = {
          received: entry.received ?? 0,
          state: entry.state ?? "",
          size: entry.size ?? 0,
        };
        if (
          lastDownloadSnapshot === undefined ||
          lastDownloadSnapshot.received !== snap.received ||
          lastDownloadSnapshot.state !== snap.state ||
          lastDownloadSnapshot.size !== snap.size
        ) {
          lastDownloadSnapshot = snap;
          noteProgress();
          return;
        }
      }
    }

    // Signal 2: total mod count for our gameId (covers bundled-archive
    // and any phase the download entry doesn't move during). One mod
    // appearing or disappearing is enough to reset the watchdog —
    // Vortex's install pipeline mutates this slice on completion and
    // the action handler's middleware also touches it during failure
    // recovery.
    const modsForGame = state?.persistent?.mods?.[opts.gameId];
    const modCount =
      modsForGame !== undefined ? Object.keys(modsForGame).length : 0;
    if (lastModCount === -1) {
      lastModCount = modCount;
    } else if (modCount !== lastModCount) {
      lastModCount = modCount;
      noteProgress();
    }
  };

  const onDidInstall = (
    gameId: string,
    archiveId: string,
    modId: string,
  ): void => {
    if (settled) return;
    if (gameId !== opts.gameId) return;

    // did-install-mod is by definition a progress signal; reset the
    // watchdog before deciding whether to settle (covers the case
    // where the event is for a different archiveId in exact-mode).
    noteProgress();

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

  // Subscribe to the store if available. In test/mock environments
  // where api.store is undefined, the watchdog still works — it just
  // can't observe download progress, so the stall timer effectively
  // becomes a fixed deadline. did-install-mod still resolves the
  // promise on the happy path.
  //
  // vortex-api's ThunkStore<any> typing doesn't expose .subscribe but
  // the runtime object is a Redux store and definitely has it; cast.
  const storeWithSubscribe = api.store as unknown as
    | { subscribe?: (listener: () => void) => () => void }
    | undefined;
  const subscribeFn = storeWithSubscribe?.subscribe;
  if (typeof subscribeFn === "function") {
    storeUnsubscribe = subscribeFn(onStoreChange);
    // Seed the snapshots so the next mutation is detected as a delta.
    onStoreChange();
  }

  // Arm both timers.
  armStallWatchdog();
  absoluteCapTimer = setTimeout(() => {
    if (settled) return;
    settled = true;
    cleanup();
    rejectFn(
      new Error(
        `Mod install exceeded the absolute time cap of ` +
          `${INSTALL_ABSOLUTE_CAP_MS / 60_000} min. Vortex was reporting ` +
          `progress but never completed — assuming the pipeline is ` +
          `livelocked.`,
      ),
    );
  }, INSTALL_ABSOLUTE_CAP_MS);

  // Wire abort. If the signal is already aborted, settle synchronously
  // — but defer the rejection a microtask so cleanup runs on a fully-
  // constructed promise (avoids "leaks" of un-awaited cleanup).
  let abortListener: (() => void) | undefined;
  if (opts.signal) {
    if (opts.signal.aborted) {
      // Use a microtask so the caller has a chance to attach .catch
      // before the rejection lands. (Without this, a synchronous
      // throw here would surface before await.)
      Promise.resolve().then(() => {
        if (settled) return;
        settled = true;
        cleanup();
        rejectFn(makeAbortErrorLocal("install"));
      });
    } else {
      abortListener = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        rejectFn(makeAbortErrorLocal("install"));
      };
      opts.signal.addEventListener("abort", abortListener);
    }
  }

  function cleanup(): void {
    api.events.removeListener("did-install-mod", onDidInstall);
    if (stallTimer !== undefined) clearTimeout(stallTimer);
    if (absoluteCapTimer !== undefined) clearTimeout(absoluteCapTimer);
    if (storeUnsubscribe !== undefined) {
      try {
        storeUnsubscribe();
      } catch {
        // Vortex's store occasionally throws during teardown; we
        // don't care, the listener is dropped either way.
      }
    }
    if (abortListener !== undefined && opts.signal) {
      opts.signal.removeEventListener("abort", abortListener);
    }
  }

  return {
    promise,
    setExpectedArchiveId: (archiveId: string) => {
      expectedArchiveId = archiveId;
      // Reset the download snapshot so the next store tick captures
      // the entry for the *new* archiveId as fresh progress.
      lastDownloadSnapshot = undefined;
      // Also count "we now know the archiveId" itself as progress —
      // it means nexusDownload resolved, which definitionally means
      // Vortex made forward progress.
      noteProgress();

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
 * into a uniquely-named temp directory. Returns both the extracted
 * file's absolute path and the temp directory that contains it — the
 * caller must use the temp directory (not the file's parent) when
 * cleaning up, because cherry-picked entries can have nested paths
 * (e.g. `bundled/abc.zip` lands at `<tempDir>/bundled/abc.zip` and
 * `path.dirname` would only delete `<tempDir>/bundled`, leaking the
 * outer mkdtemp dir).
 *
 * The extraction directory is deliberately fresh per-call (mkdtemp's
 * 6-char random suffix makes it unique even within the same ms) so
 * two concurrent extractions can't trample each other.
 *
 * On 7z failure or post-extract sanity-check failure the temp dir is
 * removed before the error propagates — extraction owns its own
 * cleanup until it successfully returns.
 */
export async function extractBundledFromEhcoll(
  ehcollZipPath: string,
  bundledZipEntry: string,
  sevenZip: SevenZipApi,
): Promise<{ extractedPath: string; tempDir: string }> {
  const tempDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), "event-horizon-install-"),
  );

  try {
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
    const extractedPath = path.join(tempDir, ...bundledZipEntry.split("/"));

    // Sanity-check: confirm the file actually landed.
    await fsp.access(extractedPath);

    return { extractedPath, tempDir };
  } catch (err) {
    // Extraction never succeeded — clean up the empty/partial tempDir
    // here so the caller doesn't have to learn about it just to drop it.
    await safeRmTempDir(tempDir);
    throw err;
  }
}

/**
 * Best-effort cleanup of a temp directory created by
 * {@link extractBundledFromEhcoll}. Pass the **directory** returned
 * by extraction (not the extracted file's path) — cherry-picked
 * entries can have nested paths inside the temp dir, so deriving the
 * dir from `path.dirname(extractedPath)` would leak the outer
 * mkdtemp dir.
 *
 * Errors are swallowed — the OS temp GC will eventually reclaim any
 * leftovers and we don't want install-driver cleanup to mask a real
 * failure earlier in the pipeline.
 */
export async function safeRmTempDir(tempDir: string): Promise<void> {
  try {
    await fsp.rm(tempDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

/**
 * AbortError that matches the DOM AbortError shape (name === "AbortError")
 * so it survives the same `err.name === "AbortError"` checks the rest of
 * the codebase uses (see useErrorReporter, runInstall.checkAbort).
 *
 * Local copy rather than importing from profile.ts to avoid a circular
 * import — profile.ts has its own version with the same shape.
 */
function makeAbortErrorLocal(operation: string): Error {
  const err = new Error(`${operation} aborted by user`);
  err.name = "AbortError";
  return err;
}
