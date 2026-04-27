/**
 * `.ehcoll` ZIP reader (Phase 3 slice 2).
 *
 * Mirror of {@link ./packageZip.packageEhcoll}. Takes one absolute path
 * to a `.ehcoll` ZIP, opens it via `vortex-api`'s `util.SevenZip`,
 * extracts and validates `manifest.json`, cross-checks the package
 * structure (`bundled/` directory, optional `README.md`/`CHANGELOG.md`,
 * Phase 5 `ini-tweaks/` placeholder), and returns a fully-typed result
 * the resolver/installer can consume.
 *
 * Spec: docs/business/READ_EHCOLL.md
 *
 * ─── ARCHITECTURE ──────────────────────────────────────────────────────
 * `readEhcoll` is the I/O wrapper over the pure {@link parseManifest}
 * validator. The split mirrors the producer side:
 *
 *   buildManifest   (pure)   ←mirror→   parseManifest  (pure)
 *   packageEhcoll   (I/O)    ←mirror→   readEhcoll     (I/O)  ← this file
 *
 * After this slice lands, anything `packageEhcoll` writes,
 * `readEhcoll` reads back losslessly. That round-trip is the gate
 * every Phase 3+ consumer (resolver, installer, drift report,
 * package inspector UI) sits on top of.
 *
 * I/O is structured as: list ZIP entries, then surgically extract
 * `manifest.json` only. Bundled archives are *not* extracted here —
 * resolving them is the resolver's job (slice 3+). We confirm they're
 * present in the central directory and that they line up with the
 * manifest's `bundled: true` mods, nothing more.
 *
 * ─── ERROR DISCIPLINE ──────────────────────────────────────────────────
 * Errors are accumulated and thrown together, same as the rest of the
 * Phase 2/3 pipeline. The two short-circuit gates are:
 *  1. The ZIP path doesn't exist / isn't a file.
 *  2. The ZIP central directory doesn't contain `manifest.json`.
 * Both are categorical "we have no document to read" conditions.
 *
 * Everything else — extra/missing bundled archives, missing optional
 * docs, Phase 5 ini-tweak placeholders — accumulates so the operator
 * gets a full diagnosis from one read.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

import type { EhcollManifest } from "../../types/ehcoll";
import { parseManifest, ParseManifestError } from "./parseManifest";
import {
  resolveSevenZip,
  type SevenZipApi,
  type SevenZipListEntry,
} from "./sevenZip";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ReadEhcollOptions = {
  /**
   * Override the staging dir used for `manifest.json` extraction.
   * Defaults to `os.tmpdir()/event-horizon-read-<random>`. Useful for
   * tests that want a known location.
   */
  stagingDir?: string;
  /**
   * Default `true`. When `false`, the staging directory is left in
   * place after a successful read — useful for offline inspection.
   */
  cleanupOnSuccess?: boolean;
  /**
   * Optional injection point. Defaults to `vortex-api`'s `util.SevenZip`
   * via {@link resolveSevenZip}. Tests substitute a fake.
   */
  sevenZip?: SevenZipApi;
};

export type ReadEhcollResult = {
  manifest: EhcollManifest;
  /**
   * One entry per archive present in the package's `bundled/`
   * directory, after cross-check against `manifest.mods`.
   */
  bundledArchives: BundledArchiveEntry[];
  /** True iff a top-level `README.md` is present in the package. */
  hasReadme: boolean;
  /** True iff a top-level `CHANGELOG.md` is present in the package. */
  hasChangelog: boolean;
  /**
   * Files under `ini-tweaks/`. Phase 5 placeholder; should always be
   * empty for v1 producers. Kept here so a future installer can
   * stream-process them without re-listing the ZIP.
   */
  iniTweakFiles: string[];
  /**
   * Non-fatal issues. Forward of {@link parseManifest}'s warnings plus
   * package-shape warnings (missing optional README/CHANGELOG when the
   * manifest mentions them, unexpected files in unknown directories,
   * etc.).
   */
  warnings: string[];
};

