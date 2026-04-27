import * as fs from "fs";
import * as path from "path";

import { selectors } from "vortex-api";
import type { types } from "vortex-api";

import type { AuditorMod } from "../getModsListForProfile";
import type { EhcollStagingFile, VerificationLevel } from "../../types/ehcoll";
import { hashFileSha256 } from "../archiveHashing";
import { AbortError } from "../../utils/abortError";
import { pMap } from "../../utils/pMap";

/**
 * Captures the curator's staging-folder file list for each mod, used by
 * the user-side {@link verifyModInstall} check to detect Vortex's "lost
 * file" / truncation / corruption bugs after the user installs the mod.
 *
 * What we capture:
 *  - The full file tree under `<install-path>/<mod.installationPath>`
 *    on the curator's machine (post-Vortex-extraction, post-FOMOD-
 *    resolution).
 *  - For each file: POSIX-style relative path + size in bytes.
 *  - Optionally (when `level === "thorough"`): SHA-256 of file contents.
 *
 * What we do NOT capture:
 *  - The raw archive contents. The curator's deployed file set already
 *    reflects FOMOD selections, so this side-steps the "user picks
 *    different FOMOD answers" false-positive problem entirely.
 *  - Files outside the mod's staging root (Vortex never installs there).
 *
 * Failure handling:
 *  - Mods missing `installationPath` (rare — typically pre-Vortex-1.x or
 *    placeholder entries) pass through unchanged. The user-side verifier
 *    will skip them with a warning rather than fail the install.
 *  - I/O errors on individual files (locked, permission denied, etc.)
 *    surface as a captured `EhcollStagingFile` with `size: 0` and a
 *    diagnostic warning emitted via `onWarn`. The user-side check will
 *    ignore size=0 entries (they can't be meaningfully verified).
 *  - Aborts via `AbortSignal` propagate as `AbortError` exactly like
 *    `enrichModsWithArchiveHashes` — partial work is discarded.
 *
 * Concurrency:
 *  - Mods are walked one-at-a-time (outer loop) but files within each
 *    mod hash in parallel (4-wide via {@link pMap}). This keeps memory
 *    bounded for huge mods (BodySlide presets, voice packs) while still
 *    saturating SSD bandwidth.
 */
export type CaptureStagingOptions = {
  level: VerificationLevel;
  /** Defaults to 4 — friendly to spinning rust, fine for SSD. */
  hashConcurrency?: number;
  /**
   * Per-mod progress callback. Fires once after each mod is processed
   * (success, skipped, or partial). Used by the build engine to drive
   * the `inspecting-mods` progress bar.
   */
  onProgress?: (done: number, total: number, mod: AuditorMod) => void;
  /**
   * Diagnostic warnings (e.g. unreadable files) — non-fatal. Caller can
   * surface these in the build summary. Distinct from hard errors,
   * which throw.
   */
  onWarn?: (mod: AuditorMod, message: string) => void;
  signal?: AbortSignal;
};

/**
 * Output type — same shape as `AuditorMod` plus `installationPath` and
 * `stagingFiles`. Both are optional because:
 *  - `installationPath` may be absent on legacy mod records.
 *  - `stagingFiles` is only populated when `level !== "none"`.
 */
export type StagingEnrichedAuditorMod = AuditorMod & {
  installationPath?: string;
  stagingFiles?: EhcollStagingFile[];
};

