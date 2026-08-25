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
import { util } from "@nexusmods/vortex-api";
import type { types } from "@nexusmods/vortex-api";

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
import { captureUserlist } from "../../../core/userlist";
import { getCurrentPluginsTxtPath } from "../../../core/comparePlugins";
import { buildManifest } from "../../../core/manifest/buildManifest";
import { captureStagingFiles } from "../../../core/manifest/captureStagingFiles";
import { runSelfChecks } from "../../../core/manifest/runSelfChecks";
import {
  describeHashedCollisions,
  describeScope,
  findHashedIdentityCollisions,
  scopeCollectionMods,
} from "../../../core/manifest/collectionScope";
import { findModsWithNoArchivePath } from "../../../core/archiveRecovery";
import {
  applyCachedHashes,
  loadArchiveHashCache,
  makeHashLookup,
  mergeHashes,
  saveArchiveHashCache,
} from "../../../core/archiveHashCache";
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
import { getVortexUserDataPath } from "../../../core/paths";
import { beginOp } from "../../../core/logging/ehLog";
import type {
  SupportedGameId,
  VerificationLevel,
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
   * Notes about what was left out or looks wrong in the profile itself —
   * duplicate identities, several enabled installs of one mod. Produced by
   * {@link scopeCollectionMods}; empty on a tidy profile.
   */
  scopeWarnings: string[];
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
  | "inspecting-mods"
  | "capturing-deployment"
  | "capturing-load-order"
  | "capturing-userlist"
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
  /**
   * Counts of curator-authored rules + ordering surfaces baked into
   * the manifest. Surfaced in the build Done card so the curator
   * gets immediate feedback that their LOOT userlist + mod rules
   * + load order made it into the package — without these the
   * curator has to test on a fresh machine to verify round-trip.
   *
   * Read directly from `EhcollManifest` after `buildManifest`
   * returns; no separate computation. `pluginOrderCount` is the
   * `plugins.txt` baseline; `userlistPluginCount` and
   * `userlistGroupCount` are LOOT userlist scope.
   */
  ruleCount: number;
  loadOrderCount: number;
  pluginOrderCount: number;
  userlistPluginCount: number;
  userlistGroupCount: number;
  /**
   * What integrity level the build captured per mod. Surfaced in the
   * Done card so the curator can confirm "yes, my package will let
   * users detect Vortex's lost-file bug" or "I picked fast for speed
   * and accept the trade-off".
   */
  verificationLevel: VerificationLevel;
  /**
   * Total number of `stagingFiles` entries across all mods. Useful as
   * a "this build inspected N files" sanity check; zero when
   * verificationLevel is `"none"`.
   */
  stagingFileCount: number;
}

export interface BuildOverrides {
  /** modId → override to apply on top of the existing config entry. */
  externalMods: Record<string, ExternalModConfigEntry>;
  readme: string;
  changelog: string;
  /**
   * @deprecated Ignored. Every build verifies at `"thorough"`.
   *
   * It was a choice, and the choice was a trap: `"fast"` records paths and
   * sizes only, and `computeStagingSetHash` needs a sha256 on EVERY file — so
   * an external mod with no archive had no identity and could not be packaged
   * at all. `"none"` shipped a collection with no integrity data. Kept on the
   * type so existing drafts and saved configs still parse.
   */
  verificationLevel?: VerificationLevel;
  /**
   * Read every staged file again, ignoring cached hashes.
   *
   * Hashes are normally reused while a file's path, size and mtime all match,
   * which is what makes verifying 205GB affordable on every build. The one
   * thing that fingerprint cannot see is bytes rewritten IN PLACE without
   * changing either — disk rot rather than anything Vortex does. This forces
   * the full read for when the curator wants that guarantee rather than the
   * fast answer.
   */
  reverifyEverything?: boolean;
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
  const op = beginOp("build.load-context");
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

