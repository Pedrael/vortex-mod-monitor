/**
 * Snapshot → `.ehcoll` manifest converter (Phase 2 slice 2).
 *
 * Pure transform: takes a curator-side `ExportedModsSnapshot` plus
 * environmental inputs (game/vortex versions, plugins.txt contents, etc.)
 * and produces a fully-typed {@link EhcollManifest}. No I/O, no state
 * access — that lives in the toolbar action (slice 4).
 *
 * Spec: docs/business/BUILD_MANIFEST.md
 * Schema: src/types/ehcoll.ts + docs/business/MANIFEST_SCHEMA.md
 *
 * Errors:
 *  - Fatal validation problems (unknown gameId, missing archive hashes,
 *    duplicate compareKeys, ...) are collected and thrown as a single
 *    {@link BuildManifestError}. The packager UI can show all problems
 *    at once instead of forcing the curator to fix them one at a time.
 *  - Non-fatal issues (rules referencing unknown mods, deployment entries
 *    whose source mod isn't in the snapshot, ...) are returned as
 *    {@link BuildManifestResult.warnings} for the UI to surface.
 */

import type {
  AuditorMod,
  CapturedModRule,
  CapturedRuleReference,
  FomodSelectionStep,
} from "../getModsListForProfile";
import type { CapturedDeploymentManifest } from "../deploymentManifest";
import { parsePluginsTxt } from "../comparePlugins";
import type { ExportedModsSnapshot } from "../../utils/utils";
import type {
  EhcollExternalDependency,
  EhcollFileOverride,
  EhcollManifest,
  EhcollMod,
  EhcollPluginEntry,
  EhcollRule,
  ExternalEhcollMod,
  ExternalModSource,
  GameVersionPolicy,
  ModRuleType,
  NexusEhcollMod,
  NexusModSource,
  PackageMetadata,
  RequiredExtension,
  SchemaVersion,
  SupportedGameId,
  VortexDeploymentMethod,
} from "../../types/ehcoll";

const SCHEMA_VERSION: SchemaVersion = 1;

const SUPPORTED_GAME_IDS: ReadonlySet<SupportedGameId> = new Set([
  "skyrimse",
  "fallout3",
  "falloutnv",
  "fallout4",
  "starfield",
]);

/**
 * Vortex `gameId` → Nexus URL `gameDomain` mapping for supported games.
 * Vortex stores game domains separately from gameIds (different naming
 * conventions historically — "skyrimse" vs. "skyrimspecialedition"), and
 * `AuditorMod` doesn't capture the per-mod domain in the v1 snapshot.
 *
 * Hardcoded here because:
 *   1. The mapping is stable for our supported game set.
 *   2. The installer needs a real domain to download via the Nexus API.
 *   3. Curators on a single supported game don't need to know the value.
 *
 * Future work: capture `nexusGameId` per-mod (from `mod.attributes.downloadGame`)
 * and prefer that over this fallback table.
 */
const NEXUS_GAME_DOMAIN_BY_GAME_ID: Record<SupportedGameId, string> = {
  skyrimse: "skyrimspecialedition",
  fallout3: "fallout3",
  falloutnv: "newvegas",
  fallout4: "fallout4",
  starfield: "starfield",
};

