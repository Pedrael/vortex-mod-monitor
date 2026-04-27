/**
 * Per-collection state file (Phase 2 slice 4b).
 *
 * Persists the bits of curator-supplied input that must survive across
 * rebuilds — most importantly, the `package.id` UUIDv4. The same file
 * also carries per-mod overrides (which external archives to bundle,
 * what instructions to ship for each), README/CHANGELOG bodies, and a
 * read-only `name` hint per external mod so the curator can hand-edit
 * the file without keeping a Vortex modId-to-name lookup table in
 * their head.
 *
 * One file per collection slug, located at:
 *   `<configDir>/<slug>.json`
 *
 * where `<configDir>` is conventionally
 *   `%APPDATA%\Vortex\event-horizon\collections\.config\`
 *
 * On the first build of a given slug, the action handler creates the
 * file with a fresh UUID and an empty externalMods record. Subsequent
 * builds read the file and reuse the same id, preserving release
 * lineage (= "the user's already-installed v1.2.0 of THIS collection
 * upgrades cleanly to v1.3.0 of THIS collection because the package.id
 * is stable").
 *
 * Renaming the collection (which changes the slug) deliberately starts
 * a new release lineage. This is the simplest possible identity model
 * and matches how curators tend to think about renames in practice
 * ("if I rename it, it's a new collection"). The Phase 5 React UI may
 * introduce explicit collection identity decoupled from name; for now,
 * slug = identity.
 *
 * Spec: docs/business/COLLECTION_CONFIG.md
 *
 * ─── DESIGN ────────────────────────────────────────────────────────────
 * No bespoke UI for slice 4b. The action handler:
 *   1. Loads (or creates) the file via `loadOrCreateCollectionConfig`.
 *   2. Calls `reconcileExternalModsConfig` to add stub entries for any
 *      external mods present in the current snapshot but missing from
 *      the file. Newly added stubs default to `bundled: false`,
 *      `instructions: ""`, and carry a `name` hint.
 *   3. If reconciliation changed anything, persists the updated config
 *      via `saveCollectionConfig` so the curator sees a fully populated
 *      file the next time they open it.
 *
 * The Phase 5 React page consumes the same `loadOrCreateCollectionConfig`
 * + `saveCollectionConfig` pair to power its build-panel form — no
 * separate code path.
 * ──────────────────────────────────────────────────────────────────────
 */

import { randomUUID } from "crypto";
import * as fsp from "fs/promises";
import * as path from "path";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export const COLLECTION_CONFIG_SCHEMA_VERSION = 1 as const;
export type CollectionConfigSchemaVersion =
  typeof COLLECTION_CONFIG_SCHEMA_VERSION;

/**
 * Per-mod override carried in the collection config. Keyed by
 * `AuditorMod.id` to match what `BuildManifestInput.externalMods`
 * expects. The `name` field is a read-only hint for hand-editors — it's
 * populated automatically on reconciliation and ignored when the
 * action feeds the config into `buildManifest`.
 */
export type ExternalModConfigEntry = {
  /** Read-only hint set by the action handler. Curator-edits are preserved but never relied on. */
  name?: string;
  /** When true, the source archive ships inside the `.ehcoll` at `bundled/<sha256>.<ext>`. Default false. */
  bundled?: boolean;
  /** Free-form text shown to the user when the mod isn't bundled. */
  instructions?: string;
};

export type CollectionConfig = {
  schemaVersion: CollectionConfigSchemaVersion;
  /** UUIDv4. Stable across rebuilds of the same slug. */
  packageId: string;
  /** Per-AuditorMod.id overrides for external (non-Nexus) mods. */
  externalMods: Record<string, ExternalModConfigEntry>;
  /** Optional README markdown body. Written as `README.md` in the package. */
  readme?: string;
  /** Optional CHANGELOG markdown body. Written as `CHANGELOG.md`. */
  changelog?: string;
};

export type LoadCollectionConfigInput = {
  /** Directory holding `<slug>.json` files. Created if missing. */
  configDir: string;
  /** Slugified collection name. */
  slug: string;
};

export type LoadCollectionConfigResult = {
  config: CollectionConfig;
  /** True iff the config file did not exist and was just created with a fresh UUID. */
  created: boolean;
  /** Absolute path to the JSON file. */
  configPath: string;
};

export type SaveCollectionConfigInput = {
  configDir: string;
  slug: string;
  config: CollectionConfig;
};

