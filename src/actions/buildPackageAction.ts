/**
 * Toolbar action: "Build Collection Package" (Phase 2 slice 4a + 4b).
 *
 * Wires the existing snapshot pipeline (state read → mods enrichment →
 * deployment manifests → load order → plugins.txt) into the new packager
 * (`buildManifest` → `packageEhcoll`) and produces one `.ehcoll` file
 * inside `%APPDATA%\Vortex\event-horizon\collections\`.
 *
 * Spec: docs/business/BUILD_PACKAGE.md
 *
 * ─── TRANSITIONAL UI WARNING ──────────────────────────────────────────
 * Everything in this file that touches `showDialog`, `sendNotification`,
 * or "the toolbar button" is scaffolding. Phase 5 introduces a dedicated
 * Event Horizon `mainPage` (custom React UI) that replaces this entire
 * dialog flow. The *business logic* (the call sequence below — state
 * read, pipeline run, buildManifest, packageEhcoll) is permanent.
 *
 * Design rule when extending this file: any new piece of curator input
 * must be a JSON-serializable record on the `BuildManifestInput` /
 * config-file side. Phase 5's React forms produce exactly that shape
 * and feed the same functions, so the core stays UI-agnostic.
 * See docs/PROPOSAL_INSTALLER.md §10 "Transitional UI vs Phase 5 UI".
 * ──────────────────────────────────────────────────────────────────────
 *
 * Slice 4a (done): one dialog asks for name/version/author/description.
 *
 * Slice 4b (this file's current shape):
 *   - Per-collection state file at
 *     `<appData>\Vortex\event-horizon\collections\.config\<slug>.json`
 *     persists package.id (UUIDv4, stable across rebuilds), per-mod
 *     overrides (`bundled`, `instructions`, `name` hint), and optional
 *     README / CHANGELOG markdown bodies.
 *   - Action loads-or-creates the file every build. Renaming the
 *     collection produces a new slug ⇒ new file ⇒ new release lineage.
 *   - Reconciliation auto-populates stub entries for any external mod
 *     present in the current snapshot but missing from the config, so
 *     the curator sees a fully-populated file the next time they
 *     hand-edit it.
 *   - For each external mod the curator flags `bundled: true`, the
 *     action resolves the source archive on disk via `getModArchivePath`
 *     and feeds it to `packageEhcoll` as a `BundledArchiveSpec`.
 *
 * Phase 5 (future React page) replaces:
 *   - The curator metadata `showDialog` → form on the build panel.
 *   - "Hand-edit the JSON file" → a per-mod table with checkboxes /
 *     textareas writing the same JSON shape via `saveCollectionConfig`.
 *   - README / CHANGELOG markdown → rich editors writing the same fields.
 */

import * as fsp from "fs/promises";
import * as path from "path";
import { util } from "vortex-api";
import type { types } from "vortex-api";

import {
  enrichModsWithArchiveHashes,
  getModArchivePath,
} from "../core/archiveHashing";
import { captureDeploymentManifests } from "../core/deploymentManifest";
import type { AuditorMod } from "../core/getModsListForProfile";
import {
  getActiveGameId,
  getActiveProfileIdFromState,
  getModsForProfile,
} from "../core/getModsListForProfile";
import { captureLoadOrder } from "../core/loadOrder";
import { getCurrentPluginsTxtPath } from "../core/comparePlugins";
import {
  buildManifest,
  BuildManifestError,
} from "../core/manifest/buildManifest";
import {
  packageEhcoll,
  PackageEhcollError,
  type BundledArchiveSpec,
} from "../core/manifest/packageZip";
import {
  CollectionConfigError,
  loadOrCreateCollectionConfig,
  reconcileExternalModsConfig,
  saveCollectionConfig,
  toBuildManifestExternalMods,
  type CollectionConfig,
} from "../core/manifest/collectionConfig";
import type {
  SupportedGameId,
  VortexDeploymentMethod,
} from "../types/ehcoll";
import { openFile, openFolder } from "../utils/utils";

const SUPPORTED_GAME_IDS: ReadonlySet<string> = new Set<SupportedGameId>([
  "skyrimse",
  "fallout3",
  "falloutnv",
  "fallout4",
  "starfield",
]);

type CuratorInput = {
  name: string;
  version: string;
  author: string;
  description: string;
};

