import { selectors } from "vortex-api";
import type { types } from "vortex-api";

export type FomodSelectedChoice = {
  name: string;
  idx?: number;
};

export type FomodSelectionGroup = {
  name: string;
  choices: FomodSelectedChoice[];
};

export type FomodSelectionStep = {
  name: string;
  groups: FomodSelectionGroup[];
};

/**
 * Normalized identity of the *target* of a mod rule.
 *
 * Vortex's `IModReference` exposes many overlapping ways to identify a mod
 * (Nexus repo pin, archive id, file hashes, filename glob, version match,
 * arbitrary tags). We capture all of them, in a flat shape, so a future
 * installer/reconciler can pick the strongest available pin per machine.
 *
 * Fields are documented in priority order — most-portable first.
 */
export type CapturedRuleReference = {
  /** Nexus mod id from `reference.repo.modId`. Cross-machine portable. */
  nexusModId?: string;
  /** Nexus file id from `reference.repo.fileId`. Cross-machine portable. */
  nexusFileId?: string;
  /** Nexus game domain from `reference.repo.gameId`. */
  nexusGameId?: string;
  /** Archive MD5 (`reference.fileMD5`). Vortex's own hash. */
  fileMD5?: string;
  /** MD5 hint (`reference.md5Hint`) — partial / heuristic match. */
  md5Hint?: string;
  /** Local archive id (`reference.archiveId`). Stable per Vortex install. */
  archiveId?: string;
  /** Human-readable filename match (`reference.logicalFileName`). */
  logicalFileName?: string;
  /** Glob/regex on filename (`reference.fileExpression`). */
  fileExpression?: string;
  /** Version constraint expression (`reference.versionMatch`). */
  versionMatch?: string;
  /** Opaque tag (`reference.tag`). */
  tag?: string;
  /** Vortex internal mod id (`reference.id`). Local-only, lowest priority. */
  id?: string;
};

export type CapturedModRule = {
  /**
   * Rule kind. Vortex defines: "before", "after", "requires", "recommends",
   * "conflicts", "provides". We do not validate — whatever Vortex stores
   * passes through, stringified.
   */
  type: string;
  reference: CapturedRuleReference;
  /** Curator's note about why this rule exists, when present. */
  comment?: string;
  /** True iff the user/Vortex disabled this rule but kept it on the mod. */
  ignored?: boolean;
};

