/**
 * `manifest.json` validator (Phase 3 slice 1).
 *
 * Pure mirror of {@link ../manifest/buildManifest.buildManifest}. Takes
 * the raw string contents of a `.ehcoll` package's `manifest.json` and
 * returns a fully-typed {@link EhcollManifest} or throws a single
 * `ParseManifestError` listing every problem detected.
 *
 * Spec: docs/business/PARSE_MANIFEST.md
 *
 * ─── DESIGN ────────────────────────────────────────────────────────────
 * No I/O, no state access, no side effects. The caller (slice 2's
 * `readEhcoll`) is responsible for reading the ZIP and pulling out the
 * `manifest.json` contents; this module only validates the resulting
 * string.
 *
 * Every detectable problem is collected into one list and reported
 * together — same "no whack-a-mole" pattern we use in `buildManifest`
 * and `packageEhcoll`. A curator/user fixing a bad manifest gets the
 * full picture, not a half-fix-then-rerun loop.
 *
 * Two severity tiers:
 *  - **Errors** abort the parse. Missing required fields, wrong types,
 *    bad enum values, duplicate compareKeys, malformed SHA-256s,
 *    unsupported gameId, schemaVersion ≠ 1. The resolver/installer
 *    cannot start without these.
 *  - **Warnings** survive the parse. Rule references that don't resolve
 *    to any mod in the manifest, file-override mods missing from the
 *    mods list, etc. The resolver may downgrade or skip these at
 *    install time but the manifest as a whole is structurally valid.
 *
 * Cross-reference validation (compareKey lookups, bundled-flag sanity)
 * runs AFTER all mods are validated so we have the full set of
 * compareKeys to check against.
 * ──────────────────────────────────────────────────────────────────────
 */

import type {
  EhcollExternalDependency,
  EhcollFileOverride,
  EhcollIniTweak,
  EhcollManifest,
  EhcollMod,
  EhcollPluginEntry,
  EhcollRule,
  ExternalDependencyDestination,
  ExternalDependencyFile,
  ExternalModSource,
  GameMetadata,
  GameVersionPolicy,
  ModInstallSpec,
  ModInstallState,
  ModRuleType,
  ModUiAttributes,
  NexusModSource,
  PackageMetadata,
  RequiredExtension,
  SchemaVersion,
  SupportedGameId,
  VortexDeploymentMethod,
  VortexMetadata,
} from "../../types/ehcoll";
import type {
  FomodSelectedChoice,
  FomodSelectionGroup,
  FomodSelectionStep,
} from "../getModsListForProfile";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const SCHEMA_VERSION: SchemaVersion = 1;

const SUPPORTED_GAME_IDS = new Set<SupportedGameId>([
  "skyrimse",
  "fallout3",
  "falloutnv",
  "fallout4",
  "starfield",
]);

const GAME_VERSION_POLICIES = new Set<GameVersionPolicy>(["exact", "minimum"]);

const VORTEX_DEPLOYMENT_METHODS = new Set<VortexDeploymentMethod>([
  "hardlink",
  "symlink",
  "copy",
]);

const RULE_TYPES = new Set<ModRuleType>([
  "before",
  "after",
  "requires",
  "recommends",
  "conflicts",
  "provides",
]);

const EXTERNAL_DEP_DESTINATIONS = new Set<ExternalDependencyDestination>([
  "<gameDir>",
  "<dataDir>",
  "<scripts>",
]);

export type ParseManifestResult = {
  manifest: EhcollManifest;
  /**
   * Non-fatal issues. Empty when the manifest is fully clean. The
   * caller may surface these in a UI for the user/curator to inspect.
   */
  warnings: string[];
};

export class ParseManifestError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(
      errors.length === 1
        ? errors[0]
        : `Manifest is invalid (${errors.length} problems):\n  - ${errors.join(
            "\n  - ",
          )}`,
    );
    this.name = "ParseManifestError";
    this.errors = errors;
  }
}

/**
 * Parse + validate a `.ehcoll` `manifest.json` payload.
 *
 * `raw` is the JSON text exactly as it appears inside the ZIP. JSON
 * parsing failures become a single `ParseManifestError`. Structural
 * problems are collected into one error list before throwing.
 */
