import * as path from "path";

import { selectors } from "vortex-api";
import type { types } from "vortex-api";

import type { AuditorMod } from "../getModsListForProfile";
import type { EhcollManifest } from "../../types/ehcoll";
import { AbortError } from "../../utils/abortError";
import { computeStagingSetHash } from "../manifest/stagingSetHash";
import {
  getDefaultHashConcurrency,
  hashStagingFiles,
  walkStagingFolder,
} from "../manifest/stagingFileWalker";

/**
 * User-side enrichment: compute `stagingSetHash` for installed mods
 * that name-match an external manifest entry carrying its own
 * `stagingSetHash`. The resolver's `findInstalledByStagingSetHash`
 * matcher reads this — without enrichment, archive-less external
 * mods cannot be matched as "already installed" on the user's side.
 *
 * ─── COST MODEL ───────────────────────────────────────────────────
 * Hashing every installed mod's staging folder would be wasteful
 * (hundreds of MB per mod, dozens to hundreds of mods). We bound
 * the work two ways:
 *
 *  1. **Manifest selection.** Only manifest mods with `kind === "external"`
 *     AND `stagingSetHash` defined drive enrichment. Archive-only
 *     external mods (`sha256` set, no `stagingSetHash`) match cheaply
 *     via `findInstalledBySha`; we don't pre-hash the user's mods
 *     for them.
 *
 *  2. **Name candidates.** Within the manifest-selected set, only
 *     installed mods whose name (case-insensitive, trimmed) exactly
 *     matches at least one manifest mod's name are hashed. Most
 *     manifest entries have 0–1 candidates per typical setup.
 *
 * The result: O(name-matched mods) × (avg staging folder size)
 * per resolve, which is dominated by the user's deployed mod set
 * but bounded by name-match overlap. CPU-bound work runs through
 * {@link hashStagingFiles}'s adaptive concurrency (typically
 * `min(8, max(2, cpus-1))`), so wall-time scales with cores.
 *
 * ─── DOUBLE-VERIFICATION ──────────────────────────────────────────
 * Together with the post-install Tier-2 verifier, this gives us two
 * independent checkpoints:
 *
 *  - **Pre-install** (this function → resolver): "Does the user
 *    already have curator's exact bytes deployed?" If yes, skip;
 *    if no, install. If a name candidate's hash *mismatches* the
 *    manifest hash, we treat the mod as not-installed (bytes
 *    diverge — install the curator's version).
 *
 *  - **Post-install** (`verifyModInstall`): "Did the install land
 *    the bytes we expected?" Independent of whether we matched
 *    pre-install; catches partial extracts, lost files, corruption.
 *
 * Both checkpoints share `walkStagingFolder` + `hashStagingFiles`,
 * so the curator-side and user-side hashing paths agree byte-for-byte
 * on what counts as "the file set."
 *
 * ─── DESIGN ───────────────────────────────────────────────────────
 *  - **No-op when nothing to do.** If the manifest has zero external
 *    mods with `stagingSetHash`, this function returns the input
 *    array unchanged (same reference) without touching disk.
 *  - **Mutation-safe input.** Returns a fresh array; per-mod entries
 *    are spread copies so the caller's `AuditorMod[]` is untouched.
 *  - **Failure ⇒ undefined.** Per-mod errors (locked file, partial
 *    walk) surface to `onWarn` and leave the mod's `stagingSetHash`
 *    unset rather than failing the entire enrichment. The resolver
 *    treats absence as "byte-identity unknown."
 *  - **Aborts propagate.** `signal?.aborted` causes an `AbortError`
 *    to bubble out of any in-flight walk/hash, identical to the
 *    archive-hash enrichment path.
 */
export type EnrichStagingSetHashesOptions = {
  /** Adaptive default — see {@link getDefaultHashConcurrency}. */
  hashConcurrency?: number;
  /**
   * Per-mod progress callback. Fires once per name-matched mod
   * (success, partial, skipped). Useful to drive a status line in
   * the install UI.
   */
  onProgress?: (done: number, total: number, mod: AuditorMod) => void;
  /**
   * Per-mod diagnostic warnings — non-fatal. Used for missing
   * staging folders, locked files, etc. Distinct from hard errors,
   * which throw.
   */
  onWarn?: (mod: AuditorMod, message: string) => void;
  signal?: AbortSignal;
};

