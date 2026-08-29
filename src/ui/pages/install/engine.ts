/**
 * Install wizard engine — pure async helpers that mirror the
 * call sequence in `installCollectionAction.ts`, but rewritten to
 * report progress via callbacks instead of `showDialog`.
 *
 * Each helper here is a leaf — it calls into `core/` and returns a
 * value (or throws). The `InstallPage` orchestrates them by chaining
 * the helpers together and dispatching wizard reducer actions in
 * between.
 *
 * Why duplicate the call sequence rather than refactor the action?
 *   - The action's flow is dialog-coupled in subtle ways (e.g. the
 *     stale-receipt prompt loop). Pulling that out of the action
 *     means the legacy toolbar entry point breaks until the same
 *     refactor touches it.
 *   - The action stays as a known-good fallback while we exercise
 *     the new UI in E2E. Once the UI is the canonical path, the
 *     action can be deleted or trimmed to a thin shim.
 */

import { selectors, util } from "@nexusmods/vortex-api";
import type { types } from "@nexusmods/vortex-api";

import {
  AbortError,
  enrichModsWithArchiveHashes,
} from "../../../core/archiveHashing";
import {
  getActiveGameId,
  getActiveProfileIdFromState,
  getModsForProfile,
} from "../../../core/getModsListForProfile";
import { readReceipt } from "../../../core/installLedger";
import type { AvailableDownload } from "../../../types/installPlan";
import {
  type ReadEhcollResult,
  readEhcoll,
} from "../../../core/manifest/readEhcoll";
import { enrichInstalledModsWithStagingSetHashes } from "../../../core/resolver/enrichStagingSetHashes";
import { resolveInstallPlan } from "../../../core/resolver/resolveInstallPlan";
import {
  buildUserSideState,
  pickInstallTarget,
  resolveDeploymentMethod,
  resolveEnabledExtensions,
  resolveGameVersion,
  resolveProfileName,
  resolveVortexVersion,
} from "../../../core/resolver/userState";
import type { SupportedGameId } from "../../../types/ehcoll";
import type { InstallReceipt } from "../../../types/installLedger";
import type { InstallPlan } from "../../../types/installPlan";
import { getVortexUserDataPath } from "../../../core/paths";

const SUPPORTED_GAME_IDS: ReadonlySet<string> = new Set<SupportedGameId>([
  "skyrimse",
  "fallout3",
  "falloutnv",
  "fallout4",
  "starfield",
]);

export interface LoadProgressEvents {
  onPhase: (phase: import("./state").LoadingPhase, hashCount?: number) => void;
  /**
   * Live "X / Y" hashing counter. Called once per mod as its archive
   * hash completes (or is skipped). Always paired with phase ===
   * "hashing-mods".
   */
  onHashProgress?: (
    done: number,
    total: number,
    currentItem: string,
  ) => void;
}

export type LoadOutcome =
  | {
      kind: "stale-receipt";
      ehcoll: ReadEhcollResult;
      receipt: InstallReceipt;
      appDataPath: string;
    }
  | {
      kind: "ready";
      ehcoll: ReadEhcollResult;
      receipt: InstallReceipt | undefined;
      plan: InstallPlan;
      appDataPath: string;
    };

/**
 * Run everything from "user picked a file" through to "we have a
 * plan ready for preview", emitting phase events along the way.
 *
 * Throws on any error — the caller (InstallPage) catches and routes
 * the error into the wizard's `set-error` action so the global
 * ErrorReportModal opens.
 */