  // Vortex's staging folder is not the profile, and the profile is not the
  // collection: a profile IS its enabled mods, so anything switched off is not
  // being shipped. Scoping here rather than later means the disabled ones are
  // never hashed, walked or verified — and it removes duplicate-identity
  // collisions for free, because the superseded copy is the disabled one.
  const profileMods = getModsForProfile(state, gameId, profileId);
  const scope = scopeCollectionMods(profileMods);
  const rawMods = scope.included;
  op.step("mods-scoped", {
    inProfile: profileMods.length,
    enabled: rawMods.length,
    excludedDisabled: scope.excludedDisabled.length,
    collidingIdentities: scope.collidingIdentities.length,
    multipleEnabledInstalls: scope.multipleInstalls.length,
    ...(scope.multipleInstalls.length > 0
      ? {
          multipleInstallDetail: scope.multipleInstalls.slice(0, 25).map((g) => ({
            key: g.key,
            mods: g.mods.map((m) => `${m.name} (${m.version ?? "?"})`),
          })),
        }
      : {}),
  });

  // Costs nothing — pure state — and it answers in one second the question
  // that otherwise costs 15 minutes of hashing, or 45 minutes and a rejected
  // manifest: are the source archives even still there?
  const noArchivePath = findModsWithNoArchivePath(state, gameId, rawMods);
  if (noArchivePath.length > 0) {
    const fetchable = noArchivePath.filter(
      (m) => m.nexusModId !== undefined && m.nexusFileId !== undefined,
    ).length;
    op.step("archives-missing", {
      mods: noArchivePath.length,
      recoverableFromNexus: fetchable,
      noNexusSource: noArchivePath.length - fetchable,
      example: noArchivePath[0]?.name,
    });
  }

  onProgress?.({
    phase: "hashing-mods",
    message: `Hashing ${rawMods.length} mod archives...`,
    done: 0,
    total: rawMods.length,
  });
  op.step("hashing-start", { archives: rawMods.length });
  // Hashing ~900 archives is minutes of disk-bound work, and until this logged
  // anything the operation looked indistinguishable from a hang: `.start` with
  // no `.ok` and nothing in between. Throttled so a large profile adds a
  // bounded number of lines rather than one per mod.
  const hashLogEvery = Math.max(25, Math.ceil(rawMods.length / 20));
  let lastLogged = 0;
  const hashStartedAt = Date.now();
  const ehDir = path.join(getVortexUserDataPath(), "event-horizon");
  const hashCache = await loadArchiveHashCache(ehDir);
  const hashReuse = makeHashLookup(hashCache);
  const { lookup, added } = hashReuse;

  let mods = await enrichModsWithArchiveHashes(state, gameId, rawMods, {
    hashCache: lookup,
    concurrency: 4,
    signal,
    onProgress: (done, total, mod) => {
      if (done - lastLogged >= hashLogEvery || done === total) {
        lastLogged = done;
        const elapsed = Date.now() - hashStartedAt;
        op.step("hashing-progress", {
          done,
          total,
          ms: elapsed,
          // Rough remaining estimate, so a slow run can be told apart from a
          // stalled one without waiting for it to finish.
          etaMs: done > 0 ? Math.round((elapsed / done) * (total - done)) : undefined,
        });
      }
      onProgress?.({
        phase: "hashing-mods",
        message: `Hashing mod archives (${done} / ${total})...`,
        done,
        total,
        currentItem: mod.name,
      });
    },
  });
  op.step("hashing-done", {
    ms: Date.now() - hashStartedAt,
    // COUNTED, not inferred. This was first written as
    // `rawMods.length - added.size`, which reports "955 reused, 0 hashed" when
    // the cache is not consulted at all — the exact opposite of the truth, next
    // to an `ms` of seventeen minutes. A metric that cannot distinguish "it
    // worked" from "it never ran" is worse than no metric.
    reusedFromCache: hashReuse.hits,
    freshlyHashed: added.size,
    hashedArchives: rawMods.length,
  });

  // Persist what was computed, so the next build reuses it. Failure here costs
  // a repeat of the hashing pass, never the build itself.
  if (added.size > 0) {
    try {
      await saveArchiveHashCache(
        ehDir,
        mergeHashes(hashCache, added, new Date().toISOString()),
      );
    } catch (err) {
      op.step("hash-cache-write-failed", { err: String(err) });
    }
  }

  // Fill gaps left by archives Vortex no longer has, from hashes recovered on a
  // previous run. Applied AFTER hashing on purpose: anything hashed from a real
  // file this run keeps that value, so a stale cache entry can never contradict
  // bytes on disk.
  const cached = applyCachedHashes(mods, hashCache);
  mods = cached.mods;
  if (cached.filled > 0) {
    op.step("hashes-from-cache", {
      filled: cached.filled,
      cacheEntries: Object.keys(hashCache.entries).length,
    });
  }