export type AuditorMod = {
  id: string;
  name: string;
  version?: string;
  enabled: boolean;
  source?: string;
  nexusModId?: number | string;
  nexusFileId?: number | string;
  archiveId?: string;
  collectionIds?: string[];

  installerType?: string;
  hasInstallerChoices: boolean;
  hasDetailedInstallerChoices: boolean;

  /**
   * SHA-256 of the source archive file on disk, when resolvable.
   * Populated by `enrichModsWithArchiveHashes` (archiveHashing.ts).
   * Used to detect "same Nexus IDs, different bytes" drift.
   */
  archiveSha256?: string;

  /**
   * Captured mod rules from `mod.rules` in Vortex state. Sorted canonically
   * for stable cross-machine diffs (add-order is not meaningful in Vortex).
   * Empty array when the mod has no rules. Never undefined.
   *
   * See docs/business/MOD_RULES_CAPTURE.md for full semantics.
   */
  rules: CapturedModRule[];

  /**
   * Mod type as Vortex categorizes it. Empty string for the default modtype.
   * Examples: "" (default), "collection", "dinput", "enb", game-specific.
   * Used to enumerate per-modtype deployment manifests during capture.
   */
  modType: string;

  /**
   * File-level overrides set on this mod via Vortex's conflict-resolution UI.
   * Each entry is a relative path Vortex was instructed to deploy from THIS
   * mod even when other mods also provide the file.
   *
   * Sorted alphabetically for stable diffs. Empty array when the mod has no
   * explicit overrides set.
   *
   * See docs/business/FILE_OVERRIDES_CAPTURE.md.
   */
  fileOverrides: string[];

  /**
   * INI tweak filenames the curator explicitly enabled on this mod.
   * Sorted alphabetically. Empty array when no tweaks are enabled.
   */
  enabledINITweaks: string[];

  /**
   * Curator's `mod.attributes.installTime` normalized to an ISO-8601 string
   * in UTC. Undefined when the attribute is missing or unparseable. Used as
   * the input signal for `installOrder` and as the fallback tiebreaker for
   * deployment priority when no rule applies between two mods.
   *
   * See docs/business/ORDERING.md for full semantics.
   */
  installTime?: string;

  /**
   * Stable ordinal of this mod in the active profile's install sequence,
   * 0-indexed. Computed by `getModsForProfile` after walking all mods and
   * sorting by `installTime` ascending; mods missing `installTime` are
   * pushed to the end with a stable secondary sort by `id` so the ordinal
   * is deterministic across runs.
   *
   * Always present. Never negative.
   */
  installOrder: number;

  /**
   * FOMOD selected options grouped by installer step/page.
   *
   * Example:
   * [
   *   {
   *     name: "Animations Support",
   *     groups: [
   *       {
   *         name: "Select Your Anims",
   *         choices: [
   *           { name: "Atomic Lust", idx: 1 },
   *           { name: "BP70 Animation Pack", idx: 2 }
   *         ]
   *       }
   *     ]
   *   }
   * ]
   */
  fomodSelections: FomodSelectionStep[];

  /**
   * Vortex's `installationPath` for this mod — relative to
   * `selectors.installPathForGame(state, gameId)`. Captured at audit
   * time so {@link captureStagingFiles} can locate the on-disk staging
   * folder without re-querying state. Optional because legacy mod
   * records may not have one set.
   */
  installationPath?: string;

  /**
   * Snapshot of the curator's staging folder for this mod, populated
   * by {@link captureStagingFiles} during build (NOT during snapshot
   * export). Drives the user-side {@link verifyModInstall} integrity
   * check.
   *
   * Optional — present only when:
   *   1. The build was run with `verificationLevel !== "none"`, AND
   *   2. The mod's `installationPath` resolved to a real directory.
   *
   * The diff/comparison side of the codebase (`compareMods`) does
   * NOT diff this field — it's an output of build, not a property of
   * the mod's identity.
   */
  stagingFiles?: import("../types/ehcoll").EhcollStagingFile[];

  /**
   * Deterministic SHA-256 over this mod's deployed staging folder
   * file set. Populated by `enrichInstalledModsWithStagingSetHashes`
   * on the user side (action handler) for installed mods whose name
   * matches an external manifest mod that carries a `stagingSetHash`.
   *
   * Used as the fallback identity oracle for archive-less external
   * mods (Vortex didn't retain the archive). The resolver's
   * `findInstalledByStagingSetHash` reads this through the
   * `InstalledMod` projection.
   *
   * Build-time `captureStagingFiles` does NOT populate this — it
   * populates `stagingFiles` and the manifest builder derives the
   * hash from there.
   */
  stagingSetHash?: string;
};

export function getActiveGameId(state: types.IState): string | undefined {
  const id = selectors.activeGameId(state);
  return id?.length ? id : undefined;
}

export function getActiveProfileId(state: types.IState): string | undefined {
  const gameId = getActiveGameId(state);

  if (!gameId) {
    return undefined;
  }

  return getActiveProfileIdFromState(state, gameId);
}

export function getActiveProfileIdFromState(
  state: types.IState | any,
  gameId: string,
): string | undefined {
  const profiles = state?.persistent?.profiles ?? {};

  for (const [profileId, profile] of Object.entries(profiles)) {
    const p = profile as any;

    if (p?.gameId === gameId && p?.active === true) {
      return profileId;
    }
  }

  for (const [profileId, profile] of Object.entries(profiles)) {
    const p = profile as any;

    if (p?.gameId === gameId) {
      return profileId;
    }
  }

  return undefined;
}

function pickInstallerChoices(attributes: Record<string, unknown>): any {
  return (
    attributes.installerChoices ??
    attributes.installerChoicesData ??
    attributes.fomodChoices ??
    attributes.fomod ??
    attributes.choices ??
    attributes.installChoices ??
    attributes.installerOptions ??
    undefined
  );
}

function normalizeCollectionIds(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map(String);
  }

  return [String(value)];
}