export async function runLoadingPipeline(args: {
  api: types.IExtensionApi;
  zipPath: string;
  events: LoadProgressEvents;
  signal?: AbortSignal;
}): Promise<LoadOutcome> {
  const { api, zipPath, events, signal } = args;
  const checkAbort = (): void => {
    if (signal?.aborted) {
      throw new AbortError("Loading cancelled by user");
    }
  };

  // ── 1. read .ehcoll ───────────────────────────────────────────────
  checkAbort();
  events.onPhase("reading-package");
  const ehcoll = await readEhcoll(zipPath);
  const { manifest } = ehcoll;

  // ── 2. early game-id gate ────────────────────────────────────────
  checkAbort();
  events.onPhase("checking-game");
  const state = api.getState();
  const activeGameId = getActiveGameId(state);
  if (!activeGameId) {
    throw new Error(
      "No active game in Vortex. Switch to the game this collection targets, then retry.",
    );
  }
  if (!SUPPORTED_GAME_IDS.has(activeGameId)) {
    throw new Error(
      `Active game "${activeGameId}" is not supported by Event Horizon. ` +
        `Supported: ${Array.from(SUPPORTED_GAME_IDS).join(", ")}.`,
    );
  }
  if (manifest.game.id !== activeGameId) {
    throw new Error(
      `This collection is for "${manifest.game.id}" but the active game is "${activeGameId}". ` +
        `Switch to "${manifest.game.id}" in Vortex's game selector and retry.`,
    );
  }
  const activeProfileId = getActiveProfileIdFromState(state, activeGameId);
  if (!activeProfileId) {
    throw new Error(`No profile found for game "${activeGameId}".`);
  }

  // ── 2b. preflight: can VORTEX unpack archives? ───────────────────
  // Event Horizon no longer needs 7z to read the package, but Vortex needs it
  // to install every mod inside it, and on a Wine/Proton prefix that is the
  // component most likely to be broken. Discovering it forty minutes into a
  // 954-mod install reads as "this collection is broken" rather than "this
  // prefix is missing a runtime", and sends the curator chasing a package
  // that was never at fault.
  //
  // Placed after the game gate deliberately: by here the package is known to
  // be real and for the right game, so the warning is worth the interruption.
  // Warns, never blocks — see checkSevenZipHealth.
  await warnIfSevenZipBroken(api);

  // ── 3. read receipt ──────────────────────────────────────────────
  checkAbort();
  events.onPhase("reading-receipt");
  const appDataPath = getVortexUserDataPath();
  const receipt = await readReceipt(appDataPath, manifest.package.id);

  // Stale-receipt detection (mirror H2 in installCollectionAction).
  if (receipt !== undefined) {
    if (!profileExistsInState(state, receipt.vortexProfileId)) {
      return { kind: "stale-receipt", ehcoll, receipt, appDataPath };
    }
  }

  // ── 4. snapshot pipeline (hash archive bytes) ────────────────────
  checkAbort();
  const rawMods = getModsForProfile(state, activeGameId, activeProfileId);
  events.onPhase("hashing-mods", rawMods.length);
  const archiveHashed = await enrichModsWithArchiveHashes(
    state,
    activeGameId,
    rawMods,
    {
      signal,
      onProgress: (done, total, mod) => {
        events.onHashProgress?.(done, total, mod.name);
      },
    },
  );

  // ── 4b. staging-set-hash enrichment ──────────────────────────────
  // Cheap no-op when the manifest has no archive-less external mods.
  // For mods Vortex didn't retain the archive of (manual installs,
  // sideloads, archives the user purged), this is the only identity
  // oracle the resolver can match on.
  checkAbort();
  events.onPhase("hashing-staging");
  const installedMods = await enrichInstalledModsWithStagingSetHashes(
    state,
    activeGameId,
    manifest,
    archiveHashed,
    {
      signal,
      onProgress: (done, total, mod) => {
        events.onHashProgress?.(done, total, mod.name);
      },
    },
  );

  // ── 4c. what is already in the download folder ───────────────────
  checkAbort();
  events.onPhase("scanning-downloads");
  const availableDownloads = await scanAvailableDownloads({
    api,
    gameId: activeGameId,
    appDataPath,
    ...(signal !== undefined ? { signal } : {}),
    onProgress: (done, total, name) => {
      events.onHashProgress?.(done, total, name);
    },
  });

  // ── 5. resolve plan ──────────────────────────────────────────────
  checkAbort();
  events.onPhase("resolving-plan");
  const activeProfileName =
    resolveProfileName(state, activeProfileId) ?? activeProfileId;

  const userState = buildUserSideState({
    gameId: activeGameId,
    gameVersion: resolveGameVersion(state, activeGameId),
    vortexVersion: resolveVortexVersion(state),
    deploymentMethod: resolveDeploymentMethod(state, activeGameId),
    enabledExtensions: resolveEnabledExtensions(state),
    activeProfileId,
    activeProfileName,
    installedMods,
    receipt,
    availableDownloads,
    externalDependencyState: undefined,
  });

  const installTarget = pickInstallTarget(
    manifest,
    receipt,
    activeProfileId,
    activeProfileName,
  );

  const plan = resolveInstallPlan(manifest, userState, installTarget);

  return { kind: "ready", ehcoll, receipt, plan, appDataPath };
}

