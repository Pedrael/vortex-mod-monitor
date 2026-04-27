/**
 * Build pipeline engine for the React BuildPage.
 *
 * Mirrors the same call sequence used by the legacy toolbar action in
 * `src/actions/buildPackageAction.ts`, but factored so the UI can:
 *
 *   1. Pre-load the curator's environment (active game, profile, mods,
 *      existing collection config) to populate the form before the
 *      curator clicks Build.
 *   2. Run the full pipeline (manifest → package) given a curator
 *      input + per-mod override map, reporting progress along the way.
 *
 * The legacy action stays as a fallback (it still wires the toolbar
 * button), but the UI calls this engine directly so the core logic
 * doesn't get duplicated.
 *
 * Design rule: this module touches Vortex state via the api, but
 * never any UI code. The progress callback is the only side channel
 * to the React layer.
 */

import * as fsp from "fs/promises";
import * as path from "path";
import { util } from "vortex-api";
import type { types } from "vortex-api";

import {
  AbortError,
  enrichModsWithArchiveHashes,
  getModArchivePath,
} from "../../../core/archiveHashing";
import { captureDeploymentManifests } from "../../../core/deploymentManifest";
import type { AuditorMod } from "../../../core/getModsListForProfile";
import {
  getActiveGameId,
  getActiveProfileIdFromState,
  getModsForProfile,
} from "../../../core/getModsListForProfile";
import { captureLoadOrder } from "../../../core/loadOrder";
import { getCurrentPluginsTxtPath } from "../../../core/comparePlugins";
import { buildManifest } from "../../../core/manifest/buildManifest";
import {
  packageEhcoll,
  type BundledArchiveSpec,
  type PackageEhcollResult,
} from "../../../core/manifest/packageZip";
import {
  loadOrCreateCollectionConfig,
  reconcileExternalModsConfig,
  saveCollectionConfig,
  toBuildManifestExternalMods,
  type CollectionConfig,
  type ExternalModConfigEntry,
} from "../../../core/manifest/collectionConfig";
import type {
  SupportedGameId,
  VortexDeploymentMethod,
} from "../../../types/ehcoll";

// ===========================================================================
// Public types
// ===========================================================================

export const SUPPORTED_GAME_IDS: ReadonlySet<string> = new Set<SupportedGameId>([
  "skyrimse",
  "fallout3",
  "falloutnv",
  "fallout4",
  "starfield",
]);

export interface CuratorInput {
  name: string;
  version: string;
  author: string;
  description: string;
}

/**
 * The curator-side environment, gathered before they fill in the form.
 * Drives the pre-populated fields (mod list, default name, etc.) and
 * is consumed unchanged by `runBuildPipeline`.
 */
export interface BuildContext {
  gameId: SupportedGameId;
  profileId: string;
  /**
   * Mods present in the active profile right now, with archive hashes
   * already filled in. The expensive hashing pass is done here so the
   * UI can show "ready to build" before opening the form, and the
   * actual build doesn't have to redo it (we keep the same array).
   */
  mods: AuditorMod[];
  /**
   * Subset of `mods` that are external (not on Nexus). These are the
   * only mods the curator can flag as bundled.
   */
  externalMods: AuditorMod[];
  /**
   * The on-disk per-collection state. Loaded from
   * `<appData>/Vortex/event-horizon/collections/.config/<slug>.json`,
   * or created fresh on first run. The config is the source of truth
   * for `package.id`, README/CHANGELOG, and per-mod overrides.
   *
   * `slug` is computed from `defaultName`; renaming the collection
   * later in the form will switch to a different slug → different
   * config file → different lineage.
   */
  collectionConfig: CollectionConfig;
  /** Path of the config file currently loaded. */
  configPath: string;
  /** Was the config file just created? Used to surface a "first build" hint. */
  configCreated: boolean;
  /** Best-effort default name (last build's name, or "My Collection"). */
  defaultName: string;
  /** Best-effort default version (last build's version, or "1.0.0"). */
  defaultVersion: string;
  /** Best-effort default author (last build's author, or empty). */
  defaultAuthor: string;
}

export type BuildProgressPhase =
  | "hashing-mods"
  | "capturing-deployment"
  | "capturing-load-order"
  | "reading-plugins-txt"
  | "writing-config"
  | "building-manifest"
  | "resolving-bundled-archives"
  | "packaging";

export interface BuildProgress {
  phase: BuildProgressPhase;
  message?: string;
  /**
   * For phases that iterate over a known number of items (today only
   * "hashing-mods"), the live counter so the UI can render an exact
   * "X / Y archives hashed" string. Omitted for non-iterative phases.
   */
  done?: number;
  total?: number;
  /** Human-readable name of the item currently being processed. */
  currentItem?: string;
}