  // What will ACTUALLY stop the manifest, now that both the disk and the cache
  // have had their say. The pre-hash probe above is an early estimate for the
  // log; this is the number the curator is told, and it is the one that shrinks
  // when archives are recovered.
  const unidentified = mods.filter((m) => m.archiveSha256 === undefined);

  // Two external mods can be separate downloads of byte-identical archives, so
  // they only collide once a hash exists. buildManifest catches it, but not
  // until after the staging pass — 31 minutes later on this profile.
  const hashedCollisions = findHashedIdentityCollisions(mods);
  if (hashedCollisions.length > 0) {
    op.step("identity-collisions", {
      groups: hashedCollisions.length,
      detail: hashedCollisions.slice(0, 10).map((g) => ({
        key: g.key,
        mods: g.mods.map((m) => m.name),
      })),
    });
  }

  const externalMods = mods.filter((m) => !isNexusMod(m));

  const defaultName = opts?.nameOverride ?? "My Collection";
  const slug = slugify(defaultName);
  const appDataPath = getVortexUserDataPath();
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

  op.ok({
    gameId,
    profileId,
    mods: mods.length,
    excludedDisabled: scope.excludedDisabled.length,
    externalMods: externalMods.length,
    // hashed < mods is the first number to look at when a build does not
    // reproduce: an unhashed external archive has no stable identity.
    hashed: mods.filter((m) => m.archiveSha256 !== undefined).length,
  });

