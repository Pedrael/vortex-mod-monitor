/**
 * Mod diff storage — read-side utilities.
 *
 * Provides listing and reading of mod diff JSON reports produced by
 * `exportDiffReport` (utils.ts / compareModsAction.ts). Files live under:
 *
 *   <appData>/event-horizon/diffs/event-horizon-mod-diff-*.json
 *
 * Errors are never thrown to callers — missing dir → empty list, bad
 * JSON → returns undefined, so one corrupt file never crashes the
 * viewer page.
 */

import * as fsp from "fs/promises";
import * as path from "path";

import type { ModsDiffReport } from "../utils/utils";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ModDiffFileEntry {
  /** Bare filename, e.g. `event-horizon-mod-diff-skyrimse-1716909600000.json` */
  filename: string;
  /** Absolute path to the file */
  filePath: string;
  /** Game id extracted from filename */
  gameId: string;
  /**
   * Millisecond timestamp extracted from the filename suffix.
   * Falls back to 0 if the filename doesn't match the expected pattern.
   */
  timestampMs: number;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Matches `event-horizon-mod-diff-<gameId>-<timestamp>.json` */
const DIFF_FILENAME_RE =
  /^event-horizon-mod-diff-(.+)-(\d{10,15})\.json$/;

function parseFilename(
  filename: string,
): { gameId: string; timestampMs: number } | undefined {
  const m = DIFF_FILENAME_RE.exec(filename);
  if (!m) return undefined;
  return { gameId: m[1], timestampMs: Number(m[2]) };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return all mod diff files under `<appDataPath>/event-horizon/diffs/`,
 * sorted newest-first (by embedded timestamp).
 */
export async function listModDiffFiles(
  appDataPath: string,
): Promise<ModDiffFileEntry[]> {
  const dir = path.join(appDataPath, "event-horizon", "diffs");

  let entries: string[];
  try {
    entries = await fsp.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    return [];
  }

  const out: ModDiffFileEntry[] = [];
  for (const filename of entries) {
    if (!filename.toLowerCase().endsWith(".json")) continue;
    const parsed = parseFilename(filename);
    if (!parsed) continue;
    out.push({
      filename,
      filePath: path.join(dir, filename),
      gameId: parsed.gameId,
      timestampMs: parsed.timestampMs,
    });
  }

  out.sort((a, b) => b.timestampMs - a.timestampMs);
  return out;
}

/**
 * Read and parse a single mod diff report from disk.
 * Returns `undefined` if the file is missing.
 * Throws on malformed JSON (callers should handle per-file).
 */
export async function readModDiffReport(
  filePath: string,
): Promise<ModsDiffReport | undefined> {
  let raw: string;
  try {
    raw = await fsp.readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
  return JSON.parse(raw) as ModsDiffReport;
}
