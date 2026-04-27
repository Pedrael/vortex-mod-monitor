import * as fs from "fs";
import * as path from "path";

import { selectors } from "vortex-api";
import type { types } from "vortex-api";

import type {
  EhcollStagingFile,
  VerificationLevel,
} from "../../types/ehcoll";
import { hashFileSha256 } from "../archiveHashing";
import { AbortError } from "../../utils/abortError";
import { getDefaultHashConcurrency } from "../manifest/stagingFileWalker";
import { pMap } from "../../utils/pMap";

/**
 * Post-install integrity check.
 *
 * Walks the user-side staging folder for a mod that just finished
 * installing and compares the on-disk file set against the curator's
 * captured `stagingFiles` from the manifest. Detects three Vortex
 * failure modes:
 *
 *   1. **Missing files** — Vortex reports `did-install-mod` but
 *      didn't actually extract every file from the archive. This is
 *      the famous "Vortex randomly loses files" symptom.
 *   2. **Size mismatch** — file extracted but truncated / partial.
 *   3. **Hash mismatch** *(thorough mode only)* — file extracted at
 *      the right size but wrong content (corruption, mid-write
 *      crash, antivirus quarantine + restore, etc.).
 *
 * Files present on the user side but NOT in the curator's manifest
 * are recorded as `extraFiles` and treated informationally — they
 * happen legitimately when the user picks different FOMOD options
 * than the curator did.
 *
 * ### Failure semantics
 *
 * Returning a result is NOT failing — the caller decides what to
 * do. Recommended call pattern in `runInstall.ts`:
 *
 * ```ts
 * const verification = await verifyModInstall({...});
 * if (verification.kind === "fail") {
 *   // re-install with force=true, then verify again
 * }
 * if (verification.kind === "skip") {
 *   // manifest had no stagingFiles; pass through
 * }
 * ```
 *
 * ### Concurrency
 *
 * Hash mode reads file bytes via {@link pMap} (concurrency 4 by
 * default). Size-only mode is pure stat() calls and has no
 * concurrency knob — calling it is microseconds-fast.
 */

export type VerifyModInstallInput = {
  api: types.IExtensionApi;
  gameId: string;
  /**
   * Vortex's mod id from `state.persistent.mods[gameId][modId]`.
   * The user-side install pipeline produces this id when Vortex
   * fires `did-install-mod`.
   */
  vortexModId: string;
  /**
   * Curator-captured staging-folder snapshot from the manifest
   * (`mod.state.stagingFiles`). Empty / missing means we have
   * nothing to verify against and the caller should treat this as
   * a `"skip"` result.
   */
  expectedFiles: EhcollStagingFile[] | undefined;
  /**
   * Manifest's `package.verificationLevel`. Drives the verify
   * mode:
   *  - `"none"`   → skip without walking disk.
   *  - `"fast"`   → file count + per-file size match (no reads).
   *  - `"thorough"` → also re-hash every file with sha256.
   *
   * If the level says thorough but `expectedFiles` lacks `sha256`
   * (curator built fast, manifest hand-tweaked, etc.) we silently
   * downgrade per-file to size-only — never error.
   */
  level: VerificationLevel;
  /**
   * Max concurrent per-file SHA-256 hashes when `level === "thorough"`.
   * Defaults to {@link getDefaultHashConcurrency} (`min(8, max(2, cpus-1))`),
   * scaling with the user's machine while leaving a core for the UI.
   */
  hashConcurrency?: number;
  signal?: AbortSignal;
};

export type VerifyOk = {
  kind: "ok";
  /**
   * Files present on the user side that aren't in the curator's
   * manifest. Informational only (FOMOD divergence, mod version
   * differences). Always empty when the curator captured the full
   * archive set without FOMOD selections.
   */
  extraFiles: string[];
  /** Total files actually verified. */
  verifiedCount: number;
};

export type VerifyFail = {
  kind: "fail";
  /** Files in manifest but absent from staging folder. */
  missingFiles: string[];
  /** Files where size differs from manifest. */
  sizeMismatches: Array<{
    path: string;
    expected: number;
    actual: number;
  }>;
  /** Files where sha256 differs (thorough mode only). */
  hashMismatches: Array<{
    path: string;
    expected: string;
    actual: string;
  }>;
  /** Files present on user side, not in manifest. Informational. */
  extraFiles: string[];
  /**
   * Total expected files (from manifest). Useful for percentage
   * calculations like "23 of 1234 missing".
   */
  expectedCount: number;
};

/**
 * Skip — the manifest didn't carry `stagingFiles` for this mod, OR
 * the curator built with `verificationLevel = "none"`. Returning a
 * structured result rather than `undefined` keeps the caller's
 * code path uniform.
 */
export type VerifySkip = {
  kind: "skip";
  reason:
    | "no-staging-files-in-manifest"
    | "verification-level-none"
    | "vortex-mod-missing-from-state"
    | "install-path-unresolvable";
};

export type VerifyResult = VerifyOk | VerifyFail | VerifySkip;