/**
 * Re-resolve a plan after the user explicitly accepted a stale
 * receipt. We rebuild the `userState` and `installTarget` exactly
 * like `runLoadingPipeline`, but skip the stale-receipt detection
 * branch and use whatever the user told us to use.
 */
export async function runLoadingPipelineWithReceipt(args: {
  api: types.IExtensionApi;
  zipPath: string;
  ehcoll: ReadEhcollResult;
  receipt: InstallReceipt | undefined;
  appDataPath: string;
  events: LoadProgressEvents;
  signal?: AbortSignal;
}): Promise<{
  ehcoll: ReadEhcollResult;
  receipt: InstallReceipt | undefined;
  plan: InstallPlan;
  appDataPath: string;
}> {
  const { api, ehcoll, receipt, appDataPath, events, signal } = args;
  const { manifest } = ehcoll;
  const checkAbort = (): void => {
    if (signal?.aborted) {
      throw new AbortError("Loading cancelled by user");
    }
  };

  checkAbort();
  events.onPhase("checking-game");
  const state = api.getState();
  const activeGameId = getActiveGameId(state);
  if (!activeGameId || manifest.game.id !== activeGameId) {
    throw new Error(
      `Active game must be "${manifest.game.id}" but is "${activeGameId}".`,
    );
  }
  const activeProfileId = getActiveProfileIdFromState(state, activeGameId);
  if (!activeProfileId) {
    throw new Error(`No profile found for game "${activeGameId}".`);
  }

  checkAbort();
  const rawMods = getModsForProfile(state, activeGameId, activeProfileId);
  events.onPhase("hashing-mods", rawMods.length);
  const archiveHashed = await enrichModsWithArchiveHashes(
    state,
    activeGameId,
    rawMods,
    {
      signal,
      onProgress: (done, total, mod) => {
        events.onHashProgress?.(done, total, mod.name);
      },
    },
  );

  checkAbort();
  events.onPhase("hashing-staging");
  const installedMods = await enrichInstalledModsWithStagingSetHashes(
    state,
    activeGameId,
    manifest,
    archiveHashed,
    {
      signal,
      onProgress: (done, total, mod) => {
        events.onHashProgress?.(done, total, mod.name);
      },
    },
  );

  // Same scan as the first-run path. Both pipelines need it: this one is the
  // RESUME after a kept stale receipt, which is exactly the case where the
  // download folder is most likely to already hold what we are about to ask
  // Nexus for.
  checkAbort();
  events.onPhase("scanning-downloads");
  const availableDownloads = await scanAvailableDownloads({
    api,
    gameId: activeGameId,
    appDataPath,
    ...(signal !== undefined ? { signal } : {}),
    onProgress: (done, total, name) => {
      events.onHashProgress?.(done, total, name);
    },
  });

  checkAbort();
  events.onPhase("resolving-plan");
  const activeProfileName =
    resolveProfileName(state, activeProfileId) ?? activeProfileId;

  const userState = buildUserSideState({
    gameId: activeGameId,
    gameVersion: resolveGameVersion(state, activeGameId),
    vortexVersion: resolveVortexVersion(state),
    deploymentMethod: resolveDeploymentMethod(state, activeGameId),
    enabledExtensions: resolveEnabledExtensions(state),
    activeProfileId,
    activeProfileName,
    installedMods,
    receipt,
    availableDownloads,
    externalDependencyState: undefined,
  });

  const installTarget = pickInstallTarget(
    manifest,
    receipt,
    activeProfileId,
    activeProfileName,
  );

  const plan = resolveInstallPlan(manifest, userState, installTarget);

  return { ehcoll, receipt, plan, appDataPath };
}