/**
 * Normalize Vortex's `installTime` attribute (which can be a Date, an
 * ISO-8601 string, an arbitrary date string, or — rarely — a unix-millis
 * number stringified) into a canonical ISO-8601 UTC string.
 *
 * Returns undefined when:
 *   - The attribute is missing.
 *   - Parsing produces an invalid Date (NaN getTime).
 *
 * We deliberately re-stringify even already-ISO-formatted inputs so that
 * cross-machine diffs cannot be confused by timezone-suffix variations
 * (e.g. "+00:00" vs "Z").
 */
function normalizeInstallTime(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }

  let date: Date;

  if (raw instanceof Date) {
    date = raw;
  } else if (typeof raw === "string" || typeof raw === "number") {
    date = new Date(raw);
  } else {
    return undefined;
  }

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

/**
 * Normalize an array of strings: drop non-strings and empties, dedupe,
 * sort alphabetically for stable cross-machine diffs.
 */
function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  for (const entry of value) {
    if (typeof entry === "string" && entry.length > 0) {
      seen.add(entry);
    }
  }

  return Array.from(seen).sort();
}

function normalizeFomodSelections(installerChoices: any): FomodSelectionStep[] {
  const options = installerChoices?.options;

  if (!Array.isArray(options)) {
    return [];
  }

  return options.map((step: any): FomodSelectionStep => {
    const groups = Array.isArray(step?.groups) ? step.groups : [];

    return {
      name: String(step?.name ?? ""),
      groups: groups.map((group: any): FomodSelectionGroup => {
        const choices = Array.isArray(group?.choices) ? group.choices : [];

        return {
          name: String(group?.name ?? ""),
          choices: choices.map((choice: any): FomodSelectedChoice => {
            const normalizedChoice: FomodSelectedChoice = {
              name: String(choice?.name ?? ""),
            };

            if (choice?.idx !== undefined && choice?.idx !== null) {
              normalizedChoice.idx = Number(choice.idx);
            }

            return normalizedChoice;
          }),
        };
      }),
    };
  });
}

function hasAnySelectedFomodChoices(steps: FomodSelectionStep[]): boolean {
  return steps.some((step) =>
    step.groups.some((group) => group.choices.length > 0),
  );
}

/**
 * Normalize a single Vortex `IModRule.reference` into our flat capture shape.
 *
 * The input shape (from `modmeta-db`'s `IReference` plus Vortex's
 * `IModReference` extension) is union-typed and many fields are optional —
 * we copy whichever ones are present and stringify Nexus repo ids so that
 * downstream JSON comparison doesn't false-positive on number-vs-string.
 */
function normalizeRuleReference(reference: any): CapturedRuleReference {
  const out: CapturedRuleReference = {};

  const repo = reference?.repo;
  if (repo) {
    if (repo.modId !== undefined && repo.modId !== null) {
      out.nexusModId = String(repo.modId);
    }
    if (repo.fileId !== undefined && repo.fileId !== null) {
      out.nexusFileId = String(repo.fileId);
    }
    if (repo.gameId !== undefined && repo.gameId !== null) {
      out.nexusGameId = String(repo.gameId);
    }
  }

  if (reference?.fileMD5) out.fileMD5 = String(reference.fileMD5);
  if (reference?.md5Hint) out.md5Hint = String(reference.md5Hint);
  if (reference?.archiveId) out.archiveId = String(reference.archiveId);
  if (reference?.logicalFileName) {
    out.logicalFileName = String(reference.logicalFileName);
  }
  if (reference?.fileExpression) {
    out.fileExpression = String(reference.fileExpression);
  }
  if (reference?.versionMatch) {
    out.versionMatch = String(reference.versionMatch);
  }
  if (reference?.tag) out.tag = String(reference.tag);
  if (reference?.id) out.id = String(reference.id);

  return out;
}

/**
 * Stable sort key for a captured rule. JSON-stringifying our own captured
 * shape works because we always emit fields in the same order — the only
 * variability is in *which* fields are present, not their position.
 */
function rulesSortKey(rule: CapturedModRule): string {
  return JSON.stringify(rule);
}

/**
 * Capture and canonicalize `mod.rules`. We:
 *   1. Tolerate non-array / missing input → empty array.
 *   2. Skip rule entries whose `type` cannot be stringified.
 *   3. Sort the result deterministically so two snapshots representing the
 *      same logical rule set diff cleanly regardless of add-order.
 */