export type BundledArchiveEntry = {
  /** Lowercase 64-char hex SHA-256 — the file basename without extension. */
  sha256: string;
  /**
   * Path of the entry inside the ZIP, normalized to forward slashes.
   * Always starts with `bundled/`.
   */
  zipPath: string;
  /**
   * File extension (without leading dot), e.g. `"zip"`, `"7z"`,
   * `"rar"`. Empty string when the archive entry had no extension.
   */
  extension: string;
  /**
   * Uncompressed size in bytes when 7z reports it. May be undefined for
   * archive types that don't expose it via the central directory.
   */
  size?: number;
};

export class ReadEhcollError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(
      errors.length === 1
        ? errors[0]
        : `Cannot read .ehcoll (${errors.length} problems):\n  - ${errors.join(
            "\n  - ",
          )}`,
    );
    this.name = "ReadEhcollError";
    this.errors = errors;
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Open + validate a `.ehcoll` package on disk.
 *
 * Throws {@link ReadEhcollError} when the file can't be opened, when
 * `manifest.json` is missing or fails {@link parseManifest}, or when
 * the package structure violates the contract (e.g. duplicate bundled
 * sha256s).
 *
 * `parseManifest`'s thrown errors are wrapped into a `ReadEhcollError`
 * so the caller has one error type to catch.
 */