  return {
    gameId: gameId as SupportedGameId,
    profileId,
    mods,
    scopeWarnings: [
      ...describeScope(scope),
      ...describeHashedCollisions(hashedCollisions),
      ...describeMissingArchives(unidentified),
    ],
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
 * Tell the curator what a missing archive costs them, once, with a number —
 * rather than as N identical manifest errors after the build has run.
 */
export function describeMissingArchives(missing: AuditorMod[]): string[] {
  if (missing.length === 0) return [];
  const fetchable = missing.filter(
    (m) => m.nexusModId !== undefined && m.nexusFileId !== undefined,
  ).length;
  const n = missing.length;
  const noun = `mod${n === 1 ? "" : "s"}`;

  // When NONE can be fetched, saying it twice — "6 have no archive" then "6
  // have no Nexus source" — reads like twelve mods. One sentence, one number.
  if (fetchable === 0) {
    return [
      `${n} ${noun} have no source archive in Vortex's download cache and no ` +
        `Nexus source to fetch one from. Build at verification level ` +
        `"thorough" to identify them from their deployed files instead, or ` +
        `re-import their archives by hand. At "fast" they cannot be packaged.`,
    ];
  }

  const lines = [
    `${n} ${noun} have no source archive in Vortex's download cache. A mod's ` +
      `identity is the hash of its archive, so these cannot be packaged until ` +
      `the archives are back.`,
  ];
  lines.push(
    `${fetchable} can be fetched automatically — Event Horizon downloads the ` +
      `archive only, and never re-installs the mod.`,
  );
  if (fetchable < n) {
    lines.push(
      `The other ${n - fetchable} have no Nexus source: build at verification ` +
        `level "thorough" to identify them from their deployed files, or ` +
        `re-import their archives by hand.`,
    );
  }
  return lines;
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
  const op = beginOp("build.pipeline", {
    gameId: context.gameId,
    name: curator.name,
    version: curator.version,
    mods: context.mods.length,
  });
  const onProgress = opts?.onProgress;
  const signal = opts?.signal;
  const checkAbort = (): void => {
    if (signal?.aborted) {
      throw new AbortError("Build cancelled by user");
    }
  };

  checkAbort();
  const state = api.getState();
  const { gameId } = context;
  let mods = context.mods;

  // ── 1. Apply form overrides on top of the loaded config ────────────────
  const slug = slugify(curator.name);
  const appDataPath = getVortexUserDataPath();
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
  // ── 2a. Inspect curator staging folders (file-integrity capture) ──────
  // Walks `<install-path>/<mod.installationPath>` for each mod and
  // records `{path, size, sha256?}` into `mod.stagingFiles`. The
  // user-side `verifyModInstall` check uses this to detect Vortex's
  // "lost file" bug after a mod install completes.
  //
  // `level === "none"` skips the walk entirely (no allocations, no
  // I/O); chosen by the curator when they want fast builds and
  // accept losing the post-install integrity check.
  // ALWAYS thorough. The level used to be the curator's choice, and the choice
  // was a trap: `fast` records paths and sizes only, and `computeStagingSetHash`
  // needs a sha256 on every file — so an external mod with no archive had no
  // identity at all and simply could not be packaged. "Skip" shipped a
  // collection with no integrity data, which is the one thing this tool exists
  // to provide. What made thorough expensive was re-reading 205GB on every
  // build; the hash cache removes that, so there is nothing left to trade.
  const verificationLevel: VerificationLevel = "thorough";
  {
    checkAbort();
    onProgress?.({
      phase: "inspecting-mods",
      message: `Inspecting ${mods.length} mod folders (${verificationLevel})...`,
      done: 0,
      total: mods.length,
    });
    // 205GB of staging across 993 folders at `thorough` took 34 minutes with
    // NOT ONE log line — the same "cannot tell slow from hung" hole that was
    // fixed for archive hashing and left open on the larger pass. Throttled to
    // ~20 lines regardless of profile size, with an ETA from the observed rate.
    const stagingOp = beginOp("build.staging-capture", {
      mods: mods.length,
      level: verificationLevel,
    });
    const stagingLogEvery = Math.max(25, Math.ceil(mods.length / 20));
    let stagingLogged = 0;
    const stagingStartedAt = Date.now();

    // Re-verification deliberately passes NO cache, so every byte is read
    // again. That is the escape hatch for the one thing a fingerprint cannot
    // see: bytes rewritten in place without changing size or mtime.
    const stagingDir = path.join(getVortexUserDataPath(), "event-horizon");
    const stagingCache =
      overrides.reverifyEverything === true
        ? undefined
        : await loadArchiveHashCache(stagingDir);
    const stagingReuse =
      stagingCache !== undefined ? makeHashLookup(stagingCache) : undefined;

    mods = await captureStagingFiles(state, gameId, mods, {
      level: verificationLevel,
      signal,
      ...(stagingReuse !== undefined ? { hashCache: stagingReuse.lookup } : {}),
      onProgress: (done, total, mod) => {
        if (done - stagingLogged >= stagingLogEvery || done === total) {
          stagingLogged = done;
          const elapsed = Date.now() - stagingStartedAt;
          stagingOp.step("progress", {
            done,
            total,
            ms: elapsed,
            etaMs: done > 0 ? Math.round((elapsed / done) * (total - done)) : undefined,
          });
        }
        onProgress?.({
          phase: "inspecting-mods",
          message:
            verificationLevel === "thorough"
              ? `Hashing files in mod folders (${done} / ${total})...`
              : `Inspecting mod folders (${done} / ${total})...`,
          done,
          total,
          currentItem: mod.name,
        });
      },
      onWarn: (mod, message) => {
        console.warn(`[event-horizon] inspect ${mod.name}: ${message}`);
      },
    });
    // `stagingFiles` populated here is what buildManifest turns into
    // stagingSetHash and what the self-check compares against, so an empty
    // count is the thing to notice — it silently disables both.
    if (
      stagingReuse !== undefined &&
      stagingCache !== undefined &&
      stagingReuse.added.size > 0
    ) {
      try {
        await saveArchiveHashCache(
          stagingDir,
          mergeHashes(stagingCache, stagingReuse.added, new Date().toISOString()),
        );
      } catch (err) {
        stagingOp.step("cache-write-failed", { err: String(err) });
      }
    }

    const withStaging = mods.filter((m) => (m.stagingFiles?.length ?? 0) > 0).length;
    stagingOp.ok({
      mods: mods.length,
      withStagingFiles: withStaging,
      withoutStagingFiles: mods.length - withStaging,
      // Counted, not inferred — see the archive pass for why that matters.
      filesReusedFromCache: stagingReuse?.hits ?? 0,
      filesFreshlyHashed: stagingReuse?.added.size ?? 0,
      reverified: overrides.reverifyEverything === true,
    });
  }

  checkAbort();

  // ── Self-check: is the CURATOR'S OWN staging what it should be? ──────
  // Everything downstream treats this capture as the etalon, so if Vortex lost
  // files during the curator's install the omission is baked into the
  // collection and every user reproduces it. Checked here, against references
  // the curator's disk cannot contaminate: the archive header and the FOMOD
  // script. Advisory only — it never fails a build.
  onProgress?.({
    phase: "inspecting-mods",
    message: "Checking mods against their archives...",
    done: 0,
    total: mods.length,
  });
  const selfCheckOp = beginOp("build.self-check", { mods: mods.length });
  let selfCheckWarnings: string[] = [];
  try {
    const selfCheck = await runSelfChecks(state, gameId, mods, {
      ...(signal !== undefined ? { signal } : {}),
      onProgress: (done, total, modName) => {
        onProgress?.({
          phase: "inspecting-mods",
          message: `Checking mods against their archives (${done} / ${total})...`,
          done,
          total,
          currentItem: modName,
        });
      },
    });
    selfCheckWarnings = selfCheck.warnings;
    selfCheckOp.ok({
      replayed: selfCheck.summary.replayed,
      containment: selfCheck.summary.containment,
      skipped: selfCheck.summary.skipped,
      modsWithMissing: selfCheck.summary.modsWithMissing,
      missingFiles: selfCheck.summary.missingFiles,
    });
  } catch (err) {
    // A self-check problem is never a build problem.
    selfCheckOp.fail(err);
  }

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
  onProgress?.({ phase: "capturing-userlist" });
  const userlist = captureUserlist(state);

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
    userlist,
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
      verificationLevel,
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
    signal,
  });