export function parseManifest(raw: string): ParseManifestResult {
  const parsed = parseJson(raw);

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObject(parsed)) {
    throw new ParseManifestError([
      `Top-level value must be a JSON object, got ${describe(parsed)}.`,
    ]);
  }

  // schemaVersion is the gate: if it's wrong, we don't even know what
  // the rest of the document means. Report that and stop.
  if ((parsed as Record<string, unknown>).schemaVersion !== SCHEMA_VERSION) {
    throw new ParseManifestError([
      `Unsupported schemaVersion ${JSON.stringify(
        (parsed as Record<string, unknown>).schemaVersion,
      )}. ` +
        `This installer understands schemaVersion ${SCHEMA_VERSION} only. ` +
        `Update the Event Horizon extension to install newer manifests.`,
    ]);
  }

  const obj = parsed as Record<string, unknown>;

  const pkg = validatePackage(obj.package, errors);
  const game = validateGame(obj.game, errors);
  const vortex = validateVortex(obj.vortex, errors);
  const mods = validateMods(obj.mods, errors);
  const rules = validateRules(obj.rules, errors);
  const fileOverrides = validateFileOverrides(obj.fileOverrides, errors);
  const plugins = validatePlugins(obj.plugins, errors);
  const iniTweaks = validateIniTweaks(obj.iniTweaks, errors);
  const externalDependencies = validateExternalDependencies(
    obj.externalDependencies,
    errors,
  );

  if (errors.length > 0) {
    throw new ParseManifestError(errors);
  }

  // Cross-reference checks are post-pass: they're warnings, not errors,
  // because a manifest with an unresolvable rule is structurally valid
  // even though the resolver can't honor every directive.
  crossReferenceValidate(
    {
      mods: mods!,
      rules: rules!,
      fileOverrides: fileOverrides!,
    },
    warnings,
  );

  const manifest: EhcollManifest = {
    schemaVersion: SCHEMA_VERSION,
    package: pkg!,
    game: game!,
    vortex: vortex!,
    mods: mods!,
    rules: rules!,
    fileOverrides: fileOverrides!,
    plugins: plugins!,
    iniTweaks: iniTweaks!,
    externalDependencies: externalDependencies!,
  };

  return { manifest, warnings };
}

// ---------------------------------------------------------------------------
// Section validators
// ---------------------------------------------------------------------------

function validatePackage(
  raw: unknown,
  errors: string[],
): PackageMetadata | undefined {
  if (!isObject(raw)) {
    errors.push(`package must be an object, got ${describe(raw)}.`);
    return undefined;
  }
  const obj = raw as Record<string, unknown>;

  const id = expectUuid(obj.id, "package.id", errors);
  const name = expectNonEmptyString(obj.name, "package.name", errors);
  const version = expectSemver(obj.version, "package.version", errors);
  const author = expectNonEmptyString(obj.author, "package.author", errors);
  const createdAt = expectIso8601(obj.createdAt, "package.createdAt", errors);
  const strictMissingMods = expectBoolean(
    obj.strictMissingMods,
    "package.strictMissingMods",
    errors,
  );

  const description =
    obj.description === undefined
      ? undefined
      : expectString(obj.description, "package.description", errors);

  if (
    id === undefined ||
    name === undefined ||
    version === undefined ||
    author === undefined ||
    createdAt === undefined ||
    strictMissingMods === undefined
  ) {
    return undefined;
  }

  return {
    id,
    name,
    version,
    author,
    createdAt,
    strictMissingMods,
    ...(description !== undefined ? { description } : {}),
  };
}

function validateGame(
  raw: unknown,
  errors: string[],
): GameMetadata | undefined {
  if (!isObject(raw)) {
    errors.push(`game must be an object, got ${describe(raw)}.`);
    return undefined;
  }
  const obj = raw as Record<string, unknown>;

  const id = expectEnum(obj.id, SUPPORTED_GAME_IDS, "game.id", errors) as
    | SupportedGameId
    | undefined;
  const version = expectNonEmptyString(obj.version, "game.version", errors);
  const versionPolicy = expectEnum(
    obj.versionPolicy,
    GAME_VERSION_POLICIES,
    "game.versionPolicy",
    errors,
  ) as GameVersionPolicy | undefined;

  if (id === undefined || version === undefined || versionPolicy === undefined) {
    return undefined;
  }

  return { id, version, versionPolicy };
}

function validateVortex(
  raw: unknown,
  errors: string[],
): VortexMetadata | undefined {
  if (!isObject(raw)) {
    errors.push(`vortex must be an object, got ${describe(raw)}.`);
    return undefined;
  }
  const obj = raw as Record<string, unknown>;

  const version = expectNonEmptyString(obj.version, "vortex.version", errors);
  const deploymentMethod = expectEnum(
    obj.deploymentMethod,
    VORTEX_DEPLOYMENT_METHODS,
    "vortex.deploymentMethod",
    errors,
  ) as VortexDeploymentMethod | undefined;

  const requiredExtensions = expectArray(
    obj.requiredExtensions,
    "vortex.requiredExtensions",
    errors,
  );
  const parsedExtensions: RequiredExtension[] = [];
  if (requiredExtensions !== undefined) {
    requiredExtensions.forEach((ext, i) => {
      const parsed = validateRequiredExtension(
        ext,
        `vortex.requiredExtensions[${i}]`,
        errors,
      );
      if (parsed !== undefined) parsedExtensions.push(parsed);
    });
  }

  if (
    version === undefined ||
    deploymentMethod === undefined ||
    requiredExtensions === undefined
  ) {
    return undefined;
  }

  return { version, deploymentMethod, requiredExtensions: parsedExtensions };
}

