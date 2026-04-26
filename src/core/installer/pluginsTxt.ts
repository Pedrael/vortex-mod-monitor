/**
 * `plugins.txt` writer with backup — Phase 3 slice 6.
 *
 * Bethesda games store the active load order in
 * `%LOCALAPPDATA%/<game>/plugins.txt`. Vortex updates this file as
 * part of deployment, but the curator's intended order is captured at
 * `.ehcoll` build time and replicated here verbatim.
 *
 * Spec: docs/business/INSTALL_DRIVER.md (§ plugins.txt write)
 *
 * ─── FORMAT NOTES ──────────────────────────────────────────────────────
 * Two distinct file formats coexist in the Bethesda lineage:
 *
 *  • **"asterisk" format** — Skyrim LE, Skyrim SE, Fallout 4, Starfield:
 *        *Skyrim.esm        ← enabled
 *        Update.esm         ← present-but-disabled
 *
 *  • **"legacy" format** — Fallout 3, Fallout New Vegas:
 *        FalloutNV.esm      ← all entries are implicitly enabled
 *
 * In the legacy format, "disabled" means "not in the file." This module
 * writes the right format for the active gameId.
 *
 * The encoding for asterisk-format files is **UTF-16 LE with BOM**
 * (Windows convention; SSE expects this and treats UTF-8 files as
 * unrecognized). Legacy format is plain ANSI / UTF-8.
 *
 * ─── BACKUP ────────────────────────────────────────────────────────────
 * Before overwriting, we copy the existing `plugins.txt` to
 * `plugins.txt.eh-backup-<unix-ms>`. Unique-per-run so multiple installs
 * never trample each other's backups. The user can restore manually if
 * something goes wrong.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

import type { EhcollPluginEntry } from "../../types/ehcoll";

/**
 * Maps our supported game ids to their `%LOCALAPPDATA%/<folder>/`
 * folder names. Sourced from Bethesda's published conventions and
 * cross-checked against Vortex's game extensions.
 */
const LOCAL_APPDATA_GAME_FOLDER_BY_GAME_ID: Record<string, string> = {
  skyrim: "Skyrim",
  skyrimse: "Skyrim Special Edition",
  fallout3: "Fallout3",
  falloutnv: "FalloutNV",
  fallout4: "Fallout4",
  starfield: "Starfield",
};

/**
 * Game ids whose `plugins.txt` uses the legacy format
 * (enabled-only, no asterisk prefix, no UTF-16 BOM).
 */
const LEGACY_FORMAT_GAME_IDS: ReadonlySet<string> = new Set([
  "fallout3",
  "falloutnv",
]);

export type WritePluginsTxtResult = {
  /** Absolute path of the file that was written. */
  pluginsTxtPath: string;
  /**
   * Absolute path of the backup, if one was created (the file existed
   * before). Undefined when no prior file existed.
   */
  backupPath?: string;
};

/**
 * Resolve the absolute path of `plugins.txt` for the given game.
 * Throws if the gameId isn't supported.
 */
export function resolvePluginsTxtPath(gameId: string): string {
  const folderName = LOCAL_APPDATA_GAME_FOLDER_BY_GAME_ID[gameId];

  if (!folderName) {
    throw new Error(
      `plugins.txt path resolution is not supported for gameId "${gameId}". ` +
        `Supported: ${Object.keys(LOCAL_APPDATA_GAME_FOLDER_BY_GAME_ID).join(", ")}.`,
    );
  }

  return path.join(getLocalAppDataPath(), folderName, "plugins.txt");
}

/**
 * Serialize an `EhcollPluginEntry[]` into the bytes that Bethesda
 * expects for the given game. UTF-16 LE for modern games, UTF-8 for
 * legacy ones.
 */
export function serializePluginsTxt(
  gameId: string,
  entries: EhcollPluginEntry[],
): Buffer {
  if (LEGACY_FORMAT_GAME_IDS.has(gameId)) {
    return serializeLegacyFormat(entries);
  }
  return serializeAsteriskFormat(entries);
}

/**
 * Write a fresh `plugins.txt` to the game's local-AppData folder,
 * backing up any existing file first. The parent directory is created
 * if missing (rare but possible when the user has never launched the
 * game on this machine).
 *
 * @returns the path written and (if applicable) the backup path.
 */
export async function writePluginsTxtWithBackup(args: {
  gameId: string;
  entries: EhcollPluginEntry[];
}): Promise<WritePluginsTxtResult> {
  const { gameId, entries } = args;

  const pluginsTxtPath = resolvePluginsTxtPath(gameId);
  const dir = path.dirname(pluginsTxtPath);

  await fsp.mkdir(dir, { recursive: true });

  let backupPath: string | undefined;
  try {
    await fsp.access(pluginsTxtPath);
    backupPath = `${pluginsTxtPath}.eh-backup-${Date.now()}`;
    await fsp.copyFile(pluginsTxtPath, backupPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
    // No existing file → nothing to back up.
  }

  const bytes = serializePluginsTxt(gameId, entries);

  // Write atomically: tmp → rename. Avoids leaving a half-written file
  // if the process dies mid-write.
  const tmpPath = `${pluginsTxtPath}.tmp`;
  await fsp.writeFile(tmpPath, bytes);
  await fsp.rename(tmpPath, pluginsTxtPath);

  return { pluginsTxtPath, backupPath };
}

// ===========================================================================
// Internals
// ===========================================================================

function serializeAsteriskFormat(entries: EhcollPluginEntry[]): Buffer {
  const lines = entries.map((e) => (e.enabled ? `*${e.name}` : e.name));
  const text = `${lines.join("\r\n")}${lines.length > 0 ? "\r\n" : ""}`;
  return encodeUtf16LeWithBom(text);
}

function serializeLegacyFormat(entries: EhcollPluginEntry[]): Buffer {
  // Legacy format: enabled-only. Disabled entries are omitted.
  const enabled = entries.filter((e) => e.enabled).map((e) => e.name);
  const text = `${enabled.join("\r\n")}${enabled.length > 0 ? "\r\n" : ""}`;
  return Buffer.from(text, "utf8");
}

function encodeUtf16LeWithBom(text: string): Buffer {
  const bom = Buffer.from([0xff, 0xfe]);
  // Node's "utf16le" encoder writes LE without a BOM; we prepend one.
  const body = Buffer.from(text, "utf16le");
  return Buffer.concat([bom, body]);
}

function getLocalAppDataPath(): string {
  return (
    process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local")
  );
}