export type ReconcileInput = {
  config: CollectionConfig;
  /**
   * The set of currently-external mods in the snapshot. Anything in
   * this list missing from `config.externalMods` gets a stub entry
   * appended; entries in `config.externalMods` whose modId is NOT in
   * this list are kept untouched (the curator may have removed a mod
   * from the profile temporarily and we don't want to lose their
   * instructions).
   */
  externalMods: Array<{ id: string; name: string }>;
};

export type ReconcileResult = {
  config: CollectionConfig;
  /** True iff reconciliation made any change (added stubs or refreshed names). */
  changed: boolean;
  /** Mod IDs added as fresh stubs (informational, for diagnostics). */
  added: string[];
};

export class CollectionConfigError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(
      errors.length === 1
        ? errors[0]
        : `Collection config invalid (${errors.length} problems):\n  - ${errors.join(
            "\n  - ",
          )}`,
    );
    this.name = "CollectionConfigError";
    this.errors = errors;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getCollectionConfigPath(
  configDir: string,
  slug: string,
): string {
  return path.join(configDir, `${slug}.json`);
}

/**
 * Read the per-collection JSON file. If absent, create one with a
 * fresh UUID and write it to disk before returning.
 *
 * The file is parsed defensively. Anything malformed (bad JSON,
 * unexpected `schemaVersion`, missing `packageId`, etc.) throws a
 * {@link CollectionConfigError} listing every problem — we never
 * silently overwrite a broken file, because doing so would discard
 * the curator's previously-saved instructions and bundling choices.
 */
export async function loadOrCreateCollectionConfig(
  input: LoadCollectionConfigInput,
): Promise<LoadCollectionConfigResult> {
  validateSlug(input.slug);

  const configPath = getCollectionConfigPath(input.configDir, input.slug);

  let raw: string;
  try {
    raw = await fsp.readFile(configPath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      const fresh = createDefaultConfig();
      await writeConfigFile(configPath, fresh);
      return { config: fresh, created: true, configPath };
    }
    throw err;
  }

  const config = parseAndValidate(raw, configPath);
  return { config, created: false, configPath };
}

export async function saveCollectionConfig(
  input: SaveCollectionConfigInput,
): Promise<string> {
  validateSlug(input.slug);
  const configPath = getCollectionConfigPath(input.configDir, input.slug);
  await writeConfigFile(configPath, input.config);
  return configPath;
}

/**
 * Pure function. Adds stub entries for mods missing from
 * `config.externalMods` and refreshes the `name` hint on existing
 * entries. Does NOT remove stale entries — the curator may have
 * temporarily removed a mod from the profile and we want their
 * preserved instructions to survive that.
 */
export function reconcileExternalModsConfig(
  input: ReconcileInput,
): ReconcileResult {
  const next: Record<string, ExternalModConfigEntry> = {
    ...input.config.externalMods,
  };

  let changed = false;
  const added: string[] = [];

  for (const mod of input.externalMods) {
    const existing = next[mod.id];
    if (existing === undefined) {
      next[mod.id] = {
        name: mod.name,
        bundled: false,
        instructions: "",
      };
      changed = true;
      added.push(mod.id);
      continue;
    }

    if (existing.name !== mod.name) {
      next[mod.id] = { ...existing, name: mod.name };
      changed = true;
    }
  }

  return {
    config: changed ? { ...input.config, externalMods: next } : input.config,
    changed,
    added,
  };
}

/**
 * Strip {@link ExternalModConfigEntry.name} hints — they're for
 * hand-editors only and have no place in `BuildManifestInput`. Returns
 * the shape `buildManifest` expects.
 */