/**
 * Hash Vortex's download folder so the resolver can see what is already here.
 *
 * Until this existed, every call site passed `availableDownloads: undefined`
 * and the resolver's `*-use-local-download` arms were unreachable — so an
 * install always asked Nexus for a file it might already be holding. When it
 * WAS holding it, Vortex had nothing to do, never reported an install, and
 * the driver sat on "downloading" a completed download.
 *
 * Returns `undefined` on any failure, which is not a fallback so much as the
 * status quo: that is precisely the value every call site used to pass, and
 * the resolver's behaviour with it is the behaviour we shipped for months. A
 * download scan that fails must cost a re-download, never an install.
 */
async function scanAvailableDownloads(args: {
  api: types.IExtensionApi;
  gameId: string;
  appDataPath: string;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, name: string) => void;
}): Promise<AvailableDownload[] | undefined> {
  try {
    const dir = downloadsDirFor(args.api, args.gameId);
    if (dir === undefined) return undefined;

    const { loadArchiveHashCache, saveArchiveHashCache } = await import(
      "../../../core/archiveHashCache"
    );
    const { collectAvailableDownloads, describeDownloadScan } = await import(
      "../../../core/resolver/collectAvailableDownloads"
    );
    const { ehLog } = await import("../../../core/logging/ehLog");

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
    const { ehLog } = await import("../../../core/logging/ehLog");
    ehLog("warn", "downloads.scan.failed", {
      why: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

/**
 * Where Vortex keeps downloads for this game.
 *
 * `downloadPathForGame` is a selector we read defensively rather than import
 * as a typed symbol: @nexusmods/vortex-api is types-only, so a name existing
 * in the .d.ts is not evidence the running Vortex has it.
 */
function downloadsDirFor(
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

/**
 * Tell the user if Vortex's own extractor is broken, then carry on.
 *
 * Every failure here is swallowed on purpose. This runs before an install and
 * is not a gate: a preflight that throws would turn "your prefix is missing a
 * runtime" — a warning the user can act on later — into a hard stop with no
 * way past it. The install can still legitimately succeed for a collection
 * whose mods are all already downloaded.
 */
export async function warnIfSevenZipBroken(
  api: types.IExtensionApi,
): Promise<void> {
  try {
    const { checkSevenZipHealth, describeSevenZipHealth, looksLikeWine } =
      await import("../../../core/installer/checkSevenZipHealth");
    const health = await checkSevenZipHealth();
    const advice = describeSevenZipHealth(health);
    if (advice === undefined) return;

    // Logged as well as shown: the tester's log is what we get to read when a
    // remote install goes wrong, and a notification the user dismissed leaves
    // no trace at all.
    const { ehLog } = await import("../../../core/logging/ehLog");
    ehLog("warn", "sevenzip.preflight", {
      kind: health.kind,
      why: health.kind === "ok" ? undefined : health.why,
      wine: looksLikeWine(),
    });

    api.sendNotification?.({
      id: "eh-sevenzip-health",
      type: health.kind === "indeterminate" ? "info" : "warning",
      title: "Vortex's archive extractor",
      message: advice.message,
      actions: [
        {
          title: "What to do",
          action: () => {
            api.showDialog?.(
              "info",
              "Vortex cannot unpack mod archives",
              {
                text: [advice.message, "", ...advice.steps].join("\n"),
              },
              [{ label: "Close" }],
            );
          },
        },
      ],
    });
  } catch {
    // A preflight that fails must not become the failure.
  }
}

function profileExistsInState(state: unknown, profileId: string): boolean {
  const profiles = (state as {
    persistent?: { profiles?: Record<string, unknown> };
  }).persistent?.profiles;
  if (!profiles) return false;
  return Object.prototype.hasOwnProperty.call(profiles, profileId);
}
