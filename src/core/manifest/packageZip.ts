/**
 * `.ehcoll` ZIP packager (Phase 2 slice 3).
 *
 * Takes an {@link EhcollManifest} produced by `buildManifest` plus a list
 * of bundled archives, stages them in a temp directory, and produces a
 * single `.ehcoll` file (ZIP-format under the hood) on disk.
 *
 * Spec: docs/business/PACKAGE_ZIP.md
 *
 * Format choice — ZIP, not 7z:
 *  - Bundled archives are *already compressed* mod archives. The outer
 *    container's compression algorithm changes total size by a fraction
 *    of a percent — not worth giving up tooling compatibility.
 *  - ZIP can be inspected by Windows Explorer / WinRAR / `unzip` without
 *    any extra software, which matters when debugging a user-side install
 *    failure ("can you send me what your manifest.json looks like?").
 *  - The .ehcoll extension is opaque to end users in either case; format
 *    is an internal-only detail.
 *
 * Streaming: 7z reads bundled archives off disk directly via its own I/O
 * pipe. Node.js never holds bundled-archive bytes in memory. We hardlink
 * archives into the staging directory when possible (instant, free) and
 * fall back to copy on cross-volume / permissions errors.
 *
 * Identity — NOT byte-equal across rebuilds. A rebuild of the same
 * collection version may produce different bytes (different mtimes,
 * different 7z version, different filesystem enumeration order). The
 * canonical identity of a release is `(manifest.package.id,
 * manifest.package.version)`, both of which the schema already requires.
 * Don't add byte-determinism complexity to solve a problem that is
 * better solved at the metadata layer.
 *
 * The one stability concession: `manifest.json` keys are sorted via
 * `sortDeep` so unzipping two `.ehcoll` files and `diff`ing their
 * manifests highlights actual content changes, not key-order shuffles.
 */

import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

import type { EhcollManifest } from "../../types/ehcoll";
import { sortDeep } from "../../utils/utils";
import { resolveSevenZip, type SevenZipApi } from "./sevenZip";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type BundledArchiveSpec = {
  /** Absolute path to the source archive on the curator's disk. */
  sourcePath: string;
  /**
   * Identity. Must equal exactly one external-mod's `source.sha256` in
   * the manifest. The packager refuses to bundle anything that doesn't
   * correspond to a `source.bundled === true` external mod entry.
   */
  sha256: string;
};

export type PackageEhcollInput = {
  manifest: EhcollManifest;
  bundledArchives: BundledArchiveSpec[];
  /** Optional README markdown. Written as `README.md` at the package root. */
  readme?: string;
  /** Optional CHANGELOG markdown. Written as `CHANGELOG.md` at the package root. */
  changelog?: string;
  /** Absolute path of the final `.ehcoll` file. Existing file is overwritten. */
  outputPath: string;
  /**
   * Optional override for the temp staging directory. Defaults to
   * `os.tmpdir()/event-horizon-pack-<random>`. Useful for tests.
   */
  stagingDir?: string;
  /** Default true. When false, the staging directory is left in place. */
  cleanupOnSuccess?: boolean;
  /**
   * Default false (fast path). When true, every bundled archive is
   * re-hashed against {@link BundledArchiveSpec.sha256} before staging.
   * Slow on big archives but catches "curator's archive cache changed
   * since snapshot export."
   */
  verifyHashes?: boolean;
  /** Optional injection point for tests. Defaults to vortex-api's SevenZip. */
  sevenZip?: SevenZipApi;
};

export type PackageEhcollResult = {
  outputPath: string;
  outputBytes: number;
  bundledCount: number;
  /** Non-fatal issues (e.g. README too short, unusual file extensions). */
  warnings: string[];
};

export class PackageEhcollError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(
      errors.length === 1
        ? errors[0]
        : `Cannot pack .ehcoll (${errors.length} problems):\n  - ${errors.join(
            "\n  - ",
          )}`,
    );
    this.name = "PackageEhcollError";
    this.errors = errors;
  }
}

/**
 * Build a `.ehcoll` archive from a manifest + bundled-archive list.
 *
 * Returns when the archive is fully written and fsynced (delegated to
 * 7z). Throws {@link PackageEhcollError} on any validation or I/O error;
 * staging directory is cleaned up regardless.
 */
