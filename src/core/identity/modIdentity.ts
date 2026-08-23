/**
 * Universal, source-agnostic mod identity + matching (compare-first).
 *
 * The legacy compare path keyed every mod by a single string
 * (`getModCompareKey`) whose non-Nexus fallbacks (`archive:<archiveId>`,
 * `id:<mod.id>`) are MACHINE-LOCAL. The same LoversLab / manual mod gets
 * a different key on each machine, so it shows up as missing on one side
 * AND extra on the other (a "false split"), and byte-drift signal is lost
 * in machine-local noise.
 *
 * This module matches two mod lists with a strongest-first ladder that
 * works regardless of `source`:
 *
 *   1. nexus-file          modId + fileId equal           (portable, 1.0)
 *   2. archive-sha         archiveSha256 equal            (byte-identical, 1.0)
 *   3. staging-set         stagingSetHash equal           (deployed-set identical, 1.0)
 *   4. nexus-mod           same modId, different fileId   (version drift, 0.95)
 *   5. fuzzy-name-version  normalized name + version      (0.9)
 *   6. fuzzy-name          normalized name, version diff  (0.75)
 *   7. fuzzy-similar       token-set Dice >= threshold    (score)
 *
 * Auto-merge happens for any tier whose confidence is >= `fuzzyThreshold`
 * (default 0.7). SAFETY: matching is greedy strongest-first and every mod
 * is consumed at most once; the fuzzy tiers require a 1:1 candidate, so
 * two genuinely different mods that happen to share a normalized key are
 * left UNMATCHED rather than silently merged.
 *
 * Pure: no I/O, no clocks, no Vortex API. The compare path
 * (`src/utils/utils.ts`) consumes `matchSnapshots`; the installer
 * resolver can adopt it later.
 */

import type { AuditorMod } from "../getModsListForProfile";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MatchTier =
  | "nexus-file"
  | "archive-sha"
  | "staging-set"
  | "nexus-mod"
  | "fuzzy-name-version"
  | "fuzzy-name"
  | "fuzzy-similar";

/**
 * Baseline confidence for each tier. `fuzzy-similar` is special — its
 * confidence is the per-pair Dice score, so the table value is only a
 * lower bound used for gating against `fuzzyThreshold`.
 */
export const TIER_CONFIDENCE: Record<MatchTier, number> = {
  "nexus-file": 1.0,
  "archive-sha": 1.0,
  "staging-set": 1.0,
  "nexus-mod": 0.95,
  "fuzzy-name-version": 0.9,
  "fuzzy-name": 0.75,
  "fuzzy-similar": 0.7,
};

/** Human-readable label for a tier, for UI badges. */
export const TIER_LABEL: Record<MatchTier, string> = {
  "nexus-file": "Nexus mod + file id",
  "archive-sha": "identical archive bytes",
  "staging-set": "identical deployed files",
  "nexus-mod": "same Nexus mod, different file",
  "fuzzy-name-version": "name + version",
  "fuzzy-name": "name (version differs)",
  "fuzzy-similar": "similar name",
};

export type ModMatch = {
  reference: AuditorMod;
  current: AuditorMod;
  tier: MatchTier;
  /** 0..1. For fuzzy-similar this is the Dice score. */
  confidence: number;
};

export type MatchSnapshotsResult = {
  matches: ModMatch[];
  onlyInReference: AuditorMod[];
  onlyInCurrent: AuditorMod[];
};

export type MatchOptions = {
  /**
   * Minimum confidence for a fuzzy match to be accepted (auto-merged).
   * Tiers whose baseline confidence is below this are skipped entirely.
   * Default 0.7 — admits `fuzzy-name-version` (0.9) and `fuzzy-name`
   * (0.75) but lets callers tighten to "hash-only" by passing > 0.95.
   */
  fuzzyThreshold?: number;
  /**
   * Whether to run the final token-set similarity tier. Default true.
   * The similarity tier only accepts MUTUAL best matches at or above
   * `similarityThreshold`, so it cannot merge unrelated mods.
   */
  enableSimilarity?: boolean;
  /** Dice-coefficient cutoff for the similarity tier. Default 0.85. */
  similarityThreshold?: number;
};

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Lowercase a version string and strip cosmetic noise so `"V1.1.1"`,
 * `"v.1.1.1"` and `"1-1-1"` compare equal. Returns "" for missing input.
 */