  // ── 6. Stamp the config with last-built metadata ───────────────────────
  // Drives the curator dashboard's "Published" tab — `lastBuiltVersion`
  // shows what was last shipped, `lastBuiltAt` lets the dashboard sort
  // by recency. We persist AFTER the package is on disk so a failed
  // package doesn't poison the recorded version with a build that
  // never made it out.
  //
  // Best-effort: a failure here doesn't fail the build (the package
  // exists, the curator is happy). We log + continue.
  try {
    collectionConfig = {
      ...collectionConfig,
      lastBuiltVersion: curator.version,
      lastBuiltAt: new Date().toISOString(),
      lastBuiltName: curator.name,
      // Pin the gameId at build time so the dashboard's "Update"
      // affordance can refuse cross-game updates (which would
      // silently rewrite the manifest's gameId and ship a malformed
      // package). Older configs may lack this field; the dashboard
      // treats missing as "unknown game" and shows the entry but
      // cannot enforce the gate.
      gameId,
    };
    await saveCollectionConfig({ configDir, slug, config: collectionConfig });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[Event Horizon] failed to stamp last-built metadata on ${configPath}:`,
      err,
    );
  }

  let stagingFileCount = 0;
  for (const m of manifest.mods) {
    stagingFileCount += m.state.stagingFiles?.length ?? 0;
  }

  op.ok({
    outputPath,
    outputBytes: result.outputBytes,
    bundled: result.bundledCount,
    mods: manifest.mods.length,
    rules: manifest.rules.length,
    fileOverrides: manifest.fileOverrides.length,
    plugins: manifest.plugins.order.length,
    loadOrder: manifest.loadOrder.length,
    userlistPlugins: manifest.userlist.plugins.length,
    userlistGroups: manifest.userlist.groups.length,
    stagingFiles: stagingFileCount,
    warnings: [
      ...context.scopeWarnings,
      ...manifestWarnings,
      ...result.warnings,
      ...selfCheckWarnings,
    ],
  });

  return {
    outputPath,
    outputBytes: result.outputBytes,
    bundledCount: result.bundledCount,
    modCount: manifest.mods.length,
    warnings: [
      ...context.scopeWarnings,
      ...manifestWarnings,
      ...result.warnings,
      ...selfCheckWarnings,
    ],
    ruleCount: manifest.rules.length,
    loadOrderCount: manifest.loadOrder.length,
    pluginOrderCount: manifest.plugins.order.length,
    userlistPluginCount: manifest.userlist.plugins.length,
    userlistGroupCount: manifest.userlist.groups.length,
    verificationLevel,
    stagingFileCount,
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