const KNOWN_RULE_TYPES: ReadonlySet<ModRuleType> = new Set([
  "before",
  "after",
  "requires",
  "recommends",
  "conflicts",
  "provides",
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Optional curator-supplied metadata for an external (non-Nexus) mod.
 * Keyed by `AuditorMod.id` in {@link BuildManifestInput.externalMods}.
 *
 * Anything missing falls back to a documented default — see the prose spec.
 */
export type ExternalModSpec = {
  /** Filename hint shown in the user-side picker prompt. */
  expectedFilename?: string;
  /** Free-form text shown when the mod isn't bundled. Required when bundled=false. */
  instructions?: string;
  /** Include the archive in the `.ehcoll` package at `bundled/<sha256>.<ext>`. */
  bundled?: boolean;
};

export type BuildManifestInput = {
  snapshot: ExportedModsSnapshot;

  package: {
    /** UUIDv4. Generated once per collection by the action handler and persisted. */
    id: string;
    name: string;
    /** Semver. */
    version: string;
    author: string;
    description?: string;
    /** Defaults to current time at call. */
    createdAt?: string;
    /** Default false — skip+warn rather than abort. */
    strictMissingMods?: boolean;
  };

  game: {
    /** Curator's installed game version string. */
    version: string;
    /** Default `"exact"`. */
    versionPolicy?: GameVersionPolicy;
  };

  vortex: {
    version: string;
    deploymentMethod: VortexDeploymentMethod;
    /** Defaults to []. */
    requiredExtensions?: RequiredExtension[];
  };

  /**
   * Verbatim contents of the curator's `plugins.txt` (already read from
   * `%LOCALAPPDATA%\<game>\plugins.txt`). When undefined, the manifest's
   * `plugins.order` is emitted as `[]`.
   */
  pluginsTxtContent?: string;

  /** Per-AuditorMod.id overrides for external (non-Nexus) mods. */
  externalMods?: Record<string, ExternalModSpec>;

  /** Pass-through. Defaults to []. */
  externalDependencies?: EhcollExternalDependency[];
};

export type BuildManifestResult = {
  manifest: EhcollManifest;
  /** Non-fatal issues. Empty when the snapshot is fully clean. */
  warnings: string[];
};

/**
 * Fatal validation errors. Every problem the packager could detect is
 * collected before throwing — curators get one report, not whack-a-mole.
 */
export class BuildManifestError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(
      errors.length === 1
        ? errors[0]
        : `Cannot build manifest (${errors.length} problems):\n  - ${errors.join(
            "\n  - ",
          )}`,
    );
    this.name = "BuildManifestError";
    this.errors = errors;
  }
}

export function buildManifest(input: BuildManifestInput): BuildManifestResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const gameId = validateGameId(input.snapshot.gameId, errors);
  const compareKeyById = new Map<string, string>();
  const usedCompareKeys = new Map<string, string>();

  const mods: EhcollMod[] = [];
  for (const mod of input.snapshot.mods) {
    const built = buildModEntry(
      mod,
      gameId,
      input.externalMods?.[mod.id],
      errors,
    );
    if (!built) continue;

    compareKeyById.set(mod.id, built.compareKey);

    const existingId = usedCompareKeys.get(built.compareKey);
    if (existingId !== undefined && existingId !== mod.id) {
      errors.push(
        `Duplicate compareKey "${built.compareKey}" for mods "${existingId}" and "${mod.id}". ` +
          `Two mods cannot share an identity in the same package.`,
      );
      continue;
    }
    usedCompareKeys.set(built.compareKey, mod.id);
    mods.push(built);
  }

  if (errors.length > 0) {
    throw new BuildManifestError(errors);
  }

  const rules = buildRules(input.snapshot.mods, compareKeyById, warnings);

  const fileOverrides = buildFileOverrides(
    input.snapshot.deploymentManifests ?? [],
    compareKeyById,
    warnings,
  );

  const pluginsOrder = buildPluginsOrder(input.pluginsTxtContent);

  const manifest: EhcollManifest = {
    schemaVersion: SCHEMA_VERSION,
    package: buildPackageMetadata(input.package),
    game: {
      id: gameId,
      version: input.game.version,
      versionPolicy: input.game.versionPolicy ?? "exact",
    },
    vortex: {
      version: input.vortex.version,
      deploymentMethod: input.vortex.deploymentMethod,
      requiredExtensions: input.vortex.requiredExtensions ?? [],
    },
    mods,
    rules,
    fileOverrides,
    plugins: { order: pluginsOrder },
    iniTweaks: [],
    externalDependencies: input.externalDependencies ?? [],
  };

  return { manifest, warnings };
}

// ---------------------------------------------------------------------------
// Validators / mappers
// ---------------------------------------------------------------------------

function validateGameId(raw: string, errors: string[]): SupportedGameId {
  if (!SUPPORTED_GAME_IDS.has(raw as SupportedGameId)) {
    errors.push(
      `Unsupported gameId "${raw}". Event Horizon supports: ${Array.from(
        SUPPORTED_GAME_IDS,
      ).join(", ")}.`,
    );
    return raw as SupportedGameId;
  }
  return raw as SupportedGameId;
}

function buildPackageMetadata(
  pkg: BuildManifestInput["package"],
): PackageMetadata {
  return {
    id: pkg.id,
    name: pkg.name,
    version: pkg.version,
    author: pkg.author,
    createdAt: pkg.createdAt ?? new Date().toISOString(),
    description: pkg.description,
    strictMissingMods: pkg.strictMissingMods ?? false,
  };
}

