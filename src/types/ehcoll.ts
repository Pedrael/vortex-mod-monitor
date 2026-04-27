/**
 * Event Horizon collection package — `.ehcoll` manifest types (schema v1).
 *
 * The `.ehcoll` package is a ZIP file with a `manifest.json` at its root that
 * conforms to {@link EhcollManifest} below. The packager (Phase 2) writes it,
 * the resolver/installer (Phases 3–4) reads it.
 *
 * Specs:
 *  - business behavior:  docs/business/MANIFEST_SCHEMA.md
 *  - design rationale:   docs/PROPOSAL_INSTALLER.md (§5–§6)
 *  - identity rule:      docs/PROPOSAL_INSTALLER.md §5.5 (LOAD-BEARING)
 *
 * INVARIANTS (enforced by the packager, expected by the installer):
 *  - This file is type-only. No runtime code, no enums-with-values, no consts.
 *    Adding runtime code here changes the dependency graph; keep it inert.
 *  - All SHA-256 strings are lowercase hex, exactly 64 characters.
 *  - All timestamps are ISO-8601 UTC strings (`...Z`) unless explicitly noted.
 *  - All `compareKey` strings follow the format documented in
 *    docs/business/AUDITOR_MOD.md ("Mod identity / compareKey").
 *  - Every array field is required and non-undefined. Empty arrays are valid;
 *    missing fields are not. (Optional sub-fields use `?` explicitly.)
 *  - Schema is additive: future v1.x revisions add fields, never rename or
 *    remove. A breaking change bumps {@link SchemaVersion}.
 */

import type {
  FomodSelectionStep,
} from "../core/getModsListForProfile";

/**
 * Manifest schema version. Bumped only on breaking changes — additive
 * field changes leave this at 1. The installer refuses unknown versions.
 */
export type SchemaVersion = 1;

/**
 * Top-level shape of `manifest.json` inside an `.ehcoll` package.
 */
export type EhcollManifest = {
  schemaVersion: SchemaVersion;
  package: PackageMetadata;
  game: GameMetadata;
  vortex: VortexMetadata;
  mods: EhcollMod[];
  rules: EhcollRule[];
  fileOverrides: EhcollFileOverride[];
  plugins: EhcollPlugins;
  /**
   * Curator's per-game LoadOrder snapshot — Vortex's
   * `state.persistent.loadOrder[gameId]` projection. Distinct from
   * {@link EhcollPlugins.order}: plugins.txt covers ESPs/ESMs/ESLs only,
   * this covers every Vortex-managed mod (including script extenders,
   * ENB binaries, and other non-plugin payloads) for games that use
   * Vortex's LoadOrder API. Empty array for games that drive load
   * order purely via plugins.txt.
   *
   * Required field — older v1 manifests written before slice 6c
   * landed will not have it; the parser back-fills with `[]` so the
   * type stays clean. `compareKey` references resolve to user-side
   * Vortex modIds at install time (mirrors `EhcollRule.source`).
   */
  loadOrder: EhcollLoadOrderEntry[];
  iniTweaks: EhcollIniTweak[];
  externalDependencies: EhcollExternalDependency[];
};

// ---------------------------------------------------------------------------
// Package metadata
// ---------------------------------------------------------------------------

export type PackageMetadata = {
  /**
   * UUIDv4 string. Stable across re-exports of the *same* collection so a
   * user's "is this the same collection I installed before?" check works.
   * The version field, not this id, distinguishes releases.
   */
  id: string;
  name: string;
  /** Semver string. Used by the user-side store / cache logic. */
  version: string;
  author: string;
  /** ISO-8601 UTC. */
  createdAt: string;
  description?: string;
  /**
   * Policy for unresolvable mods at install time:
   *  - `true`  → abort install with a full report.
   *  - `false` → skip + warn, surface in the post-install drift report.
   */
  strictMissingMods: boolean;
};

// ---------------------------------------------------------------------------
// Game / Vortex environment metadata
// ---------------------------------------------------------------------------

export type GameMetadata = {
  /** Vortex `gameId`. Restricted at the packager to the supported set. */
  id: SupportedGameId;
  /** Exact game version string the curator built on. */
  version: string;
  versionPolicy: GameVersionPolicy;
};

/**
 * Games this installer knows how to deploy. The `manifest.game.id` field
 * is restricted to this union; older or newer manifests with a different
 * id are rejected at parse time.
 *
 * Source of truth: docs/PROPOSAL_INSTALLER.md §3.
 */
export type SupportedGameId =
  | "skyrimse"
  | "fallout3"
  | "falloutnv"
  | "fallout4"
  | "starfield";

/**
 * `"exact"` requires the user's installed game version to match
 * `game.version` byte-for-byte. `"minimum"` requires the user's version to
 * be `>=` the manifest version (semver compare).
 */
export type GameVersionPolicy = "exact" | "minimum";