function validateRequiredExtension(
  raw: unknown,
  path: string,
  errors: string[],
): RequiredExtension | undefined {
  if (!isObject(raw)) {
    errors.push(`${path} must be an object, got ${describe(raw)}.`);
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  const id = expectNonEmptyString(obj.id, `${path}.id`, errors);
  const minVersion =
    obj.minVersion === undefined
      ? undefined
      : expectString(obj.minVersion, `${path}.minVersion`, errors);
  if (id === undefined) return undefined;
  return minVersion === undefined ? { id } : { id, minVersion };
}

// ---------------------------------------------------------------------------
// Mods
// ---------------------------------------------------------------------------

function validateMods(
  raw: unknown,
  errors: string[],
): EhcollMod[] | undefined {
  const arr = expectArray(raw, "mods", errors);
  if (arr === undefined) return undefined;

  const mods: EhcollMod[] = [];
  const seenCompareKeys = new Map<string, number>();

  arr.forEach((entry, i) => {
    const mod = validateModEntry(entry, `mods[${i}]`, errors);
    if (mod === undefined) return;

    const previousIndex = seenCompareKeys.get(mod.compareKey);
    if (previousIndex !== undefined) {
      errors.push(
        `Duplicate compareKey "${mod.compareKey}" at mods[${i}] and mods[${previousIndex}]. ` +
          `Two mods cannot share the same identity in one manifest.`,
      );
      return;
    }
    seenCompareKeys.set(mod.compareKey, i);
    mods.push(mod);
  });

  return mods;
}

function validateModEntry(
  raw: unknown,
  path: string,
  errors: string[],
): EhcollMod | undefined {
  if (!isObject(raw)) {
    errors.push(`${path} must be an object, got ${describe(raw)}.`);
    return undefined;
  }
  const obj = raw as Record<string, unknown>;

  const compareKey = expectNonEmptyString(
    obj.compareKey,
    `${path}.compareKey`,
    errors,
  );
  const name = expectNonEmptyString(obj.name, `${path}.name`, errors);
  const version =
    obj.version === undefined
      ? undefined
      : expectString(obj.version, `${path}.version`, errors);

  const source = validateModSource(obj.source, `${path}.source`, errors);
  const install = validateInstallSpec(
    obj.install,
    `${path}.install`,
    errors,
  );
  const state = validateInstallState(obj.state, `${path}.state`, errors);
  const attributes =
    obj.attributes === undefined
      ? undefined
      : validateUiAttributes(obj.attributes, `${path}.attributes`, errors);

  if (
    compareKey === undefined ||
    name === undefined ||
    source === undefined ||
    install === undefined ||
    state === undefined
  ) {
    return undefined;
  }

  // Discriminate after all sub-validators ran so we get every error in
  // one pass.
  if (source.kind === "nexus") {
    return {
      compareKey,
      name,
      ...(version !== undefined ? { version } : {}),
      install,
      state,
      ...(attributes !== undefined ? { attributes } : {}),
      source,
    };
  }
  return {
    compareKey,
    name,
    ...(version !== undefined ? { version } : {}),
    install,
    state,
    ...(attributes !== undefined ? { attributes } : {}),
    source,
  };
}

function validateModSource(
  raw: unknown,
  path: string,
  errors: string[],
): NexusModSource | ExternalModSource | undefined {
  if (!isObject(raw)) {
    errors.push(`${path} must be an object, got ${describe(raw)}.`);
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  const kind = obj.kind;

  if (kind === "nexus") return validateNexusSource(obj, path, errors);
  if (kind === "external") return validateExternalSource(obj, path, errors);

  errors.push(
    `${path}.kind must be "nexus" or "external", got ${describe(kind)}.`,
  );
  return undefined;
}

function validateNexusSource(
  obj: Record<string, unknown>,
  path: string,
  errors: string[],
): NexusModSource | undefined {
  const gameDomain = expectNonEmptyString(
    obj.gameDomain,
    `${path}.gameDomain`,
    errors,
  );
  const modId = expectPositiveInt(obj.modId, `${path}.modId`, errors);
  const fileId = expectPositiveInt(obj.fileId, `${path}.fileId`, errors);
  const archiveName = expectNonEmptyString(
    obj.archiveName,
    `${path}.archiveName`,
    errors,
  );
  const sha256 = expectSha256Hex(obj.sha256, `${path}.sha256`, errors);

  if (
    gameDomain === undefined ||
    modId === undefined ||
    fileId === undefined ||
    archiveName === undefined ||
    sha256 === undefined
  ) {
    return undefined;
  }

  return {
    kind: "nexus",
    gameDomain,
    modId,
    fileId,
    archiveName,
    sha256,
  };
}

function validateExternalSource(
  obj: Record<string, unknown>,
  path: string,
  errors: string[],
): ExternalModSource | undefined {
  const expectedFilename = expectNonEmptyString(
    obj.expectedFilename,
    `${path}.expectedFilename`,
    errors,
  );
  const sha256 = expectSha256Hex(obj.sha256, `${path}.sha256`, errors);
  const bundled = expectBoolean(obj.bundled, `${path}.bundled`, errors);
  const instructions =
    obj.instructions === undefined
      ? undefined
      : expectString(obj.instructions, `${path}.instructions`, errors);

  if (
    expectedFilename === undefined ||
    sha256 === undefined ||
    bundled === undefined
  ) {
    return undefined;
  }

  return {
    kind: "external",
    expectedFilename,
    sha256,
    bundled,
    ...(instructions !== undefined ? { instructions } : {}),
  };
}

function validateInstallSpec(
  raw: unknown,
  path: string,
  errors: string[],
): ModInstallSpec | undefined {
  if (!isObject(raw)) {
    errors.push(`${path} must be an object, got ${describe(raw)}.`);
    return undefined;
  }
  const obj = raw as Record<string, unknown>;

  const fomodSelections = validateFomodSelections(
    obj.fomodSelections,
    `${path}.fomodSelections`,
    errors,
  );
  const installerType =
    obj.installerType === undefined
      ? undefined
      : expectString(obj.installerType, `${path}.installerType`, errors);

  if (fomodSelections === undefined) return undefined;
  return {
    fomodSelections,
    ...(installerType !== undefined ? { installerType } : {}),
  };
}

function validateFomodSelections(
  raw: unknown,
  path: string,
  errors: string[],
): FomodSelectionStep[] | undefined {
  const arr = expectArray(raw, path, errors);
  if (arr === undefined) return undefined;

  const steps: FomodSelectionStep[] = [];
  arr.forEach((entry, i) => {
    if (!isObject(entry)) {
      errors.push(`${path}[${i}] must be an object, got ${describe(entry)}.`);
      return;
    }
    const step = entry as Record<string, unknown>;
    const name = expectString(step.name, `${path}[${i}].name`, errors);
    const groupsRaw = expectArray(step.groups, `${path}[${i}].groups`, errors);
    if (name === undefined || groupsRaw === undefined) return;

    const groups: FomodSelectionGroup[] = [];
    groupsRaw.forEach((groupEntry, j) => {
      const group = validateFomodGroup(
        groupEntry,
        `${path}[${i}].groups[${j}]`,
        errors,
      );
      if (group !== undefined) groups.push(group);
    });
    steps.push({ name, groups });
  });
  return steps;
}

function validateFomodGroup(
  raw: unknown,
  path: string,
  errors: string[],
): FomodSelectionGroup | undefined {
  if (!isObject(raw)) {
    errors.push(`${path} must be an object, got ${describe(raw)}.`);
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  const name = expectString(obj.name, `${path}.name`, errors);
  const choicesRaw = expectArray(obj.choices, `${path}.choices`, errors);
  if (name === undefined || choicesRaw === undefined) return undefined;

  const choices: FomodSelectedChoice[] = [];
  choicesRaw.forEach((choiceEntry, k) => {
    if (!isObject(choiceEntry)) {
      errors.push(
        `${path}.choices[${k}] must be an object, got ${describe(choiceEntry)}.`,
      );
      return;
    }
    const choiceObj = choiceEntry as Record<string, unknown>;
    const choiceName = expectString(
      choiceObj.name,
      `${path}.choices[${k}].name`,
      errors,
    );
    if (choiceName === undefined) return;
    const idx =
      choiceObj.idx === undefined
        ? undefined
        : expectInteger(choiceObj.idx, `${path}.choices[${k}].idx`, errors);
    choices.push({ name: choiceName, ...(idx !== undefined ? { idx } : {}) });
  });
  return { name, choices };
}

function validateInstallState(
  raw: unknown,
  path: string,
  errors: string[],
): ModInstallState | undefined {
  if (!isObject(raw)) {
    errors.push(`${path} must be an object, got ${describe(raw)}.`);
    return undefined;
  }
  const obj = raw as Record<string, unknown>;

  const enabled = expectBoolean(obj.enabled, `${path}.enabled`, errors);
  const installOrder = expectNonNegativeInt(
    obj.installOrder,
    `${path}.installOrder`,
    errors,
  );
  const deploymentPriority = expectNonNegativeInt(
    obj.deploymentPriority,
    `${path}.deploymentPriority`,
    errors,
  );
  const modType =
    obj.modType === undefined
      ? undefined
      : expectString(obj.modType, `${path}.modType`, errors);
  const fileOverrides =
    obj.fileOverrides === undefined
      ? undefined
      : expectStringArray(
          obj.fileOverrides,
          `${path}.fileOverrides`,
          errors,
        );
  const enabledINITweaks =
    obj.enabledINITweaks === undefined
      ? undefined
      : expectStringArray(
          obj.enabledINITweaks,
          `${path}.enabledINITweaks`,
          errors,
        );

  if (
    enabled === undefined ||
    installOrder === undefined ||
    deploymentPriority === undefined
  ) {
    return undefined;
  }

  return {
    enabled,
    installOrder,
    deploymentPriority,
    ...(modType !== undefined ? { modType } : {}),
    ...(fileOverrides !== undefined ? { fileOverrides } : {}),
    ...(enabledINITweaks !== undefined ? { enabledINITweaks } : {}),
  };
}

function validateUiAttributes(
  raw: unknown,
  path: string,
  errors: string[],
): ModUiAttributes | undefined {
  if (!isObject(raw)) {
    errors.push(`${path} must be an object, got ${describe(raw)}.`);
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  const category =
    obj.category === undefined
      ? undefined
      : expectString(obj.category, `${path}.category`, errors);
  const description =
    obj.description === undefined
      ? undefined
      : expectString(obj.description, `${path}.description`, errors);

  const out: ModUiAttributes = {};
  if (category !== undefined) out.category = category;
  if (description !== undefined) out.description = description;
  return out;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

function validateRules(
  raw: unknown,
  errors: string[],
): EhcollRule[] | undefined {
  const arr = expectArray(raw, "rules", errors);
  if (arr === undefined) return undefined;
  const rules: EhcollRule[] = [];
  arr.forEach((entry, i) => {
    const rule = validateRuleEntry(entry, `rules[${i}]`, errors);
    if (rule !== undefined) rules.push(rule);
  });
  return rules;
}

function validateRuleEntry(
  raw: unknown,
  path: string,
  errors: string[],
): EhcollRule | undefined {
  if (!isObject(raw)) {
    errors.push(`${path} must be an object, got ${describe(raw)}.`);
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  const source = expectNonEmptyString(obj.source, `${path}.source`, errors);
  const type = expectEnum(
    obj.type,
    RULE_TYPES,
    `${path}.type`,
    errors,
  ) as ModRuleType | undefined;
  const reference = expectNonEmptyString(
    obj.reference,
    `${path}.reference`,
    errors,
  );
  const comment =
    obj.comment === undefined
      ? undefined
      : expectString(obj.comment, `${path}.comment`, errors);
  const ignored =
    obj.ignored === undefined
      ? undefined
      : expectBoolean(obj.ignored, `${path}.ignored`, errors);

  if (source === undefined || type === undefined || reference === undefined) {
    return undefined;
  }
  return {
    source,
    type,
    reference,
    ...(comment !== undefined ? { comment } : {}),
    ...(ignored !== undefined ? { ignored } : {}),
  };
}

// ---------------------------------------------------------------------------
// File overrides
// ---------------------------------------------------------------------------

function validateFileOverrides(
  raw: unknown,
  errors: string[],
): EhcollFileOverride[] | undefined {
  const arr = expectArray(raw, "fileOverrides", errors);
  if (arr === undefined) return undefined;
  const overrides: EhcollFileOverride[] = [];
  arr.forEach((entry, i) => {
    const override = validateFileOverrideEntry(
      entry,
      `fileOverrides[${i}]`,
      errors,
    );
    if (override !== undefined) overrides.push(override);
  });
  return overrides;
}

function validateFileOverrideEntry(
  raw: unknown,
  path: string,
  errors: string[],
): EhcollFileOverride | undefined {
  if (!isObject(raw)) {
    errors.push(`${path} must be an object, got ${describe(raw)}.`);
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  const filePath = expectNonEmptyString(
    obj.filePath,
    `${path}.filePath`,
    errors,
  );
  const winningMod = expectNonEmptyString(
    obj.winningMod,
    `${path}.winningMod`,
    errors,
  );
  const losingMods = expectStringArray(
    obj.losingMods,
    `${path}.losingMods`,
    errors,
  );

  if (filePath === undefined || winningMod === undefined || losingMods === undefined) {
    return undefined;
  }
  return { filePath, winningMod, losingMods };
}

// ---------------------------------------------------------------------------
// Plugins
// ---------------------------------------------------------------------------

function validatePlugins(
  raw: unknown,
  errors: string[],
): { order: EhcollPluginEntry[] } | undefined {
  if (!isObject(raw)) {
    errors.push(`plugins must be an object, got ${describe(raw)}.`);
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  const orderRaw = expectArray(obj.order, "plugins.order", errors);
  if (orderRaw === undefined) return undefined;

  const order: EhcollPluginEntry[] = [];
  orderRaw.forEach((entry, i) => {
    if (!isObject(entry)) {
      errors.push(
        `plugins.order[${i}] must be an object, got ${describe(entry)}.`,
      );
      return;
    }
    const e = entry as Record<string, unknown>;
    const name = expectNonEmptyString(e.name, `plugins.order[${i}].name`, errors);
    const enabled = expectBoolean(
      e.enabled,
      `plugins.order[${i}].enabled`,
      errors,
    );
    if (name === undefined || enabled === undefined) return;
    order.push({ name, enabled });
  });
  return { order };
}

// ---------------------------------------------------------------------------
// INI tweaks (placeholder until Phase 5)
// ---------------------------------------------------------------------------

function validateIniTweaks(
  raw: unknown,
  errors: string[],
): EhcollIniTweak[] | undefined {
  const arr = expectArray(raw, "iniTweaks", errors);
  if (arr === undefined) return undefined;
  const tweaks: EhcollIniTweak[] = [];
  arr.forEach((entry, i) => {
    if (!isObject(entry)) {
      errors.push(`iniTweaks[${i}] must be an object, got ${describe(entry)}.`);
      return;
    }
    const obj = entry as Record<string, unknown>;
    const ini = expectNonEmptyString(obj.ini, `iniTweaks[${i}].ini`, errors);
    const section = expectString(
      obj.section,
      `iniTweaks[${i}].section`,
      errors,
    );
    const key = expectNonEmptyString(obj.key, `iniTweaks[${i}].key`, errors);
    const value = expectString(obj.value, `iniTweaks[${i}].value`, errors);
    if (
      ini === undefined ||
      section === undefined ||
      key === undefined ||
      value === undefined
    ) {
      return;
    }
    tweaks.push({ ini, section, key, value });
  });
  return tweaks;
}

// ---------------------------------------------------------------------------
// External dependencies
// ---------------------------------------------------------------------------

function validateExternalDependencies(
  raw: unknown,
  errors: string[],
): EhcollExternalDependency[] | undefined {
  const arr = expectArray(raw, "externalDependencies", errors);
  if (arr === undefined) return undefined;
  const deps: EhcollExternalDependency[] = [];
  arr.forEach((entry, i) => {
    const dep = validateExternalDependency(
      entry,
      `externalDependencies[${i}]`,
      errors,
    );
    if (dep !== undefined) deps.push(dep);
  });
  return deps;
}

function validateExternalDependency(
  raw: unknown,
  path: string,
  errors: string[],
): EhcollExternalDependency | undefined {
  if (!isObject(raw)) {
    errors.push(`${path} must be an object, got ${describe(raw)}.`);
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  const id = expectNonEmptyString(obj.id, `${path}.id`, errors);
  const name = expectNonEmptyString(obj.name, `${path}.name`, errors);
  const category = expectNonEmptyString(
    obj.category,
    `${path}.category`,
    errors,
  );
  const version = expectString(obj.version, `${path}.version`, errors);
  const destination = expectEnum(
    obj.destination,
    EXTERNAL_DEP_DESTINATIONS,
    `${path}.destination`,
    errors,
  ) as ExternalDependencyDestination | undefined;
  const filesRaw = expectArray(obj.files, `${path}.files`, errors);
  const instructions = expectNonEmptyString(
    obj.instructions,
    `${path}.instructions`,
    errors,
  );
  const instructionsUrl =
    obj.instructionsUrl === undefined
      ? undefined
      : expectString(obj.instructionsUrl, `${path}.instructionsUrl`, errors);

  let files: ExternalDependencyFile[] | undefined;
  if (filesRaw !== undefined) {
    files = [];
    filesRaw.forEach((fileEntry, i) => {
      const file = validateExternalDependencyFile(
        fileEntry,
        `${path}.files[${i}]`,
        errors,
      );
      if (file !== undefined) files!.push(file);
    });
  }

  if (
    id === undefined ||
    name === undefined ||
    category === undefined ||
    version === undefined ||
    destination === undefined ||
    files === undefined ||
    instructions === undefined
  ) {
    return undefined;
  }

  return {
    id,
    name,
    category,
    version,
    destination,
    files,
    instructions,
    ...(instructionsUrl !== undefined ? { instructionsUrl } : {}),
  };
}

function validateExternalDependencyFile(
  raw: unknown,
  path: string,
  errors: string[],
): ExternalDependencyFile | undefined {
  if (!isObject(raw)) {
    errors.push(`${path} must be an object, got ${describe(raw)}.`);
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  const relPath = expectNonEmptyString(obj.relPath, `${path}.relPath`, errors);
  const sha256 = expectSha256Hex(obj.sha256, `${path}.sha256`, errors);
  if (relPath === undefined || sha256 === undefined) return undefined;
  return { relPath, sha256 };
}

// ---------------------------------------------------------------------------
// Cross-reference validation (warnings only)
// ---------------------------------------------------------------------------

function crossReferenceValidate(
  parts: {
    mods: EhcollMod[];
    rules: EhcollRule[];
    fileOverrides: EhcollFileOverride[];
  },
  warnings: string[],
): void {
  const compareKeys = new Set(parts.mods.map((m) => m.compareKey));
  const externalSha256Counts = new Map<string, string[]>();

  // Bundled flag must only ever be true for external mods. The
  // discriminated union makes this a static guarantee at the type
  // level, but a hand-edited manifest could violate it.
  for (const mod of parts.mods) {
    if (mod.source.kind === "external") {
      const list = externalSha256Counts.get(mod.source.sha256) ?? [];
      list.push(mod.compareKey);
      externalSha256Counts.set(mod.source.sha256, list);
    }
  }
  for (const [sha, keys] of externalSha256Counts) {
    if (keys.length > 1) {
      warnings.push(
        `External mods ${keys.map((k) => `"${k}"`).join(", ")} share the ` +
          `same archiveSha256 (${sha.slice(0, 12)}…). The package can only ` +
          `bundle the archive once; the resolver will install both pointing ` +
          `at the same bytes. Likely a curator dedupe oversight.`,
      );
    }
  }

  // Rule references — both source and reference may resolve to a mod.
  for (let i = 0; i < parts.rules.length; i++) {
    const rule = parts.rules[i]!;
    if (!compareKeys.has(rule.source)) {
      warnings.push(
        `rules[${i}].source "${rule.source}" does not match any mod's ` +
          `compareKey. The rule will be skipped at install time.`,
      );
    }
    // `reference` may be a partially-pinned key like "nexus:1234". We
    // only warn when the reference is fully-pinned AND not present.
    if (
      isFullyPinnedReference(rule.reference) &&
      !compareKeys.has(rule.reference)
    ) {
      warnings.push(
        `rules[${i}].reference "${rule.reference}" does not match any mod's ` +
          `compareKey. The rule's target may resolve via partial pin at ` +
          `install time, or be unenforceable.`,
      );
    }
  }

  // File-override references.
  for (let i = 0; i < parts.fileOverrides.length; i++) {
    const fo = parts.fileOverrides[i]!;
    if (!compareKeys.has(fo.winningMod)) {
      warnings.push(
        `fileOverrides[${i}].winningMod "${fo.winningMod}" does not match ` +
          `any mod's compareKey. The override will be ignored at install time.`,
      );
    }
    fo.losingMods.forEach((loser, j) => {
      if (!compareKeys.has(loser)) {
        warnings.push(
          `fileOverrides[${i}].losingMods[${j}] "${loser}" does not match ` +
            `any mod's compareKey. The loser is informational only and won't ` +
            `block the install.`,
        );
      }
    });
  }
}

/**
 * A reference is "fully pinned" when it specifies enough information
 * to match exactly one mod. Heuristic: `nexus:<modId>:<fileId>` is fully
 * pinned (3 colon-separated segments); `nexus:<modId>` is partial.
 * `external:<sha256>` is fully pinned. `archive:<id>` is fully pinned.
 */
function isFullyPinnedReference(reference: string): boolean {
  if (reference.startsWith("nexus:")) {
    return reference.split(":").length === 3;
  }
  // external: / archive: / id: are all single-segment-after-prefix.
  return /^(external|archive|id):/.test(reference);
}

// ---------------------------------------------------------------------------
// JSON parsing helper
// ---------------------------------------------------------------------------

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new ParseManifestError([
      `manifest.json is not valid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    ]);
  }
}

// ---------------------------------------------------------------------------
// Type-narrowing helpers (return value or undefined; push errors)
// ---------------------------------------------------------------------------

function expectString(
  raw: unknown,
  path: string,
  errors: string[],
): string | undefined {
  if (typeof raw === "string") return raw;
  errors.push(`${path} must be a string, got ${describe(raw)}.`);
  return undefined;
}

function expectNonEmptyString(
  raw: unknown,
  path: string,
  errors: string[],
): string | undefined {
  const s = expectString(raw, path, errors);
  if (s === undefined) return undefined;
  if (s.length === 0) {
    errors.push(`${path} cannot be empty.`);
    return undefined;
  }
  return s;
}

function expectBoolean(
  raw: unknown,
  path: string,
  errors: string[],
): boolean | undefined {
  if (typeof raw === "boolean") return raw;
  errors.push(`${path} must be a boolean, got ${describe(raw)}.`);
  return undefined;
}

function expectInteger(
  raw: unknown,
  path: string,
  errors: string[],
): number | undefined {
  if (typeof raw === "number" && Number.isInteger(raw)) return raw;
  errors.push(`${path} must be an integer, got ${describe(raw)}.`);
  return undefined;
}

function expectNonNegativeInt(
  raw: unknown,
  path: string,
  errors: string[],
): number | undefined {
  const n = expectInteger(raw, path, errors);
  if (n === undefined) return undefined;
  if (n < 0) {
    errors.push(`${path} must be ≥ 0, got ${n}.`);
    return undefined;
  }
  return n;
}

function expectPositiveInt(
  raw: unknown,
  path: string,
  errors: string[],
): number | undefined {
  const n = expectInteger(raw, path, errors);
  if (n === undefined) return undefined;
  if (n <= 0) {
    errors.push(`${path} must be > 0, got ${n}.`);
    return undefined;
  }
  return n;
}

function expectArray(
  raw: unknown,
  path: string,
  errors: string[],
): unknown[] | undefined {
  if (Array.isArray(raw)) return raw;
  errors.push(`${path} must be an array, got ${describe(raw)}.`);
  return undefined;
}

function expectStringArray(
  raw: unknown,
  path: string,
  errors: string[],
): string[] | undefined {
  const arr = expectArray(raw, path, errors);
  if (arr === undefined) return undefined;
  const out: string[] = [];
  let ok = true;
  arr.forEach((v, i) => {
    if (typeof v !== "string") {
      errors.push(`${path}[${i}] must be a string, got ${describe(v)}.`);
      ok = false;
      return;
    }
    out.push(v);
  });
  return ok ? out : undefined;
}

function expectEnum<T extends string>(
  raw: unknown,
  allowed: ReadonlySet<T>,
  path: string,
  errors: string[],
): T | undefined {
  if (typeof raw === "string" && allowed.has(raw as T)) return raw as T;
  errors.push(
    `${path} must be one of ${Array.from(allowed)
      .map((v) => `"${v}"`)
      .join(", ")}; got ${describe(raw)}.`,
  );
  return undefined;
}

function expectUuid(
  raw: unknown,
  path: string,
  errors: string[],
): string | undefined {
  const s = expectString(raw, path, errors);
  if (s === undefined) return undefined;
  // Accept any RFC 4122 UUID (v1/v4/v5 — version digit not enforced).
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  ) {
    errors.push(`${path} must be a UUID string, got ${JSON.stringify(s)}.`);
    return undefined;
  }
  return s;
}

function expectSha256Hex(
  raw: unknown,
  path: string,
  errors: string[],
): string | undefined {
  const s = expectString(raw, path, errors);
  if (s === undefined) return undefined;
  if (!/^[0-9a-f]{64}$/.test(s)) {
    errors.push(
      `${path} must be a lowercase 64-character hex SHA-256, got ${JSON.stringify(
        s,
      )}.`,
    );
    return undefined;
  }
  return s;
}

function expectIso8601(
  raw: unknown,
  path: string,
  errors: string[],
): string | undefined {
  const s = expectString(raw, path, errors);
  if (s === undefined) return undefined;
  // We accept anything Date can parse to a finite number — the spec
  // says ISO-8601 UTC but we don't want to be stricter than the
  // builtin parser, since `Date.toISOString()` (what the producer
  // emits) round-trips cleanly.
  const t = Date.parse(s);
  if (!Number.isFinite(t)) {
    errors.push(
      `${path} must be an ISO-8601 timestamp, got ${JSON.stringify(s)}.`,
    );
    return undefined;
  }
  return s;
}

function expectSemver(
  raw: unknown,
  path: string,
  errors: string[],
): string | undefined {
  const s = expectString(raw, path, errors);
  if (s === undefined) return undefined;
  // Lightweight check, same shape the action handler enforces. Strict
  // semver compatibility checking is the resolver's job.
  if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/.test(s)) {
    errors.push(
      `${path} must be a semver string (e.g. "1.0.0" or "1.0.0-beta.1"), ` +
        `got ${JSON.stringify(s)}.`,
    );
    return undefined;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value === undefined) return "undefined";
  return typeof value;
}
