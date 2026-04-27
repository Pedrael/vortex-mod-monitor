import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import type { EhcollStagingFile, VerificationLevel } from "../../types/ehcoll";
import { hashFileSha256 } from "../archiveHashing";
import { AbortError } from "../../utils/abortError";
import { pMap } from "../../utils/pMap";

/**
 * Shared file-system primitives for hashing a Vortex staging folder.
 *
 * Two callers consume these:
 *  - {@link captureStagingFiles} on the curator side, building the
 *    manifest snapshot at package time.
 *  - {@link enrichInstalledModsWithStagingSetHashes} on the user
 *    side, computing the runtime fingerprint of mods whose name
 *    matches an external manifest entry without an `archiveSha256`.
 *
 * Both paths must agree byte-for-byte on:
 *  - Which files count (regular files only; symlinks resolved if
 *    they stay within `root`).
 *  - The shape of `relativePath` (POSIX separators, lexicographic
 *    order in the returned list).
 *  - SHA-256 of file contents.
 *
 * Any divergence breaks `stagingSetHash` parity between curator and
 * user — that's why the helpers live here, in one place, instead of
 * being duplicated.
 */

/**
 * Default file-hashing concurrency: one less than the number of
 * logical cores, with a floor of 2 and an explicit ceiling of 8.
 *
 * Rationale:
 *  - Most mod files are large enough that sha256 is bandwidth-bound
 *    on the disk, not CPU-bound, so adding more workers past ~4 has
 *    diminishing returns on a typical SSD.
 *  - Leaving one core for the Vortex UI / main thread keeps the
 *    progress bar responsive.
 *  - The ceiling of 8 prevents 32-core boxes from saturating
 *    process descriptors and starving the rest of Vortex.
 *
 * Caller can override via the `concurrency` parameter on
 * {@link hashStagingFiles}.
 */
export function getDefaultHashConcurrency(): number {
  const cpus = os.cpus().length;
  if (!Number.isFinite(cpus) || cpus < 2) {
    return 2;
  }
  return Math.min(8, Math.max(2, cpus - 1));
}

export type WalkedFile = {
  /** POSIX-style path relative to the staging root. */
  relativePath: string;
  /** Absolute path on disk. */
  absolutePath: string;
  size: number;
};

/**
 * Recursive directory walk that returns every regular file under
 * `root` with its size. Symlinks are followed only when they resolve
 * to files inside `root` (anti-loop guard); hardlinks are walked
 * normally as Vortex's primary deployment method produces them in
 * the *deploy* folder, not staging — staging is always real bytes.
 *
 * Returns an empty array if `root` doesn't exist (mod was concurrently
 * uninstalled — non-fatal, the build snapshot won't include it anyway).
 */
export async function walkStagingFolder(
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
    a.relativePath < b.relativePath
      ? -1
      : a.relativePath > b.relativePath
        ? 1
        : 0,
  );
  return out;
}

/**
 * Materialise a {@link WalkedFile} list into the manifest-shaped
 * {@link EhcollStagingFile} array. SHA-256 is computed iff
 * `level === "thorough"`. Per-file errors are surfaced to `onFileWarn`
 * and degrade silently to `{ path, size }` (no sha) for that one
 * file — partial captures are handled deterministically downstream
 * (e.g. {@link computeStagingSetHash} refuses to hash a file set
 * with any missing sha).
 *
 * `concurrency` defaults to {@link getDefaultHashConcurrency} (cpu-aware).
 * Callers that have a strong reason (e.g. running in a constrained
 * UI thread) can pass a smaller number explicitly.
 */
export async function hashStagingFiles(
  _root: string,
  files: WalkedFile[],
  level: VerificationLevel,
  concurrency: number | undefined,
  signal: AbortSignal | undefined,
  onFileWarn: (relativePath: string, err: Error) => void,
): Promise<EhcollStagingFile[]> {
  if (level === "fast") {
    return files.map<EhcollStagingFile>((f) => ({
      path: f.relativePath,
      size: f.size,
    }));
  }

  const workers = Math.max(
    1,
    concurrency ?? getDefaultHashConcurrency(),
  );

  const hashes = await pMap(
    files,
    workers,
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