export type VortexMetadata = {
  /** Vortex client version the curator used. Warn-only mismatch. */
  version: string;
  /**
   * Curator's deployment method. Informational only — the user's Vortex
   * may use a different method; the installer respects whichever is set
   * on the user side.
   */
  deploymentMethod: VortexDeploymentMethod;
  /**
   * Other Vortex extensions the install REQUIRES to be present and enabled
   * on the user side (e.g. LOOT). Refuse-to-install on missing.
   */
  requiredExtensions: RequiredExtension[];
};

export type VortexDeploymentMethod = "hardlink" | "symlink" | "copy";

export type RequiredExtension = {
  id: string;
  /** Optional minimum semver, when known. */
  minVersion?: string;
};

// ---------------------------------------------------------------------------
// Mods (discriminated union by source.kind)
// ---------------------------------------------------------------------------

/**
 * A mod entry in the manifest. The discriminator lives on `source.kind`:
 *  - `"nexus"`   → identity is `(gameDomain, modId, fileId)`, verified by sha256
 *  - `"external"` → identity is `sha256` alone (sole identity, see §5.5)
 *
 * Vortex's vanilla collections do not have a true second case — Event Horizon
 * does because every external mod the curator ships carries the SHA-256 of
 * the exact bytes they built against, and the user-side resolver refuses
 * anything else.
 */
export type EhcollMod = NexusEhcollMod | ExternalEhcollMod;

export type NexusEhcollMod = EhcollModBase & {
  source: NexusModSource;
};

export type ExternalEhcollMod = EhcollModBase & {
  source: ExternalModSource;
};

type EhcollModBase = {
  /**
   * Stable identity for diff/reconcile. See `getModCompareKey` and
   * docs/business/AUDITOR_MOD.md for the full ladder. Examples:
   *   "nexus:1234:567890"
   *   "archive:abc-123-def"
   *   "id:MyMod-1234-5-0-0"
   *   "external:<sha256>"  (manifest-only synthetic key for external mods)
   */
  compareKey: string;
  name: string;
  version?: string;
  install: ModInstallSpec;
  state: ModInstallState;
  /** UI-only metadata. Never used by the installer for identity or behavior. */
  attributes?: ModUiAttributes;
};

export type NexusModSource = {
  kind: "nexus";
  /** Nexus game domain, e.g. `"skyrimspecialedition"`. */
  gameDomain: string;
  modId: number;
  fileId: number;
  /** Original archive filename on Nexus, useful for the download UI. */
  archiveName: string;
  /**
   * Mandatory. SHA-256 of the bytes Nexus served when the curator built
   * this manifest. The installer downloads via Nexus IDs, then verifies
   * against this hash. Mismatch ⇒ HARD FAIL (Nexus served different bytes).
   */
  sha256: string;
};

export type ExternalModSource = {
  kind: "external";
  /** Filename hint for the user prompt. Not used for identity. */
  expectedFilename: string;
  /**
   * Mandatory. THE identity of this mod. The user-side resolver
   * picks a file (user-supplied or from `bundled/`), streams SHA-256,
   * and refuses to install anything that doesn't match.
   */
  sha256: string;
  /** Free-form text shown to the user when the file isn't in `bundled/`. */
  instructions?: string;
  /**
   * `true` ⇒ archive is included in the package at `bundled/<sha256>.<ext>`.
   * `false` ⇒ the user must supply a local copy.
   */
  bundled: boolean;
};

export type ModInstallSpec = {
  /**
   * Saved FOMOD wizard answers, replayed by the installer in unattended
   * mode. Empty array when the mod isn't FOMOD or had no choices.
   * Order is significant — it mirrors the installer's step sequence.
   */
  fomodSelections: FomodSelectionStep[];
  /** Vortex installer type, e.g. `"fomod"` or `"raw"`. */
  installerType?: string;
};

export type ModInstallState = {
  enabled: boolean;
  /**
   * Curator's install ordinal (0-indexed). Sequenced rule application
   * walks mods in this order to mimic the curator's machine.
   */
  installOrder: number;
  /**
   * Curator's deployment priority (Vortex computes this from rules + age;
   * we capture the resulting number). The installer feeds it back in so
   * the user-side deploy resolves overrides identically.
   */
  deploymentPriority: number;
  /** Vortex modtype. Empty string is the default modtype. */
  modType?: string;
  /**
   * Per-mod file overrides — paths the curator explicitly told Vortex
   * to deploy from this mod even when other mods provide the same path.
   * Mirrors `AuditorMod.fileOverrides`. Distinct from the top-level
   * {@link EhcollFileOverride} array, which describes the *outcome*.
   */
  fileOverrides?: string[];
  /** INI tweak filenames the curator enabled on this mod. */
  enabledINITweaks?: string[];
};

export type ModUiAttributes = {
  category?: string;
  description?: string;
};

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export type EhcollRule = {
  /** `compareKey` of the mod that owns the rule. */
  source: string;
  type: ModRuleType;
  /**
   * Either a fully-pinned `compareKey` (`"nexus:1234:567890"`) or a
   * partially-pinned reference (`"nexus:1234"` matches any file id of
   * Nexus mod 1234). The installer resolves to the strongest available
   * pin on the user side.
   */
  reference: string;
  comment?: string;
  /** Curator's note that the rule is disabled but preserved. */
  ignored?: boolean;
};