export function toBuildManifestExternalMods(
  config: CollectionConfig,
): Record<string, { instructions?: string; bundled?: boolean }> {
  const out: Record<string, { instructions?: string; bundled?: boolean }> = {};
  for (const [modId, entry] of Object.entries(config.externalMods)) {
    out[modId] = {
      instructions: entry.instructions,
      bundled: entry.bundled,
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function createDefaultConfig(): CollectionConfig {
  return {
    schemaVersion: COLLECTION_CONFIG_SCHEMA_VERSION,
    packageId: randomUUID(),
    externalMods: {},
  };
}

async function writeConfigFile(
  configPath: string,
  config: CollectionConfig,
): Promise<void> {
  const dir = path.dirname(configPath);
  await fsp.mkdir(dir, { recursive: true });
  // Pretty-print so curators can hand-edit comfortably.
  const json = JSON.stringify(config, null, 2);
  await fsp.writeFile(configPath, json, "utf8");
}

function validateSlug(slug: string): void {
  if (typeof slug !== "string" || slug.length === 0) {
    throw new CollectionConfigError(["Slug cannot be empty."]);
  }
  // The slug becomes a filename component; refuse path traversal and
  // characters that confuse Windows. The action handler's `slugify`
  // already produces a clean string, but we belt-and-braces here so
  // direct callers (Phase 5 UI, tests) can't accidentally smuggle in
  // a `..\..\evil.json`.
  if (/[\\/:*?"<>|]/.test(slug) || slug.includes("..")) {
    throw new CollectionConfigError([
      `Slug "${slug}" contains characters that are not allowed in a config filename.`,
    ]);
  }
}

function parseAndValidate(raw: string, configPath: string): CollectionConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new CollectionConfigError([
      `Config file "${configPath}" is not valid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    ]);
  }

  const errors: string[] = [];

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CollectionConfigError([
      `Config file "${configPath}" must be a JSON object.`,
    ]);
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.schemaVersion !== COLLECTION_CONFIG_SCHEMA_VERSION) {
    errors.push(
      `Unsupported schemaVersion ${JSON.stringify(obj.schemaVersion)}. ` +
        `Expected ${COLLECTION_CONFIG_SCHEMA_VERSION}.`,
    );
  }

  if (typeof obj.packageId !== "string" || !isUuid(obj.packageId)) {
    errors.push(
      `packageId must be a UUIDv4 string. Got ${JSON.stringify(obj.packageId)}.`,
    );
  }

  let externalMods: Record<string, ExternalModConfigEntry> = {};
  if (obj.externalMods === undefined) {
    // Tolerate legacy/missing field.
  } else if (
    obj.externalMods === null ||
    typeof obj.externalMods !== "object" ||
    Array.isArray(obj.externalMods)
  ) {
    errors.push("externalMods, when present, must be a JSON object.");
  } else {
    externalMods = validateExternalMods(
      obj.externalMods as Record<string, unknown>,
      errors,
    );
  }

  if (obj.readme !== undefined && typeof obj.readme !== "string") {
    errors.push("readme, when present, must be a string.");
  }
  if (obj.changelog !== undefined && typeof obj.changelog !== "string") {
    errors.push("changelog, when present, must be a string.");
  }

  if (errors.length > 0) {
    throw new CollectionConfigError(errors);
  }

  const config: CollectionConfig = {
    schemaVersion: COLLECTION_CONFIG_SCHEMA_VERSION,
    packageId: obj.packageId as string,
    externalMods,
  };
  if (typeof obj.readme === "string") config.readme = obj.readme;
  if (typeof obj.changelog === "string") config.changelog = obj.changelog;
  return config;
}

function validateExternalMods(
  raw: Record<string, unknown>,
  errors: string[],
): Record<string, ExternalModConfigEntry> {
  const out: Record<string, ExternalModConfigEntry> = {};
  for (const [modId, value] of Object.entries(raw)) {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      errors.push(`externalMods["${modId}"] must be an object.`);
      continue;
    }
    const entry = value as Record<string, unknown>;
    const sanitized: ExternalModConfigEntry = {};

    if (entry.name !== undefined) {
      if (typeof entry.name !== "string") {
        errors.push(`externalMods["${modId}"].name must be a string.`);
      } else {
        sanitized.name = entry.name;
      }
    }
    if (entry.bundled !== undefined) {
      if (typeof entry.bundled !== "boolean") {
        errors.push(`externalMods["${modId}"].bundled must be a boolean.`);
      } else {
        sanitized.bundled = entry.bundled;
      }
    }
    if (entry.instructions !== undefined) {
      if (typeof entry.instructions !== "string") {
        errors.push(`externalMods["${modId}"].instructions must be a string.`);
      } else {
        sanitized.instructions = entry.instructions;
      }
    }
    out[modId] = sanitized;
  }
  return out;
}

function isUuid(value: string): boolean {
  // Accept any RFC 4122 UUID, not just v4 — curators may legitimately
  // paste a v1/v5 they generated elsewhere. The exact version is not
  // load-bearing for our identity model.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