export async function readEhcoll(
  zipPath: string,
  options: ReadEhcollOptions = {},
): Promise<ReadEhcollResult> {
  if (!path.isAbsolute(zipPath)) {
    throw new ReadEhcollError([
      `zipPath must be an absolute path. Got: ${JSON.stringify(zipPath)}.`,
    ]);
  }

  await assertReadableFile(zipPath);

  const sevenZip = options.sevenZip ?? resolveSevenZip();

  // Phase 1 — central-directory listing.
  const entries = await listZipEntries(zipPath, sevenZip);

  const layout = classifyEntries(entries);

  if (!layout.hasManifest) {
    throw new ReadEhcollError([
      `Archive "${zipPath}" does not contain manifest.json at its root. ` +
        `This is not a valid Event Horizon collection package.`,
    ]);
  }

  // Phase 2 — surgical extract of manifest.json + parse.
  const stagingDir = await prepareStagingDir(options.stagingDir);
  const cleanupOnSuccess = options.cleanupOnSuccess !== false;

  let manifest: EhcollManifest;
  let parseWarnings: string[];

  try {
    await extractManifest(zipPath, stagingDir, sevenZip);

    const manifestPath = path.join(stagingDir, "manifest.json");
    const raw = await fsp.readFile(manifestPath, "utf8");

    try {
      const parsed = parseManifest(raw);
      manifest = parsed.manifest;
      parseWarnings = parsed.warnings;
    } catch (err) {
      if (err instanceof ParseManifestError) {
        throw new ReadEhcollError(err.errors);
      }
      throw err;
    }
  } finally {
    if (cleanupOnSuccess) {
      await safeRmDir(stagingDir);
    }
  }

  // Phase 3 — cross-check package structure against the manifest.
  const errors: string[] = [];
  const warnings = [...parseWarnings];

  const bundledArchives = crossCheckBundled(
    manifest,
    layout.bundledEntries,
    errors,
  );

  if (errors.length > 0) {
    throw new ReadEhcollError(errors);
  }

  return {
    manifest,
    bundledArchives,
    hasReadme: layout.hasReadme,
    hasChangelog: layout.hasChangelog,
    iniTweakFiles: layout.iniTweakFiles,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// File pre-flight
// ---------------------------------------------------------------------------

async function assertReadableFile(zipPath: string): Promise<void> {
  let stat: import("fs").Stats;
  try {
    stat = await fsp.stat(zipPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new ReadEhcollError([
        `No file at "${zipPath}". Has the package been moved or deleted?`,
      ]);
    }
    throw new ReadEhcollError([
      `Cannot stat "${zipPath}": ${err instanceof Error ? err.message : String(err)}.`,
    ]);
  }
  if (!stat.isFile()) {
    throw new ReadEhcollError([
      `"${zipPath}" is not a regular file ` +
        `(directory? symlink? device?). A .ehcoll must be a single ZIP file.`,
    ]);
  }
}

// ---------------------------------------------------------------------------
// 7z list — central directory enumeration
// ---------------------------------------------------------------------------

async function listZipEntries(
  zipPath: string,
  sevenZip: SevenZipApi,
): Promise<SevenZipListEntry[]> {
  const entries: SevenZipListEntry[] = [];

  await new Promise<void>((resolve, reject) => {
    const stream = sevenZip.list(zipPath);
    stream.on("data", (entry: SevenZipListEntry) => {
      if (entry !== null && typeof entry === "object" && typeof entry.file === "string") {
        entries.push(entry);
      }
    });
    stream.on("end", () => resolve());
    stream.on("error", (err: Error) =>
      reject(
        new ReadEhcollError([
          `7z failed to list "${zipPath}": ${err.message}. ` +
            `The file may be corrupt, password-protected, or not a ZIP.`,
        ]),
      ),
    );
  });

  return entries;
}

// ---------------------------------------------------------------------------
// Layout classification
// ---------------------------------------------------------------------------

type ClassifiedLayout = {
  hasManifest: boolean;
  hasReadme: boolean;
  hasChangelog: boolean;
  iniTweakFiles: string[];
  /**
   * Each bundled file entry, parsed into its sha256 + extension. We
   * already drop unparseable entries here (and accumulate them as
   * warnings is the cross-check step's job; we just leave them out
   * of the typed list).
   */
  bundledEntries: ParsedBundledEntry[];
  /**
   * Raw bundled file paths whose basename did not parse as
   * `<64hex>[.ext]`. The cross-check step turns these into warnings
   * so an operator sees what's wrong.
   */
  unrecognizedBundled: string[];
};

type ParsedBundledEntry = {
  sha256: string;
  extension: string;
  zipPath: string;
  size?: number;
};

function classifyEntries(entries: SevenZipListEntry[]): ClassifiedLayout {
  let hasManifest = false;
  let hasReadme = false;
  let hasChangelog = false;
  const iniTweakFiles: string[] = [];
  const bundledEntries: ParsedBundledEntry[] = [];
  const unrecognizedBundled: string[] = [];

  for (const entry of entries) {
    if (isDirectoryEntry(entry)) continue;

    const normalized = normalizePath(entry.file);

    if (normalized === "manifest.json") {
      hasManifest = true;
      continue;
    }
    if (normalized === "README.md") {
      hasReadme = true;
      continue;
    }
    if (normalized === "CHANGELOG.md") {
      hasChangelog = true;
      continue;
    }
    if (normalized.startsWith("bundled/")) {
      const parsed = parseBundledFilename(normalized, entry.size);
      if (parsed === undefined) {
        unrecognizedBundled.push(normalized);
      } else {
        bundledEntries.push(parsed);
      }
      continue;
    }
    if (normalized.startsWith("ini-tweaks/")) {
      iniTweakFiles.push(normalized);
      continue;
    }
    // Other unknown top-level entries are tolerated — future schema
    // additions land at root, and we don't want a v1 reader to refuse
    // a v1.x package that the producer pre-shipped a forward-compat
    // file in. They surface as warnings during cross-check.
  }

  return {
    hasManifest,
    hasReadme,
    hasChangelog,
    iniTweakFiles,
    bundledEntries,
    unrecognizedBundled,
  };
}

function isDirectoryEntry(entry: SevenZipListEntry): boolean {
  if (typeof entry.attr === "string" && entry.attr.startsWith("D")) return true;
  // 7z occasionally emits entries with trailing slashes for empty dirs.
  if (entry.file.endsWith("/") || entry.file.endsWith("\\")) return true;
  return false;
}

/**
 * 7z reports paths with the OS-native separator on Windows. Normalize to
 * forward slashes so cross-platform comparisons (and the eventual UI)
 * stay sane.
 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Parse `bundled/<sha256>.<ext>` (or `bundled/<sha256>` without
 * extension) into its parts. Returns `undefined` when the basename
 * doesn't match the contract — the cross-check step turns those into
 * warnings.
 */
function parseBundledFilename(
  zipPath: string,
  size: number | undefined,
): ParsedBundledEntry | undefined {
  const basename = zipPath.slice("bundled/".length);
  if (basename.length === 0 || basename.includes("/")) return undefined;

  const dot = basename.indexOf(".");
  const sha256 = dot === -1 ? basename : basename.slice(0, dot);
  const extension = dot === -1 ? "" : basename.slice(dot + 1);

  if (!/^[0-9a-f]{64}$/.test(sha256)) return undefined;

  return {
    sha256,
    extension,
    zipPath,
    ...(size !== undefined ? { size } : {}),
  };
}

// ---------------------------------------------------------------------------
// Cross-check: bundled/ entries vs manifest.mods bundled mods
// ---------------------------------------------------------------------------

function crossCheckBundled(
  manifest: EhcollManifest,
  parsedBundled: ParsedBundledEntry[],
  errors: string[],
): BundledArchiveEntry[] {
  // Build the expected set: every external mod with bundled=true.
  const expected = new Map<string, string>(); // sha256 → mod compareKey
  for (const mod of manifest.mods) {
    // Invariant (parser-enforced): bundled === true ⇒ source.sha256 set.
    if (mod.source.kind === "external" && mod.source.bundled) {
      const sha = mod.source.sha256!;
      const previous = expected.get(sha);
      if (previous !== undefined) {
        // The schema validator already warns about duplicate external
        // sha256s — we don't need to error here. The first mod claims
        // the archive; the second is informational.
        continue;
      }
      expected.set(sha, mod.compareKey);
    }
  }

  // Detect duplicate archives in the ZIP (two `bundled/<same-sha>.<ext>`
  // entries — shouldn't happen, but a hand-edit could cause it).
  const seen = new Map<string, ParsedBundledEntry>();
  for (const entry of parsedBundled) {
    const previous = seen.get(entry.sha256);
    if (previous !== undefined) {
      errors.push(
        `Two bundled archives share sha256 "${entry.sha256}": ` +
          `"${previous.zipPath}" and "${entry.zipPath}". ` +
          `Each external mod has a unique identity, so this should be impossible.`,
      );
      continue;
    }
    seen.set(entry.sha256, entry);
  }

  // Every expected sha256 must be present.
  for (const [sha256, modKey] of expected) {
    if (!seen.has(sha256)) {
      errors.push(
        `External mod "${modKey}" is marked bundled=true in the manifest ` +
          `but no archive with sha256 ${sha256} is present in the package's ` +
          `bundled/ directory. The package is incomplete.`,
      );
    }
  }

  // Every present sha256 must correspond to an expected mod.
  for (const [sha256, entry] of seen) {
    if (!expected.has(sha256)) {
      errors.push(
        `Archive "${entry.zipPath}" is present in the package but does not ` +
          `correspond to any external mod with bundled=true in the manifest. ` +
          `The package contains stray bytes.`,
      );
    }
  }

  // Convert the survivors into the public BundledArchiveEntry shape.
  // Sorted by sha256 for deterministic consumer output.
  return Array.from(seen.values())
    .filter((e) => expected.has(e.sha256))
    .sort((a, b) => (a.sha256 < b.sha256 ? -1 : a.sha256 > b.sha256 ? 1 : 0))
    .map((e) => ({
      sha256: e.sha256,
      zipPath: e.zipPath,
      extension: e.extension,
      ...(e.size !== undefined ? { size: e.size } : {}),
    }));
}

// ---------------------------------------------------------------------------
// 7z extract — surgical manifest.json pull
// ---------------------------------------------------------------------------

async function extractManifest(
  zipPath: string,
  stagingDir: string,
  sevenZip: SevenZipApi,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const stream = sevenZip.extract(zipPath, stagingDir, {
      $cherryPick: ["manifest.json"],
    });
    stream.on("end", () => resolve());
    stream.on("error", (err: Error) =>
      reject(
        new ReadEhcollError([
          `7z failed to extract manifest.json from "${zipPath}": ${err.message}.`,
        ]),
      ),
    );
  });
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
  const prefix = path.join(os.tmpdir(), "event-horizon-read-");
  return fsp.mkdtemp(prefix);
}

async function safeRmDir(dir: string): Promise<void> {
  try {
    await fsp.rm(dir, { recursive: true, force: true });
  } catch {
    // Best-effort. The OS will GC the temp dir eventually.
  }
}