export interface BuildPipelineResult {
  outputPath: string;
  outputBytes: number;
  bundledCount: number;
  modCount: number;
  warnings: string[];
}

export interface BuildOverrides {
  /** modId → override to apply on top of the existing config entry. */
  externalMods: Record<string, ExternalModConfigEntry>;
  readme: string;
  changelog: string;
}

// ===========================================================================
// Errors
// ===========================================================================

export class BundleResolutionError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(
      errors.length === 1
        ? errors[0]
        : `Cannot resolve bundled archives (${errors.length} problems):\n  - ${errors.join(
            "\n  - ",
          )}`,
    );
    this.name = "BundleResolutionError";
    this.errors = errors;
  }
}

// ===========================================================================
// Public API
// ===========================================================================

/**
 * Pre-flight: read state, hash mods, load (or create) the collection
 * config. Returns the form-population shape the React BuildPage needs.
 *
 * Pass `signal` to make the (potentially long) hashing pass
 * cancellable. Cancellation rejects with `AbortError` from
 * `core/archiveHashing`. Hashing is read-only so abort is always safe.
 */
export async function loadBuildContext(
  api: types.IExtensionApi,
  opts?: {
    onProgress?: (p: BuildProgress) => void;
    /**
     * If provided, overrides the slug used to look up the collection
     * config. Useful when the curator has just renamed the collection
     * in the form and we want to load (or create) the new file.
     */
    nameOverride?: string;
    signal?: AbortSignal;
  },
): Promise<BuildContext> {
  const onProgress = opts?.onProgress;
  const signal = opts?.signal;
  const state = api.getState();

  const gameId = getActiveGameId(state);
  if (!gameId) {
    throw new Error(
      "No active game in Vortex. Switch to a supported Creation Engine game first.",
    );
  }

  if (!SUPPORTED_GAME_IDS.has(gameId)) {
    throw new Error(
      `Game "${gameId}" is not supported by Event Horizon. Supported: ${Array.from(
        SUPPORTED_GAME_IDS,
      ).join(", ")}.`,
    );
  }

  const profileId = getActiveProfileIdFromState(state, gameId);
  if (!profileId) {
    throw new Error(`No active profile for game "${gameId}".`);
  }

  const rawMods = getModsForProfile(state, gameId, profileId);
  onProgress?.({
    phase: "hashing-mods",
    message: `Hashing ${rawMods.length} mod archives...`,
    done: 0,
    total: rawMods.length,
  });
  const mods = await enrichModsWithArchiveHashes(state, gameId, rawMods, {
    concurrency: 4,
    signal,
    onProgress: (done, total, mod) => {
      onProgress?.({
        phase: "hashing-mods",
        message: `Hashing mod archives (${done} / ${total})...`,
        done,
        total,
        currentItem: mod.name,
      });
    },
  });

  const externalMods = mods.filter((m) => !isNexusMod(m));

  const defaultName = opts?.nameOverride ?? "My Collection";
  const slug = slugify(defaultName);
  const appDataPath = util.getVortexPath("appData");
  const configDir = path.join(
    appDataPath,
    "event-horizon",
    "collections",
    ".config",
  );
  const loaded = await loadOrCreateCollectionConfig({ configDir, slug });
  let collectionConfig = loaded.config;

  // Reconcile so the curator opens the form already showing every
  // external mod, even ones added since the last build.
  const reconciled = reconcileExternalModsConfig({
    config: collectionConfig,
    externalMods: externalMods.map((m) => ({ id: m.id, name: m.name })),
  });
  if (reconciled.changed) {
    collectionConfig = reconciled.config;
    await saveCollectionConfig({
      configDir,
      slug,
      config: collectionConfig,
    });
  }

  return {
    gameId: gameId as SupportedGameId,
    profileId,
    mods,
    externalMods,
    collectionConfig,
    configPath: loaded.configPath,
    configCreated: loaded.created,
    defaultName,
    defaultVersion: "1.0.0",
    defaultAuthor: "",
  };
}

/**
 * Run the full build pipeline using the curator's form input.
 * Persists the latest overrides back into the per-collection config
 * file before producing the package.
 *
 * Pass `signal` to allow cancellation between phases. The pipeline
 * is checkpointed at each phase boundary — if the signal is aborted
 * the pipeline throws `AbortError` from the next checkpoint and no
 * .ehcoll file is written. Phases that have already completed (e.g.
 * the per-collection config was just saved) are persistent, but
 * those writes are read-only-state changes that the curator can
 * trivially overwrite by clicking Build again.
 */