export async function verifyModInstall(
  input: VerifyModInstallInput,
): Promise<VerifyResult> {
  const {
    api,
    gameId,
    vortexModId,
    expectedFiles,
    level,
    hashConcurrency = getDefaultHashConcurrency(),
    signal,
  } = input;

  if (level === "none") {
    return { kind: "skip", reason: "verification-level-none" };
  }

  if (expectedFiles === undefined || expectedFiles.length === 0) {
    return { kind: "skip", reason: "no-staging-files-in-manifest" };
  }

  if (signal?.aborted) throw new AbortError();

  const state = api.getState();
  const installRoot = selectors.installPathForGame(state, gameId);
  if (!installRoot) {
    return { kind: "skip", reason: "install-path-unresolvable" };
  }

  const mod =
    ((state as any)?.persistent?.mods?.[gameId]?.[vortexModId] ?? undefined) as
      | { installationPath?: string }
      | undefined;
  if (mod === undefined || typeof mod.installationPath !== "string") {
    return { kind: "skip", reason: "vortex-mod-missing-from-state" };
  }
  const stagingRoot = path.join(installRoot, mod.installationPath);

  const onDisk = await collectOnDiskFiles(stagingRoot, signal);
  if (signal?.aborted) throw new AbortError();

  const onDiskByPath = new Map<string, OnDiskFile>();
  for (const f of onDisk) onDiskByPath.set(f.relativePath, f);

  const expectedByPath = new Map<string, EhcollStagingFile>();
  for (const f of expectedFiles) expectedByPath.set(f.path, f);

  const missingFiles: string[] = [];
  const sizeMismatches: VerifyFail["sizeMismatches"] = [];
  const hashCandidates: Array<{ expected: EhcollStagingFile; actual: OnDiskFile }> =
    [];

  for (const expected of expectedFiles) {
    const actual = onDiskByPath.get(expected.path);
    if (actual === undefined) {
      missingFiles.push(expected.path);
      continue;
    }
    if (actual.size !== expected.size) {
      sizeMismatches.push({
        path: expected.path,
        expected: expected.size,
        actual: actual.size,
      });
      continue;
    }
    if (level === "thorough" && expected.sha256 !== undefined) {
      hashCandidates.push({ expected, actual });
    }
  }

  const hashMismatches: VerifyFail["hashMismatches"] = [];
  if (hashCandidates.length > 0) {
    const results = await pMap(
      hashCandidates,
      Math.max(1, hashConcurrency),
      async (item) => {
        try {
          const actualSha = await hashFileSha256(item.actual.absolutePath, signal);
          if (actualSha !== item.expected.sha256) {
            return {
              path: item.expected.path,
              expected: item.expected.sha256!,
              actual: actualSha,
            };
          }
          return undefined;
        } catch (err) {
          if (err instanceof AbortError) throw err;
          return {
            path: item.expected.path,
            expected: item.expected.sha256!,
            actual: `<read error: ${(err as Error).message}>`,
          };
        }
      },
      signal,
    );
    for (const r of results) {
      if (r !== undefined) hashMismatches.push(r);
    }
  }

  const extraFiles: string[] = [];
  for (const f of onDisk) {
    if (!expectedByPath.has(f.relativePath)) extraFiles.push(f.relativePath);
  }

  const hasFailures =
    missingFiles.length > 0 ||
    sizeMismatches.length > 0 ||
    hashMismatches.length > 0;

  if (hasFailures) {
    return {
      kind: "fail",
      missingFiles,
      sizeMismatches,
      hashMismatches,
      extraFiles,
      expectedCount: expectedFiles.length,
    };
  }

  return {
    kind: "ok",
    extraFiles,
    verifiedCount: expectedFiles.length,
  };
}

type OnDiskFile = {
  relativePath: string;
  absolutePath: string;
  size: number;
};

/**
 * Walk the user-side staging folder. Returns an empty array if the
 * folder doesn't exist (caller will surface that as
 * `expectedCount === N, missingFiles === all of them`).
 *
 * Mirrors {@link captureStagingFiles}'s walker: same anti-loop
 * symlink guard, same POSIX-style relative paths, same sort.
 */
async function collectOnDiskFiles(
  root: string,
  signal: AbortSignal | undefined,
): Promise<OnDiskFile[]> {
  const out: OnDiskFile[] = [];
  const stat = await fs.promises.stat(root).catch(() => undefined);
  if (stat === undefined || !stat.isDirectory()) return out;

  const stack: string[] = [root];
  const visited = new Set<string>();

  while (stack.length > 0) {
    if (signal?.aborted) throw new AbortError();
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (signal?.aborted) throw new AbortError();
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (entry.isSymbolicLink()) {
        const realPath = await fs.promises
          .realpath(abs)
          .catch(() => undefined);
        if (
          realPath === undefined ||
          !realPath.startsWith(root) ||
          visited.has(realPath)
        ) {
          continue;
        }
        visited.add(realPath);
        const lstat = await fs.promises.stat(realPath).catch(() => undefined);
        if (lstat === undefined || !lstat.isFile()) continue;
        out.push({
          relativePath: toPosix(path.relative(root, abs)),
          absolutePath: abs,
          size: lstat.size,
        });
        continue;
      }
      if (entry.isFile()) {
        const lstat = await fs.promises.stat(abs).catch(() => undefined);
        if (lstat === undefined) continue;
        out.push({
          relativePath: toPosix(path.relative(root, abs)),
          absolutePath: abs,
          size: lstat.size,
        });
      }
    }
  }

  out.sort((a, b) =>
    a.relativePath < b.relativePath
      ? -1
      : a.relativePath > b.relativePath
        ? 1
        : 0,
  );
  return out;
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/**
 * Human-readable summary suited for log lines and toast messages.
 * Used by `runInstall.ts` when surfacing a verification failure to
 * the user.
 */
export function summarizeVerifyFail(fail: VerifyFail): string {
  const parts: string[] = [];
  if (fail.missingFiles.length > 0) {
    parts.push(`${fail.missingFiles.length} missing`);
  }
  if (fail.sizeMismatches.length > 0) {
    parts.push(`${fail.sizeMismatches.length} size mismatch`);
  }
  if (fail.hashMismatches.length > 0) {
    parts.push(`${fail.hashMismatches.length} corrupt`);
  }
  return `${parts.join(", ")} of ${fail.expectedCount} expected files`;
}