export default function createBuildPackageAction(
  context: types.IExtensionContext,
): () => Promise<void> {
  return async () => {
    const hashingNotificationId = "vortex-event-horizon:hashing";
    let hashingNotificationShown = false;

    try {
      const state = context.api.getState();

      const gameId = getActiveGameId(state);
      if (!gameId) throw new Error("No active game found");

      if (!SUPPORTED_GAME_IDS.has(gameId)) {
        throw new Error(
          `Game "${gameId}" is not supported by Event Horizon. Supported: ${Array.from(
            SUPPORTED_GAME_IDS,
          ).join(", ")}.`,
        );
      }

      const profileId = getActiveProfileIdFromState(state, gameId);
      if (!profileId) throw new Error(`No profile found for game ${gameId}`);

      const curator = await promptCuratorMetadata(context.api);
      if (curator === undefined) {
        // Curator hit Cancel. Silent exit, no error notification.
        return;
      }

      const rawMods = getModsForProfile(state, gameId, profileId);

      context.api.sendNotification?.({
        id: hashingNotificationId,
        type: "activity",
        message: `Hashing ${rawMods.length} mod archives...`,
      });
      hashingNotificationShown = true;

      const mods = await enrichModsWithArchiveHashes(
        state,
        gameId,
        rawMods,
        { concurrency: 4 },
      );

      context.api.dismissNotification?.(hashingNotificationId);
      hashingNotificationShown = false;

      const deploymentManifests = await captureDeploymentManifests(
        context.api,
        state,
        gameId,
      );

      const loadOrder = captureLoadOrder(state, gameId);

      const pluginsTxtContent = await readPluginsTxtIfPresent(gameId);

      // ── Slice 4b: load/create per-collection state file ────────────────
      // Lives at <appData>\Vortex\event-horizon\collections\.config\<slug>.json
      // and persists package.id, per-mod overrides, README, CHANGELOG.
      // First build of a slug = fresh UUID + empty externalMods. Subsequent
      // builds reuse the same id, preserving release lineage.
      const slug = slugify(curator.name);
      const appDataPath = util.getVortexPath("appData");
      const outputDir = path.join(
        appDataPath,
        "event-horizon",
        "collections",
      );
      const configDir = path.join(outputDir, ".config");

      const loaded = await loadOrCreateCollectionConfig({ configDir, slug });
      let collectionConfig = loaded.config;

      // Auto-populate stub entries for any external mods present in the
      // current snapshot but missing from the config. Curators see a
      // pre-filled file the next time they hand-edit it.
      const externalAuditorMods = collectExternalMods(mods);
      const reconciled = reconcileExternalModsConfig({
        config: collectionConfig,
        externalMods: externalAuditorMods,
      });
      if (reconciled.changed) {
        collectionConfig = reconciled.config;
        await saveCollectionConfig({
          configDir,
          slug,
          config: collectionConfig,
        });
      }

      const snapshot = {
        exportedAt: new Date().toISOString(),
        gameId,
        profileId,
        count: mods.length,
        mods,
        deploymentManifests,
        loadOrder,
      };

      const { manifest, warnings } = buildManifest({
        snapshot,
        package: {
          id: collectionConfig.packageId,
          name: curator.name,
          version: curator.version,
          author: curator.author,
          description:
            curator.description.length > 0 ? curator.description : undefined,
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

      const outputFileName = buildOutputFileName(curator.name, curator.version);
      const outputPath = path.join(outputDir, outputFileName);

      // Resolve source paths for any externals the curator flagged as
      // bundled. Mismatches (mod not in snapshot, missing archive,
      // missing hash) are accumulated as fatal errors and reported as
      // one error notification — the curator gets the full list.
      const { bundledArchives, errors: bundleErrors } =
        resolveBundledArchives(state, gameId, collectionConfig, mods);
      if (bundleErrors.length > 0) {
        throw new BundleResolutionError(bundleErrors);
      }

      const result = await packageEhcoll({
        manifest,
        bundledArchives,
        readme:
          collectionConfig.readme && collectionConfig.readme.length > 0
            ? collectionConfig.readme
            : undefined,
        changelog:
          collectionConfig.changelog && collectionConfig.changelog.length > 0
            ? collectionConfig.changelog
            : undefined,
        outputPath,
      });

      console.log(
        `[Vortex Event Horizon] Built collection package | ${curator.name} v${curator.version} | ` +
          `mods=${manifest.mods.length} | rules=${manifest.rules.length} | ` +
          `fileOverrides=${manifest.fileOverrides.length} | plugins=${manifest.plugins.order.length} | ` +
          `loadOrder=${manifest.loadOrder.length} | ` +
          `bundled=${result.bundledCount} | bytes=${result.outputBytes} | ` +
          `warnings=${warnings.length + result.warnings.length} | ` +
          `configFile=${loaded.configPath}${loaded.created ? " (NEW)" : ""}`,
      );

      for (const warning of [...warnings, ...result.warnings]) {
        console.warn(`[Vortex Event Horizon] ${warning}`);
      }

      const bundledLabel =
        result.bundledCount > 0
          ? `, ${result.bundledCount} bundled`
          : "";
      context.api.sendNotification?.({
        type: "success",
        message:
          `Built ${curator.name} v${curator.version} ` +
          `(${manifest.mods.length} mods${bundledLabel}, ${formatBytes(
            result.outputBytes,
          )})`,
        actions: [
          {
            title: "Open Package",
            action: () => openFile(outputPath),
          },
          {
            title: "Open Folder",
            action: () => openFolder(outputDir),
          },
          {
            title: "Open Config",
            action: () => openFile(loaded.configPath),
          },
        ],
      });
    } catch (error) {
      const message = formatError(error);

      context.api.sendNotification?.({
        type: "error",
        message: `Build failed: ${message}`,
      });

      console.error("[Vortex Event Horizon] Build failed:", error);
    } finally {
      if (hashingNotificationShown) {
        context.api.dismissNotification?.(hashingNotificationId);
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Curator metadata dialog
// ---------------------------------------------------------------------------

async function promptCuratorMetadata(
  api: types.IExtensionApi,
): Promise<CuratorInput | undefined> {
  // Vortex's IDialogResult.input is `any` in the typings; in practice
  // it's a record keyed by IInput.id.
  type DialogInputRecord = Record<string, string | undefined>;

  // Collect everything in one shot. The dialog renders one input per
  // entry; the curator hits Build, we validate. Validation failures
  // re-prompt with the previous values pre-filled so the curator
  // doesn't lose typing.
  let preset: CuratorInput = {
    name: "",
    version: "1.0.0",
    author: "",
    description: "",
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await api.showDialog?.(
      "question",
      "Build Event Horizon Collection",
      {
        text:
          "Fill in the metadata that ships in the .ehcoll manifest. " +
          "Per-mod settings (bundling external archives, instructions) " +
          "and README/CHANGELOG inputs come in a later release; for now, " +
          "external mods will default to instructions-only.",
        input: [
          {
            id: "name",
            type: "text",
            label: "Collection name",
            value: preset.name,
            placeholder: "My Awesome Skyrim Build",
          },
          {
            id: "version",
            type: "text",
            label: "Version (semver)",
            value: preset.version,
            placeholder: "1.0.0",
          },
          {
            id: "author",
            type: "text",
            label: "Author",
            value: preset.author,
            placeholder: "Your Nexus username",
          },
          {
            id: "description",
            type: "multiline",
            label: "Description (optional)",
            value: preset.description,
            placeholder: "What this collection ships, who it's for, ...",
          },
        ],
      },
      [
        { label: "Cancel" },
        { label: "Build", default: true },
      ],
    );

    if (!result || result.action !== "Build") {
      return undefined;
    }

    const inputs = (result.input ?? {}) as DialogInputRecord;
    const candidate: CuratorInput = {
      name: (inputs.name ?? "").trim(),
      version: (inputs.version ?? "").trim(),
      author: (inputs.author ?? "").trim(),
      description: (inputs.description ?? "").trim(),
    };

    const validationError = validateCuratorInput(candidate);
    if (validationError === undefined) {
      return candidate;
    }

    preset = candidate;

    await api.showDialog?.(
      "error",
      "Invalid input",
      { text: validationError },
      [{ label: "Back", default: true }],
    );
  }
}

function validateCuratorInput(input: CuratorInput): string | undefined {
  if (input.name.length === 0) return "Collection name cannot be empty.";
  if (input.author.length === 0) return "Author cannot be empty.";

  // Lightweight semver check — three numeric segments separated by dots,
  // optionally followed by `-prerelease`. Strict semver validation lives
  // in the manifest consumer; we just want to catch obvious typos here.
  if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(input.version)) {
    return `Version "${input.version}" doesn't look like semver. Try e.g. "1.0.0" or "0.2.1-beta.1".`;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

function resolveVortexVersion(state: types.IState): string {
  const app = (state as unknown as { app?: { appVersion?: string; version?: string } }).app;
  return app?.appVersion ?? app?.version ?? "unknown";
}

/**
 * Best-effort game version. Vortex doesn't always populate this — the
 * value lives under different state keys depending on how the game was
 * discovered. Slice 4b will plumb a real per-game version resolver;
 * for now "unknown" is a valid (per-schema) fallback string.
 */
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

/**
 * Look up the per-game deployment method from settings. Defaults to
 * `"hardlink"` — it's the Vortex default on supported games and the
 * value is informational (the user-side installer respects whatever
 * the user has configured locally).
 */
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
      // Closest match in our enum — `move` is a deploy strategy that
      // physically moves files into the game dir. The schema only
      // distinguishes hardlink/symlink/copy; "copy" is the safest read.
      return "copy";
    default:
      return "hardlink";
  }
}

// ---------------------------------------------------------------------------
// plugins.txt
// ---------------------------------------------------------------------------

async function readPluginsTxtIfPresent(
  gameId: string,
): Promise<string | undefined> {
  let pluginsPath: string;
  try {
    pluginsPath = getCurrentPluginsTxtPath(gameId);
  } catch {
    // Game doesn't have a plugins.txt path mapping (e.g. starfield handled
    // via LoadOrder API). buildManifest will emit plugins.order: [].
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

// ---------------------------------------------------------------------------
// Output filename
// ---------------------------------------------------------------------------

function buildOutputFileName(name: string, version: string): string {
  const slug = slugify(name);
  const safeVersion = version.replace(/[^a-zA-Z0-9.-]/g, "-");
  return `${slug}-${safeVersion}.ehcoll`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "collection";
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// External-mod bundling (slice 4b)
// ---------------------------------------------------------------------------

class BundleResolutionError extends Error {
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

/**
 * Filter the snapshot's mods down to those buildManifest will treat
 * as external — i.e. mods without `nexusModId` + `nexusFileId`. Used
 * to reconcile the per-collection config file with what's actually
 * in the active profile right now.
 */
function collectExternalMods(
  mods: AuditorMod[],
): Array<{ id: string; name: string }> {
  return mods
    .filter((mod) => !isNexusMod(mod))
    .map((mod) => ({ id: mod.id, name: mod.name }));
}

function isNexusMod(mod: AuditorMod): boolean {
  return (
    typeof mod.nexusModId === "number" &&
    typeof mod.nexusFileId === "number" &&
    mod.nexusModId > 0 &&
    mod.nexusFileId > 0
  );
}

/**
 * Walk the curator's per-mod overrides; for each entry flagged
 * `bundled: true`, resolve the source archive on disk so 7z can pick
 * it up. Per-mod failures are accumulated rather than throwing
 * eagerly — curators get one report covering every problem.
 */
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
          `Only external (non-Nexus) mods can be bundled — Nexus mods are auto-downloaded from the user's API key. ` +
          `Set bundled=false for this entry.`,
      );
      continue;
    }

    if (
      typeof mod.archiveSha256 !== "string" ||
      mod.archiveSha256.length === 0
    ) {
      errors.push(
        `External mod "${mod.name}" (id="${modId}") is flagged for bundling but has no archiveSha256. ` +
          `Re-export the snapshot or check the archive is on disk; the export pipeline should have hashed it.`,
      );
      continue;
    }

    const sourcePath = getModArchivePath(state, mod.archiveId, gameId);
    if (sourcePath === undefined) {
      errors.push(
        `External mod "${mod.name}" (id="${modId}") is flagged for bundling but its source archive ` +
          `cannot be located on disk (archiveId="${mod.archiveId ?? "<unset>"}"). ` +
          `The archive may have been deleted from the Vortex downloads folder.`,
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

function formatError(err: unknown): string {
  if (err instanceof BuildManifestError) {
    return `Manifest build failed (${err.errors.length} problem${
      err.errors.length === 1 ? "" : "s"
    }):\n${err.errors.map((e) => `  - ${e}`).join("\n")}`;
  }
  if (err instanceof PackageEhcollError) {
    return `Package build failed (${err.errors.length} problem${
      err.errors.length === 1 ? "" : "s"
    }):\n${err.errors.map((e) => `  - ${e}`).join("\n")}`;
  }
  if (err instanceof BundleResolutionError) {
    return `Bundled-archive resolution failed (${err.errors.length} problem${
      err.errors.length === 1 ? "" : "s"
    }):\n${err.errors.map((e) => `  - ${e}`).join("\n")}`;
  }
  if (err instanceof CollectionConfigError) {
    return `Collection config invalid (${err.errors.length} problem${
      err.errors.length === 1 ? "" : "s"
    }):\n${err.errors.map((e) => `  - ${e}`).join("\n")}`;
  }
  return err instanceof Error ? err.message : String(err);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