export async function runBuildPipeline(
  api: types.IExtensionApi,
  context: BuildContext,
  curator: CuratorInput,
  overrides: BuildOverrides,
  opts?: { onProgress?: (p: BuildProgress) => void; signal?: AbortSignal },
): Promise<BuildPipelineResult> {
  const onProgress = opts?.onProgress;
  const signal = opts?.signal;
  const checkAbort = (): void => {
    if (signal?.aborted) {
      throw new AbortError("Build cancelled by user");
    }
  };

  checkAbort();
  const state = api.getState();
  const { gameId, mods } = context;

  // ── 1. Apply form overrides on top of the loaded config ────────────────
  const slug = slugify(curator.name);
  const appDataPath = util.getVortexPath("appData");
  const outputDir = path.join(appDataPath, "event-horizon", "collections");
  const configDir = path.join(outputDir, ".config");

  // If the curator renamed the collection, load (or create) the
  // config file for the NEW slug — the package id of the original
  // collection stays with the original name.
  let collectionConfig = context.collectionConfig;
  let configPath = context.configPath;
  if (slug !== slugify(context.defaultName)) {
    const reloaded = await loadOrCreateCollectionConfig({ configDir, slug });
    collectionConfig = reloaded.config;
    configPath = reloaded.configPath;

    const reconciled = reconcileExternalModsConfig({
      config: collectionConfig,
      externalMods: context.externalMods.map((m) => ({
        id: m.id,
        name: m.name,
      })),
    });
    if (reconciled.changed) {
      collectionConfig = reconciled.config;
    }
  }

  collectionConfig = {
    ...collectionConfig,
    externalMods: {
      ...collectionConfig.externalMods,
      ...overrides.externalMods,
    },
    readme: overrides.readme,
    changelog: overrides.changelog,
  };

  checkAbort();
  onProgress?.({ phase: "writing-config" });
  await saveCollectionConfig({ configDir, slug, config: collectionConfig });

  // ── 2. Capture deployment + load order + plugins.txt ───────────────────
  checkAbort();
  onProgress?.({ phase: "capturing-deployment" });
  const deploymentManifests = await captureDeploymentManifests(
    api,
    state,
    gameId,
  );

  checkAbort();
  onProgress?.({ phase: "capturing-load-order" });
  const loadOrder = captureLoadOrder(state, gameId);

  checkAbort();
  onProgress?.({ phase: "reading-plugins-txt" });
  const pluginsTxtContent = await readPluginsTxtIfPresent(gameId);

  // ── 3. Build the manifest ──────────────────────────────────────────────
  checkAbort();
  onProgress?.({ phase: "building-manifest" });
  const snapshot = {
    exportedAt: new Date().toISOString(),
    gameId,
    profileId: context.profileId,
    count: mods.length,
    mods,
    deploymentManifests,
    loadOrder,
  };

  const { manifest, warnings: manifestWarnings } = buildManifest({
    snapshot,
    package: {
      id: collectionConfig.packageId,
      name: curator.name,
      version: curator.version,
      author: curator.author,
      description: curator.description.length > 0 ? curator.description : undefined,
      strictMissingMods: false,
    },
    game: {
      version: resolveGameVersion(state, gameId),
    },
    vortex: {
      version: resolveVortexVersion(state),
      deploymentMethod: resolveDeploymentMethod(state, gameId),
    },
    pluginsTxtContent,
    externalMods: toBuildManifestExternalMods(collectionConfig),
    externalDependencies: [],
  });

  // ── 4. Resolve bundled archives ────────────────────────────────────────
  checkAbort();
  onProgress?.({ phase: "resolving-bundled-archives" });
  const { bundledArchives, errors: bundleErrors } = resolveBundledArchives(
    state,
    gameId,
    collectionConfig,
    mods,
  );
  if (bundleErrors.length > 0) {
    throw new BundleResolutionError(bundleErrors);
  }

  // ── 5. Package the .ehcoll ─────────────────────────────────────────────
  checkAbort();
  const outputFileName = buildOutputFileName(curator.name, curator.version);
  const outputPath = path.join(outputDir, outputFileName);
  onProgress?.({ phase: "packaging" });
  const result: PackageEhcollResult = await packageEhcoll({
    manifest,
    bundledArchives,
    readme: overrides.readme.length > 0 ? overrides.readme : undefined,
    changelog: overrides.changelog.length > 0 ? overrides.changelog : undefined,
    outputPath,
  });

  void configPath;
  return {
    outputPath,
    outputBytes: result.outputBytes,
    bundledCount: result.bundledCount,
    modCount: manifest.mods.length,
    warnings: [...manifestWarnings, ...result.warnings],
  };
}