export async function enrichInstalledModsWithStagingSetHashes(
  state: types.IState,
  gameId: string,
  manifest: EhcollManifest,
  installedMods: AuditorMod[],
  options: EnrichStagingSetHashesOptions = {},
): Promise<AuditorMod[]> {
  const { hashConcurrency, onProgress, onWarn, signal } = options;

  // Gate 1: anything to match against?
  const wanted = collectExternalStagingSetHashTargets(manifest);
  if (wanted.size === 0) {
    return installedMods;
  }

  if (signal?.aborted) throw new AbortError();

  // Gate 2: which installed mods name-match? Only those get hashed.
  const out = installedMods.map((m) => ({ ...m }));
  const candidateIndices: number[] = [];
  for (let i = 0; i < out.length; i++) {
    const mod = out[i]!;
    const key = normalizeName(mod.name);
    if (key.length === 0) continue;
    if (wanted.has(key)) {
      candidateIndices.push(i);
    }
  }
  if (candidateIndices.length === 0) {
    return out;
  }

  const installRoot = selectors.installPathForGame(state, gameId);
  if (!installRoot) {
    if (onWarn !== undefined) {
      onWarn(
        out[candidateIndices[0]!]!,
        `Could not resolve Vortex install path for game "${gameId}". ` +
          "Skipping staging-set-hash enrichment; archive-less external " +
          "mods will fall back to install-from-bundle / prompt-user.",
      );
    }
    return out;
  }

  const modsByGame =
    ((state as any)?.persistent?.mods?.[gameId] ?? {}) as Record<
      string,
      { installationPath?: string } | undefined
    >;

  const workers = hashConcurrency ?? getDefaultHashConcurrency();

  const total = candidateIndices.length;
  let done = 0;

  for (const i of candidateIndices) {
    if (signal?.aborted) throw new AbortError();
    const mod = out[i]!;

    const installationPath = modsByGame[mod.id]?.installationPath;
    if (
      installationPath === undefined ||
      installationPath.length === 0
    ) {
      onWarn?.(
        mod,
        `Mod "${mod.name}" has no installationPath in Vortex state. ` +
          "Cannot compute staging-set-hash for archive-less identity match.",
      );
      done += 1;
      onProgress?.(done, total, mod);
      continue;
    }

    const stagingRoot = path.join(installRoot, installationPath);
    try {
      const files = await walkStagingFolder(stagingRoot, signal);
      if (files.length === 0) {
        onWarn?.(
          mod,
          `Staging folder for "${mod.name}" is empty or missing at ` +
            `"${stagingRoot}". Skipping staging-set-hash.`,
        );
        done += 1;
        onProgress?.(done, total, mod);
        continue;
      }
      // Always thorough — set-hash only matches on per-file sha256s.
      const stagingFiles = await hashStagingFiles(
        stagingRoot,
        files,
        "thorough",
        workers,
        signal,
        (relPath, err) => onWarn?.(mod, `${relPath}: ${err.message}`),
      );
      const setHash = computeStagingSetHash(stagingFiles);
      if (setHash !== undefined) {
        mod.stagingSetHash = setHash;
      } else {
        // Either no files, or some had no sha (I/O error during walk).
        // computeStagingSetHash returns undefined to refuse partial
        // hashes — same conservative degradation, surfaced to the user.
        onWarn?.(
          mod,
          `Could not compute a complete staging-set-hash for "${mod.name}" ` +
            "(some files were unreadable). Falling back to no-match for " +
            "this mod.",
        );
      }
    } catch (err) {
      if (err instanceof AbortError) throw err;
      onWarn?.(
        mod,
        `Failed to enrich staging-set-hash for "${mod.name}": ${
          (err as Error).message
        }.`,
      );
    }

    done += 1;
    onProgress?.(done, total, mod);
  }

  return out;
}

/**
 * Build the set of normalized names the manifest cares about for
 * staging-set-hash matching. Manifest mods without `stagingSetHash`
 * (archive-only externals or all Nexus mods) are excluded — their
 * identity is established cheaply via archive sha alone.
 */
function collectExternalStagingSetHashTargets(
  manifest: EhcollManifest,
): Set<string> {
  const names = new Set<string>();
  for (const mod of manifest.mods) {
    if (
      mod.source.kind === "external" &&
      typeof mod.source.stagingSetHash === "string" &&
      mod.source.stagingSetHash.length === 64
    ) {
      const normalized = normalizeName(mod.name);
      if (normalized.length > 0) {
        names.add(normalized);
      }
    }
  }
  return names;
}

/**
 * Lowercase + collapse whitespace for case-insensitive name matching.
 * This is intentionally permissive — Vortex display names go through
 * a few hands (Nexus → mod author → curator → installer) and trivial
 * whitespace differences shouldn't block a match. Identity remains
 * load-bearing on the hash, not the name.
 */
function normalizeName(raw: string | undefined): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}