export async function packageEhcoll(
  input: PackageEhcollInput,
): Promise<PackageEhcollResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  validateInput(input, errors);
  if (errors.length > 0) throw new PackageEhcollError(errors);

  const stagingDir = await prepareStagingDir(input.stagingDir);
  const cleanupOnSuccess = input.cleanupOnSuccess !== false;

  try {
    await writeManifestJson(stagingDir, input.manifest);
    await writeOptionalMarkdown(stagingDir, "README.md", input.readme);
    await writeOptionalMarkdown(stagingDir, "CHANGELOG.md", input.changelog);

    await stageBundledArchives(
      stagingDir,
      input.bundledArchives,
      input.verifyHashes === true,
    );

    await runSevenZipAdd(
      input.outputPath,
      stagingDir,
      input.sevenZip ?? resolveSevenZip(),
    );

    const stat = await fsp.stat(input.outputPath);

    if (cleanupOnSuccess) {
      await safeRmDir(stagingDir);
    }

    return {
      outputPath: input.outputPath,
      outputBytes: stat.size,
      bundledCount: input.bundledArchives.length,
      warnings,
    };
  } catch (err) {
    await safeRmDir(stagingDir);
    if (err instanceof PackageEhcollError) throw err;
    throw new PackageEhcollError([
      err instanceof Error ? err.message : String(err),
    ]);
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateInput(input: PackageEhcollInput, errors: string[]): void {
  if (!input.outputPath || !path.isAbsolute(input.outputPath)) {
    errors.push(
      `outputPath must be an absolute path. Got: ${JSON.stringify(input.outputPath)}.`,
    );
  }

  // Build the {sha256 → bundled-external-mod} index from the manifest.
  // External mods with bundled=true MUST have a corresponding archive in
  // input.bundledArchives, and vice versa: every bundled archive MUST
  // correspond to exactly one such mod. Two bundled archives can't share
  // a sha256 (would be a duplicate identity).
  const expectedBundled = new Map<string, string>(); // sha256 → mod compareKey
  for (const mod of input.manifest.mods) {
    if (mod.source.kind === "external" && mod.source.bundled) {
      expectedBundled.set(mod.source.sha256, mod.compareKey);
    }
  }

  const seen = new Map<string, string>(); // sha256 → archive sourcePath
  for (const archive of input.bundledArchives) {
    if (!archive.sha256 || !/^[0-9a-f]{64}$/.test(archive.sha256)) {
      errors.push(
        `Bundled archive at "${archive.sourcePath}" has an invalid sha256 ` +
          `(must be lowercase hex, exactly 64 chars). Got: "${archive.sha256}".`,
      );
      continue;
    }

    const dup = seen.get(archive.sha256);
    if (dup !== undefined) {
      errors.push(
        `Two bundled archives share sha256 "${archive.sha256}": ` +
          `"${dup}" and "${archive.sourcePath}". Each external mod has a ` +
          `unique identity, so this should be impossible.`,
      );
      continue;
    }
    seen.set(archive.sha256, archive.sourcePath);

    if (!expectedBundled.has(archive.sha256)) {
      errors.push(
        `Bundled archive at "${archive.sourcePath}" (sha256 ${archive.sha256}) ` +
          `does not correspond to any external mod with bundled=true in the ` +
          `manifest. Drop the archive or flip the matching mod's bundled flag.`,
      );
    }

    if (!path.isAbsolute(archive.sourcePath)) {
      errors.push(
        `Bundled archive sourcePath must be absolute. Got: "${archive.sourcePath}".`,
      );
    }
  }

  for (const [sha256, modKey] of expectedBundled) {
    if (!seen.has(sha256)) {
      errors.push(
        `External mod "${modKey}" is marked bundled=true in the manifest ` +
          `but no archive with sha256 ${sha256} was provided. Either supply ` +
          `the archive or flip the mod to bundled=false.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Staging
// ---------------------------------------------------------------------------

async function prepareStagingDir(override?: string): Promise<string> {
  if (override !== undefined) {
    await fsp.rm(override, { recursive: true, force: true });
    await fsp.mkdir(override, { recursive: true });
    return override;
  }

  const prefix = path.join(os.tmpdir(), "event-horizon-pack-");
  return fsp.mkdtemp(prefix);
}

async function writeManifestJson(
  stagingDir: string,
  manifest: EhcollManifest,
): Promise<void> {
  // Sort object keys recursively so that unzipping two .ehcoll files and
  // `diff`ing their manifests reflects real content changes, not JSON
  // serialization key-order shuffles. Cheap; useful when debugging.
  const sorted = sortDeep(manifest);
  const json = JSON.stringify(sorted, null, 2) + "\n";
  await fsp.writeFile(path.join(stagingDir, "manifest.json"), json, "utf8");
}

async function writeOptionalMarkdown(
  stagingDir: string,
  name: string,
  content: string | undefined,
): Promise<void> {
  if (content === undefined) return;
  // Trailing newline is conventional for markdown; ensures consistent
  // bytes whether or not the curator's source had one.
  const normalized = content.endsWith("\n") ? content : content + "\n";
  await fsp.writeFile(path.join(stagingDir, name), normalized, "utf8");
}

/**
 * Stage every bundled archive into `stagingDir/bundled/<sha256>.<ext>`.
 *
 * Strategy: hardlink (free, instant), fall back to copy on EXDEV / EPERM.
 */
async function stageBundledArchives(
  stagingDir: string,
  archives: BundledArchiveSpec[],
  verifyHashes: boolean,
): Promise<void> {
  const bundledDir = path.join(stagingDir, "bundled");
  await fsp.mkdir(bundledDir, { recursive: true });

  for (const archive of archives) {
    if (verifyHashes) {
      await verifyArchiveHash(archive);
    }

    const ext = stripDot(path.extname(archive.sourcePath));
    const fileName = ext.length > 0
      ? `${archive.sha256}.${ext}`
      : archive.sha256;
    const dst = path.join(bundledDir, fileName);

    await stageOne(archive.sourcePath, dst);
  }
}

function stripDot(ext: string): string {
  return ext.startsWith(".") ? ext.slice(1) : ext;
}

async function stageOne(src: string, dst: string): Promise<void> {
  try {
    await fsp.link(src, dst);
    return;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EEXIST") {
      // Should not happen — staging dir is freshly created. Re-throw.
      throw err;
    }
    // EXDEV (cross-volume), EPERM (no hardlink permission), ENOSYS (FS
    // doesn't support hardlinks): fall through to copy.
  }

  await fsp.copyFile(src, dst);
}

async function verifyArchiveHash(archive: BundledArchiveSpec): Promise<void> {
  const { hashFileSha256 } = await import("../archiveHashing");
  const actual = await hashFileSha256(archive.sourcePath);
  if (actual !== archive.sha256) {
    throw new PackageEhcollError([
      `Bundled archive sha256 mismatch at "${archive.sourcePath}". ` +
        `Expected ${archive.sha256}, got ${actual}. ` +
        `The archive may have been replaced since the snapshot was exported. ` +
        `Re-export the snapshot and try again.`,
    ]);
  }
}

// ---------------------------------------------------------------------------
// 7z invocation
// ---------------------------------------------------------------------------

async function runSevenZipAdd(
  outputPath: string,
  stagingDir: string,
  sevenZip: SevenZipApi,
): Promise<void> {
  // Overwrite any existing .ehcoll at outputPath. 7z's `add` would APPEND
  // to an existing archive, which is never what we want.
  await fsp.rm(outputPath, { force: true });
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });

  // The .ehcoll extension would default 7z to its native .7z format —
  // force ZIP explicitly via `-tzip` so any tool can inspect the package.
  // Compression level is left at 7z's default (5); bundled archives are
  // already compressed so tweaking it changes total size by a fraction
  // of a percent.
  await new Promise<void>((resolve, reject) => {
    const stream = sevenZip.add(outputPath, "*", {
      $raw: ["-tzip"],
      workingDir: stagingDir,
      recursive: true,
    });

    stream.on("end", () => resolve());
    stream.on("error", (err: Error) => reject(err));
  });
}

async function safeRmDir(dir: string): Promise<void> {
  try {
    await fsp.rm(dir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup. Failure here is purely cosmetic; the OS will
    // GC the temp dir eventually.
  }
}