function normalizeModRules(rules: unknown): CapturedModRule[] {
  if (!Array.isArray(rules)) {
    return [];
  }

  const captured: CapturedModRule[] = [];

  for (const rawRule of rules) {
    const rule = rawRule as any;

    if (rule?.type === undefined || rule?.type === null) {
      continue;
    }

    const captured1: CapturedModRule = {
      type: String(rule.type),
      reference: normalizeRuleReference(rule?.reference),
    };

    if (typeof rule.comment === "string" && rule.comment.length > 0) {
      captured1.comment = rule.comment;
    }

    if (rule.ignored === true) {
      captured1.ignored = true;
    }

    captured.push(captured1);
  }

  captured.sort((a, b) => {
    const ka = rulesSortKey(a);
    const kb = rulesSortKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  return captured;
}

export function getModsForProfile(
  state: types.IState,
  gameId: string,
  profileId: string,
): AuditorMod[] {
  const modsByGame = (state as any)?.persistent?.mods?.[gameId] ?? {};
  const profile = (state as any)?.persistent?.profiles?.[profileId];

  const enabledMods = profile?.modState ?? {};

  const mods: AuditorMod[] = Object.entries(modsByGame).map(([modId, rawMod]) => {
    const mod = rawMod as any;
    const attributes = (mod?.attributes ?? {}) as Record<string, unknown>;

    const installerChoices = pickInstallerChoices(attributes);
    const fomodSelections = normalizeFomodSelections(installerChoices);

    const rules = normalizeModRules(mod?.rules);

    const rawCollectionIds =
      attributes.collectionIds ??
      attributes.collections ??
      attributes.collection;

    return {
      id: modId,
      name: String(attributes.name ?? mod?.id ?? modId),
      version:
        attributes.version !== undefined
          ? String(attributes.version)
          : undefined,
      enabled: enabledMods?.[modId]?.enabled === true,
      source:
        attributes.source !== undefined ? String(attributes.source) : undefined,
      nexusModId:
        (attributes.modId as string | number | undefined) ??
        (attributes.nexusId as string | number | undefined),
      nexusFileId: attributes.fileId as string | number | undefined,
      archiveId: mod?.archiveId,
      collectionIds: normalizeCollectionIds(rawCollectionIds),

      installerType:
        installerChoices?.type !== undefined
          ? String(installerChoices.type)
          : undefined,
      hasInstallerChoices: installerChoices !== undefined,
      hasDetailedInstallerChoices: hasAnySelectedFomodChoices(fomodSelections),
      fomodSelections,
      rules,
      modType: typeof mod?.type === "string" ? mod.type : "",
      fileOverrides: normalizeStringArray(mod?.fileOverrides),
      enabledINITweaks: normalizeStringArray(mod?.enabledINITweaks),
      installTime: normalizeInstallTime(attributes.installTime),
      installOrder: 0,
      installationPath:
        typeof mod?.installationPath === "string" &&
        mod.installationPath.length > 0
          ? mod.installationPath
          : undefined,
    };
  });

  assignInstallOrder(mods);

  return mods;
}

/**
 * Assigns a deterministic 0-indexed `installOrder` to each mod, in place.
 *
 * Sort key precedence (ascending):
 *   1. `installTime` parsed as Date — earliest first. Mods missing or with
 *      unparseable `installTime` sort AFTER all timestamped mods.
 *   2. Within either bucket, ties broken by `id` ASCII compare so the
 *      ordinal is stable across runs.
 *
 * The function mutates the input array's elements (assigns `installOrder`)
 * but does not re-sort the array itself — callers receive mods in the same
 * iteration order as `Object.entries(modsByGame)` produced.
 */
function assignInstallOrder(mods: AuditorMod[]): void {
  const indexed = mods.map((mod, idx) => {
    const ts = mod.installTime ? Date.parse(mod.installTime) : NaN;
    return { idx, mod, ts };
  });

  indexed.sort((a, b) => {
    const aHas = !Number.isNaN(a.ts);
    const bHas = !Number.isNaN(b.ts);

    if (aHas && bHas) {
      if (a.ts !== b.ts) return a.ts - b.ts;
    } else if (aHas !== bHas) {
      return aHas ? -1 : 1;
    }

    return a.mod.id < b.mod.id ? -1 : a.mod.id > b.mod.id ? 1 : 0;
  });

  for (let ord = 0; ord < indexed.length; ord += 1) {
    indexed[ord].mod.installOrder = ord;
  }
}
