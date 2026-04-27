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

import { util } from "vortex-api";
import type { types } from "vortex-api";

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
import {
  type ReadEhcollResult,
  readEhcoll,
} from "../../../core/manifest/readEhcoll";
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

  // ── 3. read receipt ──────────────────────────────────────────────
  checkAbort();
  events.onPhase("reading-receipt");
  const appDataPath = util.getVortexPath("appData");
  const receipt = await readReceipt(appDataPath, manifest.package.id);

  // Stale-receipt detection (mirror H2 in installCollectionAction).
  if (receipt !== undefined) {
    if (!profileExistsInState(state, receipt.vortexProfileId)) {
      return { kind: "stale-receipt", ehcoll, receipt, appDataPath };
    }
  }

  // ── 4. snapshot pipeline (hash mods) ─────────────────────────────
  checkAbort();
  const rawMods = getModsForProfile(state, activeGameId, activeProfileId);
  events.onPhase("hashing-mods", rawMods.length);
  const installedMods = await enrichModsWithArchiveHashes(
    state,
    activeGameId,
    rawMods,
    {
      concurrency: 4,
      signal,
      onProgress: (done, total, mod) => {
        events.onHashProgress?.(done, total, mod.name);
      },
    },
  );

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
    availableDownloads: undefined,
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
  const installedMods = await enrichModsWithArchiveHashes(
    state,
    activeGameId,
    rawMods,
    {
      concurrency: 4,
      signal,
      onProgress: (done, total, mod) => {
        events.onHashProgress?.(done, total, mod.name);
      },
    },
  );

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
    availableDownloads: undefined,
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

function profileExistsInState(state: unknown, profileId: string): boolean {
  const profiles = (state as {
    persistent?: { profiles?: Record<string, unknown> };
  }).persistent?.profiles;
  if (!profiles) return false;
  return Object.prototype.hasOwnProperty.call(profiles, profileId);
}