// ===========================================================================
// Validation
// ===========================================================================

export function validateCuratorInput(input: CuratorInput): string | undefined {
  if (input.name.trim().length === 0) return "Collection name cannot be empty.";
  if (input.author.trim().length === 0) return "Author cannot be empty.";
  if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(input.version)) {
    return `Version "${input.version}" doesn't look like semver. Try e.g. "1.0.0" or "0.2.1-beta.1".`;
  }
  return undefined;
}

// ===========================================================================
// Internals
// ===========================================================================

function isNexusMod(mod: AuditorMod): boolean {
  return (
    typeof mod.nexusModId === "number" &&
    typeof mod.nexusFileId === "number" &&
    mod.nexusModId > 0 &&
    mod.nexusFileId > 0
  );
}

function resolveBundledArchives(
  state: types.IState,
  gameId: string,
  config: CollectionConfig,
  mods: AuditorMod[],
): { bundledArchives: BundledArchiveSpec[]; errors: string[] } {
  const errors: string[] = [];
  const bundledArchives: BundledArchiveSpec[] = [];
  const modById = new Map(mods.map((m) => [m.id, m]));

  for (const [modId, entry] of Object.entries(config.externalMods)) {
    if (entry.bundled !== true) continue;

    const mod = modById.get(modId);
    if (mod === undefined) {
      errors.push(
        `Config flags modId "${modId}" as bundled, but no such mod is in the active profile right now. ` +
          `Either install the mod, remove the entry from the config, or set bundled=false.`,
      );
      continue;
    }

    if (isNexusMod(mod)) {
      errors.push(
        `Config flags Nexus mod "${mod.name}" (id="${modId}") as bundled. ` +
          `Only external (non-Nexus) mods can be bundled.`,
      );
      continue;
    }

    if (
      typeof mod.archiveSha256 !== "string" ||
      mod.archiveSha256.length === 0
    ) {
      errors.push(
        `External mod "${mod.name}" is flagged for bundling but has no archiveSha256.`,
      );
      continue;
    }

    const sourcePath = getModArchivePath(state, mod.archiveId, gameId);
    if (sourcePath === undefined) {
      errors.push(
        `External mod "${mod.name}" is flagged for bundling but its source archive cannot be located on disk.`,
      );
      continue;
    }

    bundledArchives.push({
      sourcePath,
      sha256: mod.archiveSha256,
    });
  }

  return { bundledArchives, errors };
}

async function readPluginsTxtIfPresent(
  gameId: string,
): Promise<string | undefined> {
  let pluginsPath: string;
  try {
    pluginsPath = getCurrentPluginsTxtPath(gameId);
  } catch {
    return undefined;
  }
  try {
    return await fsp.readFile(pluginsPath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return undefined;
    throw err;
  }
}

function resolveVortexVersion(state: types.IState): string {
  const app = (state as unknown as { app?: { appVersion?: string; version?: string } }).app;
  return app?.appVersion ?? app?.version ?? "unknown";
}

function resolveGameVersion(state: types.IState, gameId: string): string {
  const persistent = (state as unknown as {
    persistent?: { gameSettings?: Record<string, { version?: string }> };
  }).persistent;
  const fromGameSettings = persistent?.gameSettings?.[gameId]?.version;
  if (typeof fromGameSettings === "string" && fromGameSettings.length > 0) {
    return fromGameSettings;
  }
  const settings = (state as unknown as {
    settings?: { gameMode?: { discovered?: Record<string, { version?: string }> } };
  }).settings;
  const fromDiscovery = settings?.gameMode?.discovered?.[gameId]?.version;
  if (typeof fromDiscovery === "string" && fromDiscovery.length > 0) {
    return fromDiscovery;
  }
  return "unknown";
}

function resolveDeploymentMethod(
  state: types.IState,
  gameId: string,
): VortexDeploymentMethod {
  const settings = (state as unknown as {
    settings?: { mods?: { activator?: Record<string, string> } };
  }).settings;
  const raw = settings?.mods?.activator?.[gameId];
  switch (raw) {
    case "hardlink_activator":
      return "hardlink";
    case "symlink_activator":
    case "symlink_activator_elevate":
      return "symlink";
    case "move_activator":
      return "copy";
    default:
      return "hardlink";
  }
}

function buildOutputFileName(name: string, version: string): string {
  const slug = slugify(name);
  const safeVersion = version.replace(/[^a-zA-Z0-9.-]/g, "-");
  return `${slug}-${safeVersion}.ehcoll`;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "collection"
  );
}

export { slugify };