export function normalizeVersion(version: string | undefined | null): string {
  if (version === undefined || version === null) return "";
  return version
    .toString()
    .trim()
    .toLowerCase()
    .replace(/^v\.?/, "")
    .replace(/[\s_+\-]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

/**
 * Strip the Vortex install pin that Vortex appends to a mod id/name:
 *
 *   "<DisplayName>-<modId>-<dashed version>-<install timestamp>"
 *   e.g. "...-63246-1-15-1681659565"  /  "...-59699-4-0-1763010335"
 *
 * We only strip when the tail starts with `-<4+ digits>` (a Nexus modId
 * or a long install timestamp), and never strip the whole string.
 */
function stripVortexPin(raw: string): string {
  const stripped = raw.replace(/-\d{4,}(?:-[0-9a-z.]+)*$/i, "");
  return stripped.length > 0 ? stripped : raw;
}

/**
 * Remove version-like tokens from a name so two versions of the same mod
 * whose name embeds the version (e.g. "AAF_SEU_V1.19" vs "AAF_SEU_V1.20")
 * collapse to the same core.
 */
function stripVersionTokens(raw: string): string {
  return raw
    .replace(/\bv\.?\d+(?:[._-]\d+)*\b/gi, " ")
    .replace(/\b\d+(?:[._-]\d+)+\b/g, " ")
    .replace(/\b\d{5,}\b/g, " ");
}

/** Collapse to a lowercase alphanumeric core (drops all separators). */
function alnum(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Source-agnostic normalized name core.
 *
 * @param stripVersion when true, version tokens are removed first so the
 *   core is version-independent (used by the `fuzzy-name` tier). When
 *   false the full name (which may embed a version) is preserved (used by
 *   `fuzzy-name-version`, which pairs this with {@link normalizeVersion}).
 */
export function normalizeModName(
  mod: Pick<AuditorMod, "name" | "id">,
  stripVersion = false,
): string {
  const base = (mod.name ?? mod.id ?? "").toString();
  let s = stripVortexPin(base);
  if (stripVersion) {
    s = stripVersionTokens(s);
  }
  return alnum(s);
}

/** Tokens (length >= 2) of a version-stripped, lowercased name. */
function nameTokens(mod: Pick<AuditorMod, "name" | "id">): string[] {
  const base = stripVersionTokens(stripVortexPin((mod.name ?? mod.id ?? "").toString()));
  return base
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

/** Sorensen-Dice coefficient over two token sets. 0..1. */
function diceCoefficient(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection += 1;
  }
  return (2 * intersection) / (setA.size + setB.size);
}

// ---------------------------------------------------------------------------
// Per-tier key functions
// ---------------------------------------------------------------------------

function str(v: number | string | undefined): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v);
  return s.length > 0 ? s : undefined;
}

function nexusFileKey(mod: AuditorMod): string | undefined {
  const modId = str(mod.nexusModId);
  const fileId = str(mod.nexusFileId);
  if (modId === undefined || fileId === undefined) return undefined;
  return `${modId}:${fileId}`;
}

function archiveShaKey(mod: AuditorMod): string | undefined {
  return mod.archiveSha256 && mod.archiveSha256.length > 0
    ? mod.archiveSha256
    : undefined;
}

function stagingSetKey(mod: AuditorMod): string | undefined {
  return mod.stagingSetHash && mod.stagingSetHash.length > 0
    ? mod.stagingSetHash
    : undefined;
}

function nexusModKey(mod: AuditorMod): string | undefined {
  return str(mod.nexusModId);
}

function nameVersionKey(mod: AuditorMod): string | undefined {
  const core = normalizeModName(mod, false);
  if (core.length === 0) return undefined;
  return `${core}|${normalizeVersion(mod.version)}`;
}

function nameKey(mod: AuditorMod): string | undefined {
  const core = normalizeModName(mod, true);
  return core.length === 0 ? undefined : core;
}

// ---------------------------------------------------------------------------
// Matcher
// ---------------------------------------------------------------------------

/**
 * Match `reference` mods to `current` mods with the tiered ladder.
 * Order of inputs is preserved in the `onlyIn*` buckets.
 */
export function matchSnapshots(
  reference: AuditorMod[],
  current: AuditorMod[],
  options: MatchOptions = {},
): MatchSnapshotsResult {
  const fuzzyThreshold = options.fuzzyThreshold ?? 0.7;
  const enableSimilarity = options.enableSimilarity ?? true;
  const similarityThreshold = options.similarityThreshold ?? 0.85;

  const refRemaining = new Set<number>(reference.map((_, i) => i));
  const curRemaining = new Set<number>(current.map((_, i) => i));
  const matches: ModMatch[] = [];

  /**
   * Run one keyed tier. `requireUnique` is the fuzzy-safety guard: when a
   * normalized key maps to more than one remaining mod on either side, the
   * whole colliding group is skipped (left for a weaker tier or the
   * unmatched buckets).
   */
  const runKeyTier = (
    tier: MatchTier,
    keyOf: (mod: AuditorMod) => string | undefined,
    requireUnique: boolean,
  ): void => {
    const confidence = TIER_CONFIDENCE[tier];
    if (confidence < fuzzyThreshold) return;

    const refByKey = new Map<string, number[]>();
    for (const ri of refRemaining) {
      const k = keyOf(reference[ri]);
      if (k === undefined) continue;
      const list = refByKey.get(k);
      if (list) list.push(ri);
      else refByKey.set(k, [ri]);
    }

    const curByKey = new Map<string, number[]>();
    for (const ci of curRemaining) {
      const k = keyOf(current[ci]);
      if (k === undefined) continue;
      const list = curByKey.get(k);
      if (list) list.push(ci);
      else curByKey.set(k, [ci]);
    }

    for (const [k, refIdxs] of refByKey) {
      const curIdxs = curByKey.get(k);
      if (!curIdxs || curIdxs.length === 0) continue;
      if (requireUnique && (refIdxs.length !== 1 || curIdxs.length !== 1)) {
        continue;
      }
      const n = Math.min(refIdxs.length, curIdxs.length);
      for (let i = 0; i < n; i += 1) {
        const ri = refIdxs[i];
        const ci = curIdxs[i];
        if (!refRemaining.has(ri) || !curRemaining.has(ci)) continue;
        matches.push({
          reference: reference[ri],
          current: current[ci],
          tier,
          confidence,
        });
        refRemaining.delete(ri);
        curRemaining.delete(ci);
      }
    }
  };

  // Tier 1-3: exact identity. Strong identity always matches even if a
  // duplicate exists, so no uniqueness guard.
  runKeyTier("nexus-file", nexusFileKey, false);
  runKeyTier("archive-sha", archiveShaKey, false);
  runKeyTier("staging-set", stagingSetKey, false);

  // Tier 4: same Nexus mod, different file (version drift). After
  // nexus-file consumed equal-file pairs, a shared modId implies drift.
  runKeyTier("nexus-mod", nexusModKey, true);

  // Tier 5-6: fuzzy keyed, 1:1 only.
  runKeyTier("fuzzy-name-version", nameVersionKey, true);
  runKeyTier("fuzzy-name", nameKey, true);

  // Tier 7: token-set similarity (optional). Mutual-best + threshold.
  if (enableSimilarity && TIER_CONFIDENCE["fuzzy-similar"] >= fuzzyThreshold) {
    matchBySimilarity(
      reference,
      current,
      refRemaining,
      curRemaining,
      matches,
      Math.max(similarityThreshold, fuzzyThreshold),
    );
  }

  const onlyInReference: AuditorMod[] = [];
  reference.forEach((m, i) => {
    if (refRemaining.has(i)) onlyInReference.push(m);
  });
  const onlyInCurrent: AuditorMod[] = [];
  current.forEach((m, i) => {
    if (curRemaining.has(i)) onlyInCurrent.push(m);
  });

  return { matches, onlyInReference, onlyInCurrent };
}

/**
 * Token-set similarity tier. For each remaining reference mod we find its
 * best current candidate; we only commit the pair when the score clears
 * the threshold AND the relationship is MUTUAL (the current mod's best
 * remaining reference is the same one). Mutual-best + threshold makes a
 * spurious merge of two unrelated mods effectively impossible.
 */
function matchBySimilarity(
  reference: AuditorMod[],
  current: AuditorMod[],
  refRemaining: Set<number>,
  curRemaining: Set<number>,
  matches: ModMatch[],
  threshold: number,
): void {
  const refIdxs = [...refRemaining];
  const curIdxs = [...curRemaining];
  if (refIdxs.length === 0 || curIdxs.length === 0) return;

  const refTokens = new Map<number, string[]>();
  for (const ri of refIdxs) refTokens.set(ri, nameTokens(reference[ri]));
  const curTokens = new Map<number, string[]>();
  for (const ci of curIdxs) curTokens.set(ci, nameTokens(current[ci]));

  const bestForRef = new Map<number, { ci: number; score: number }>();
  const bestForCur = new Map<number, { ri: number; score: number }>();

  for (const ri of refIdxs) {
    const ta = refTokens.get(ri)!;
    if (ta.length === 0) continue;
    for (const ci of curIdxs) {
      const tb = curTokens.get(ci)!;
      if (tb.length === 0) continue;
      const score = diceCoefficient(ta, tb);
      if (score < threshold) continue;

      const curBestRef = bestForRef.get(ri);
      if (!curBestRef || score > curBestRef.score) {
        bestForRef.set(ri, { ci, score });
      }
      const curBestCur = bestForCur.get(ci);
      if (!curBestCur || score > curBestCur.score) {
        bestForCur.set(ci, { ri, score });
      }
    }
  }

  for (const [ri, best] of bestForRef) {
    const ci = best.ci;
    if (!refRemaining.has(ri) || !curRemaining.has(ci)) continue;
    const reverse = bestForCur.get(ci);
    if (!reverse || reverse.ri !== ri) continue; // not mutual-best
    matches.push({
      reference: reference[ri],
      current: current[ci],
      tier: "fuzzy-similar",
      confidence: best.score,
    });
    refRemaining.delete(ri);
    curRemaining.delete(ci);
  }
}