/**
 * Decide nexus vs external from {@link AuditorMod} fields, build the
 * matching mod entry. Returns `undefined` when the mod is unbuildable
 * (in which case it pushed errors to the accumulator).
 */
function buildModEntry(
  mod: AuditorMod,
  gameId: SupportedGameId,
  spec: ExternalModSpec | undefined,
  errors: string[],
): EhcollMod | undefined {
  if (!mod.archiveSha256) {
    errors.push(
      `Mod "${mod.id}" (${mod.name}) has no archiveSha256. ` +
        `Cannot pack a manifest mod without archive identity. ` +
        `Verify the source archive is present in Vortex's download cache and re-export.`,
    );
    return undefined;
  }

  if (isNexusMod(mod)) {
    return buildNexusMod(mod, gameId);
  }

  return buildExternalMod(mod, spec);
}

function isNexusMod(mod: AuditorMod): boolean {
  return (
    mod.source === "nexus" &&
    mod.nexusModId !== undefined &&
    mod.nexusFileId !== undefined
  );
}

function buildNexusMod(
  mod: AuditorMod,
  gameId: SupportedGameId,
): NexusEhcollMod {
  const compareKey = `nexus:${mod.nexusModId}:${mod.nexusFileId}`;

  const source: NexusModSource = {
    kind: "nexus",
    gameDomain: NEXUS_GAME_DOMAIN_BY_GAME_ID[gameId],
    modId: Number(mod.nexusModId),
    fileId: Number(mod.nexusFileId),
    archiveName: deriveArchiveName(mod),
    sha256: mod.archiveSha256!,
  };

  return {
    compareKey,
    name: mod.name,
    version: mod.version,
    source,
    install: buildModInstallSpec(mod),
    state: buildModInstallState(mod),
    attributes: buildUiAttributes(mod),
  };
}

function buildExternalMod(
  mod: AuditorMod,
  spec: ExternalModSpec | undefined,
): ExternalEhcollMod {
  const compareKey = `external:${mod.archiveSha256}`;

  const source: ExternalModSource = {
    kind: "external",
    expectedFilename: spec?.expectedFilename ?? deriveArchiveName(mod),
    sha256: mod.archiveSha256!,
    instructions: spec?.instructions,
    bundled: spec?.bundled ?? false,
  };

  return {
    compareKey,
    name: mod.name,
    version: mod.version,
    source,
    install: buildModInstallSpec(mod),
    state: buildModInstallState(mod),
    attributes: buildUiAttributes(mod),
  };
}

/**
 * v1 has no captured archive filename in the snapshot — Vortex stores it
 * on `state.persistent.downloads.files[archiveId].localPath`, which the
 * pure converter can't read. We fall back to `mod.name`; the action
 * handler in slice 4 can override this per-mod with the real filename.
 */
function deriveArchiveName(mod: AuditorMod): string {
  return mod.name;
}

function buildModInstallSpec(
  mod: AuditorMod,
): EhcollMod["install"] {
  const fomodSelections: FomodSelectionStep[] = mod.fomodSelections ?? [];
  return {
    fomodSelections,
    installerType: mod.installerType,
  };
}

function buildModInstallState(
  mod: AuditorMod,
): EhcollMod["state"] {
  return {
    enabled: mod.enabled,
    installOrder: mod.installOrder,
    deploymentPriority: mod.installOrder,
    modType: mod.modType,
    fileOverrides:
      mod.fileOverrides && mod.fileOverrides.length > 0
        ? mod.fileOverrides
        : undefined,
    enabledINITweaks:
      mod.enabledINITweaks && mod.enabledINITweaks.length > 0
        ? mod.enabledINITweaks
        : undefined,
  };
}