export type ModRuleType =
  | "before"
  | "after"
  | "requires"
  | "recommends"
  | "conflicts"
  | "provides";

// ---------------------------------------------------------------------------
// File overrides (top-level — derived from deployment manifest)
// ---------------------------------------------------------------------------

/**
 * Curator-side conflict-resolution OUTCOME for a single file path: which
 * mod deployed it, which mods lost. Distinct from per-mod
 * {@link ModInstallState.fileOverrides} (curator INTENT).
 *
 * Both are captured so the installer can detect drift between the curator's
 * intent and the curator's actual deployed state.
 */
export type EhcollFileOverride = {
  /** Path relative to the deployment target. POSIX-style separators. */
  filePath: string;
  /** `compareKey` of the mod that won this file on the curator's machine. */
  winningMod: string;
  /** `compareKey` list of mods that also provide this file but lost. */
  losingMods: string[];
};

// ---------------------------------------------------------------------------
// Plugins (Bethesda plugins.txt content)
// ---------------------------------------------------------------------------

export type EhcollPlugins = {
  /**
   * Plugin entries in `plugins.txt` order. The user-side installer
   * overwrites the user's plugins.txt to match (with backup).
   */
  order: EhcollPluginEntry[];
};

export type EhcollPluginEntry = {
  /** Plugin filename, e.g. `"Skyrim.esm"`. Original casing preserved. */
  name: string;
  enabled: boolean;
};

// ---------------------------------------------------------------------------
// LoadOrder (top-level — Vortex's per-game load order)
// ---------------------------------------------------------------------------

/**
 * One entry in the curator's per-game LoadOrder, normalized for
 * cross-machine portability. Mirrors the on-disk shape of
 * `state.persistent.loadOrder[gameId]` after `captureLoadOrder`.
 *
 * INVARIANT: `compareKey` is mandatory and always resolvable against
 * `EhcollManifest.mods`. Curator-side capture skips load-order entries
 * whose Vortex modId can't be mapped to a manifest compareKey (a
 * loose archive on disk, an external Vortex mod we didn't pack, etc.).
 */
export type EhcollLoadOrderEntry = {
  /** Mirrors `EhcollMod.compareKey`. */
  compareKey: string;
  /** 0-indexed position in the curator's load order. */
  pos: number;
  /** Whether the curator had this entry enabled in the load-order view. */
  enabled: boolean;
  /**
   * Curator marked this entry as locked (cannot be moved by the user).
   * Informational — the installer does not enforce locking on the user
   * side; Vortex's UI uses this for display + drag-disable hints only.
   */
  locked?: boolean;
};

// ---------------------------------------------------------------------------
// INI tweaks (Phase 5 stretch goal — schema placeholder)
// ---------------------------------------------------------------------------

/**
 * Single INI key/value override. Phase 5 deliverable; v1 packagers emit
 * `iniTweaks: []`. Placed in the v1 schema so future packagers can
 * populate it without bumping {@link SchemaVersion}.
 *
 * See docs/PROPOSAL_INSTALLER.md §7.4 — the Vortex Redux key for tweaks
 * still has to be confirmed at runtime.
 */
export type EhcollIniTweak = {
  /** Logical id (e.g. `"Skyrim.ini"`); per-game mapping lives in installer. */
  ini: string;
  section: string;
  key: string;
  value: string;
};

// ---------------------------------------------------------------------------
// External (non-mod) dependencies
// ---------------------------------------------------------------------------

/**
 * Dependencies that are NOT mods Vortex installs — script extenders,
 * ENB binaries, fixed loaders. The user installs these by hand following
 * `instructions`; the installer verifies by hashing the listed files at
 * `destination`.
 */
export type EhcollExternalDependency = {
  id: string;
  name: string;
  /** Free-form bucket, e.g. `"script-extender"`, `"enb"`, `"loader"`. */
  category: string;
  version: string;
  /**
   * Token resolved on the user side. `"<gameDir>"` is the Vortex-tracked
   * game install root; `"<dataDir>"` is its `Data` subdirectory; `"<scripts>"`
   * is the per-game scripts location (e.g. `Data\Scripts` for Skyrim).
   */
  destination: ExternalDependencyDestination;
  /** Files to verify after the user reports installation done. */
  files: ExternalDependencyFile[];
  /** Where to download — surfaced as a clickable link in the UI. */
  instructionsUrl?: string;
  /** Free-form prose. Mandatory because the user has to do work. */
  instructions: string;
};

export type ExternalDependencyDestination = "<gameDir>" | "<dataDir>" | "<scripts>";

export type ExternalDependencyFile = {
  /** Path relative to {@link EhcollExternalDependency.destination}. */
  relPath: string;
  sha256: string;
};