export async function captureStagingFiles(
  state: types.IState,
  gameId: string,
  mods: AuditorMod[],
  options: CaptureStagingOptions,
): Promise<StagingEnrichedAuditorMod[]> {
  const {
    level,
    hashConcurrency = 4,
    onProgress,
    onWarn,
    signal,
  } = options;

  if (level === "none") {
    onProgress?.(mods.length, mods.length, mods[mods.length - 1]!);
    return mods.map((m) => ({ ...m }));
  }

  if (signal?.aborted) {
    throw new AbortError();
  }

  const installRoot = selectors.installPathForGame(state, gameId);
  if (!installRoot) {
    if (onWarn !== undefined && mods.length > 0) {
      onWarn(
        mods[0]!,
        `Could not resolve Vortex install path for game "${gameId}". ` +
          "Skipping staging-file capture for this build.",
      );
    }
    return mods.map((m) => ({ ...m }));
  }

  const modsByGame =
    ((state as any)?.persistent?.mods?.[gameId] ?? {}) as Record<
      string,
      { installationPath?: string } | undefined
    >;

  const out: StagingEnrichedAuditorMod[] = new Array(mods.length);
  let done = 0;

  for (let i = 0; i < mods.length; i++) {
    if (signal?.aborted) throw new AbortError();
    const mod = mods[i]!;
    const enriched: StagingEnrichedAuditorMod = { ...mod };

    const installationPath = modsByGame[mod.id]?.installationPath;
    if (installationPath !== undefined && installationPath.length > 0) {
      enriched.installationPath = installationPath;
    }

    if (enriched.installationPath === undefined) {
      onWarn?.(
        mod,
        `Mod "${mod.name}" has no installationPath in Vortex state. ` +
          "Skipping staging-file capture for this mod (user-side " +
          "integrity check will be best-effort).",
      );
      out[i] = enriched;
      done += 1;
      onProgress?.(done, mods.length, mod);
      continue;
    }

    const stagingRoot = path.join(installRoot, enriched.installationPath);

    try {
      const files = await walkStagingFolder(stagingRoot, signal);
      const stagingFiles = await hashStagingFiles(
        stagingRoot,
        files,
        level,
        hashConcurrency,
        signal,
        (relPath, err) => onWarn?.(mod, `${relPath}: ${err.message}`),
      );
      enriched.stagingFiles = stagingFiles;
    } catch (err) {
      if (err instanceof AbortError) throw err;
      onWarn?.(
        mod,
        `Failed to walk staging folder for "${mod.name}": ${
          (err as Error).message
        }. User-side integrity check will skip this mod.`,
      );
    }

    out[i] = enriched;
    done += 1;
    onProgress?.(done, mods.length, mod);
  }

  return out;
}

type WalkedFile = {
  /** POSIX-style path relative to the staging root. */
  relativePath: string;
  /** Absolute path on disk. */
  absolutePath: string;
  size: number;
};

/**
 * Recursive directory walk that returns every regular file under `root`
 * with its size. Symlinks are followed only when they resolve to files
 * inside `root` (anti-loop guard); hardlinks are walked normally as
 * Vortex's primary deployment method produces them in the *deploy*
 * folder, not staging — staging is always real bytes.
 *
 * Returns an empty array if `root` doesn't exist (mod was concurrently
 * uninstalled — non-fatal, the build snapshot won't include it anyway).
 */
async function walkStagingFolder(
  root: string,
  signal: AbortSignal | undefined,
): Promise<WalkedFile[]> {
  const out: WalkedFile[] = [];

  const stat = await fs.promises.stat(root).catch(() => undefined);
  if (stat === undefined || !stat.isDirectory()) {
    return out;
  }

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
    a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0,
  );
  return out;
}

async function hashStagingFiles(
  _root: string,
  files: WalkedFile[],
  level: VerificationLevel,
  concurrency: number,
  signal: AbortSignal | undefined,
  onFileWarn: (relativePath: string, err: Error) => void,
): Promise<EhcollStagingFile[]> {
  if (level === "fast") {
    return files.map<EhcollStagingFile>((f) => ({
      path: f.relativePath,
      size: f.size,
    }));
  }

  // level === "thorough"
  const hashes = await pMap(
    files,
    Math.max(1, concurrency),
    async (file) => {
      try {
        const sha256 = await hashFileSha256(file.absolutePath, signal);
        return { ok: true as const, sha256 };
      } catch (err) {
        if (err instanceof AbortError) throw err;
        onFileWarn(file.relativePath, err as Error);
        return { ok: false as const };
      }
    },
    signal,
  );

  return files.map<EhcollStagingFile>((f, i) => {
    const h = hashes[i]!;
    if (h.ok) {
      return { path: f.relativePath, size: f.size, sha256: h.sha256 };
    }
    return { path: f.relativePath, size: f.size };
  });
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}