function buildUiAttributes(
  _mod: AuditorMod,
): EhcollMod["attributes"] {
  // No-op for now — AuditorMod doesn't currently carry category/description.
  // Schema field is optional; emit undefined and let future capture passes fill it in.
  return undefined;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

function buildRules(
  mods: AuditorMod[],
  compareKeyById: Map<string, string>,
  warnings: string[],
): EhcollRule[] {
  const out: EhcollRule[] = [];

  for (const mod of mods) {
    const sourceCompareKey = compareKeyById.get(mod.id);
    if (!sourceCompareKey) continue;

    for (const rule of mod.rules ?? []) {
      const built = buildRule(mod, sourceCompareKey, rule, compareKeyById, warnings);
      if (built) out.push(built);
    }
  }

  out.sort(canonicalRuleSortKey);
  return out;
}

function buildRule(
  ownerMod: AuditorMod,
  sourceCompareKey: string,
  rule: CapturedModRule,
  compareKeyById: Map<string, string>,
  warnings: string[],
): EhcollRule | undefined {
  if (!KNOWN_RULE_TYPES.has(rule.type as ModRuleType)) {
    warnings.push(
      `Mod "${ownerMod.id}" has a rule with unknown type "${rule.type}". Skipping.`,
    );
    return undefined;
  }

  const reference = synthesizeRuleReference(
    ownerMod,
    rule.reference,
    compareKeyById,
    warnings,
  );
  if (!reference) return undefined;

  return {
    source: sourceCompareKey,
    type: rule.type as ModRuleType,
    reference,
    comment: rule.comment,
    ignored: rule.ignored === true ? true : undefined,
  };
}

/**
 * Translate a {@link CapturedRuleReference} (Vortex's multi-pin object)
 * into a single manifest-style compareKey string.
 *
 * Priority — strongest first. We deliberately prefer fully-pinned forms
 * because the installer can downgrade them at resolve time but cannot
 * upgrade a partial pin without losing portability.
 */
function synthesizeRuleReference(
  ownerMod: AuditorMod,
  ref: CapturedRuleReference,
  compareKeyById: Map<string, string>,
  warnings: string[],
): string | undefined {
  if (ref.nexusModId && ref.nexusFileId) {
    return `nexus:${ref.nexusModId}:${ref.nexusFileId}`;
  }
  if (ref.nexusModId) {
    return `nexus:${ref.nexusModId}`;
  }

  if (ref.id) {
    const mapped = compareKeyById.get(ref.id);
    if (mapped) return mapped;
  }

  if (ref.archiveId) {
    return `archive:${ref.archiveId}`;
  }

  warnings.push(
    `Mod "${ownerMod.id}" has a rule whose reference cannot be resolved to a stable compareKey ` +
      `(reference: ${JSON.stringify(ref)}). Skipping.`,
  );
  return undefined;
}

function canonicalRuleSortKey(a: EhcollRule, b: EhcollRule): number {
  if (a.source !== b.source) return a.source < b.source ? -1 : 1;
  if (a.type !== b.type) return a.type < b.type ? -1 : 1;
  if (a.reference !== b.reference) return a.reference < b.reference ? -1 : 1;
  return 0;
}

// ---------------------------------------------------------------------------
// File overrides (top-level — derived from deployment manifests)
// ---------------------------------------------------------------------------

function buildFileOverrides(
  deploymentManifests: CapturedDeploymentManifest[],
  compareKeyById: Map<string, string>,
  warnings: string[],
): EhcollFileOverride[] {
  const out: EhcollFileOverride[] = [];
  const unresolvedSources = new Set<string>();

  for (const manifest of deploymentManifests) {
    for (const entry of manifest.files) {
      const winningMod = compareKeyById.get(entry.source);
      if (!winningMod) {
        unresolvedSources.add(entry.source);
        continue;
      }

      out.push({
        filePath: toPosixPath(entry.relPath),
        winningMod,
        // INVARIANT (v1): Vortex's deployment manifest does not record losers,
        // only the winner and (optionally) merge sources. Computing losers
        // requires walking every mod's staging tree, which the converter
        // can't do without I/O. v1 emits []; the installer doesn't need
        // losers to deploy correctly.
        losingMods: [],
      });
    }
  }

  for (const source of unresolvedSources) {
    warnings.push(
      `Deployment manifest references mod folder "${source}" which is not in the snapshot. ` +
        `Skipping its file overrides. (Mod was likely uninstalled between deploy and snapshot.)`,
    );
  }

  out.sort((a, b) => (a.filePath < b.filePath ? -1 : a.filePath > b.filePath ? 1 : 0));
  return out;
}

function toPosixPath(p: string): string {
  return p.replace(/\\/g, "/");
}

// ---------------------------------------------------------------------------
// Plugins
// ---------------------------------------------------------------------------

function buildPluginsOrder(content: string | undefined): EhcollPluginEntry[] {
  if (content === undefined) return [];

  const parsed = parsePluginsTxt(content);
  return parsed.map((entry) => ({
    name: entry.name,
    enabled: entry.enabled,
  }));
}
