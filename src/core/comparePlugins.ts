import * as fs from "fs/promises";
import { existsSync } from "fs";
import * as path from "path";

import { ehLog } from "./logging/ehLog";
import * as os from "os";

export type PluginEntry = {
  name: string;
  normalizedName: string;
  enabled: boolean;
  index: number;
};

export type PluginPositionDiff = {
  name: string;
  referenceIndex: number;
  currentIndex: number;
};

export type PluginEnabledDiff = {
  name: string;
  referenceEnabled: boolean;
  currentEnabled: boolean;
};

export type PluginsTxtDiffReport = {
  generatedAt: string;
  referenceFilePath: string;
  currentFilePath: string;
  summary: {
    referenceTotal: number;
    currentTotal: number;
    onlyInReference: number;
    onlyInCurrent: number;
    enabledMismatch: number;
    positionChanged: number;
  };
  onlyInReference: PluginEntry[];
  onlyInCurrent: PluginEntry[];
  enabledMismatch: PluginEnabledDiff[];
  positionChanged: PluginPositionDiff[];
};

/**
 * ─── THE FORMAT IS PART OF THE GAME, NOT AN ASSUMPTION ──────────────────
 * Vortex's `gamebryo-plugin-management` carries a `pluginTXTFormat` beside
 * every game's `appDataPath`, and there are two:
 *
 *   "fallout4" — one line per plugin, a leading `*` means ENABLED, and the
 *                order in the file IS the load order.
 *   "original" — a bare list of the ENABLED plugins with NO prefix, and the
 *                order lives in a separate `loadorder.txt`.
 *
 * This table used to hold folder names only, with `skyrim` (LE) among them,
 * while `parsePluginsTxt` assumed the `*` prefix for everything. On an
 * "original" game that made every line parse as DISABLED — so a curator
 * shipped an all-disabled order, and `applyPluginOrder` then dispatched
 * SET_PLUGIN_ENABLED(false) for every plugin and had Vortex serialise the
 * result. The player's plugins.txt came back holding nothing but the natives:
 * the game loaded with zero mods, and the drift check could not see it,
 * because it compares only ENABLED plugins and by then neither side had any.
 *
 * So the format is recorded, and "original" is refused rather than guessed
 * at. Refusing is not a limitation we are hiding: reproducing an "original"
 * game's load order needs `loadorder.txt`, which this module does not read.
 * That is a feature to build, not a prefix to strip — and until it exists,
 * saying so is the cheap failure and mangling the user's list is not.
 */
type PluginsTxtFormat = "fallout4" | "original";

const PLUGINS_TXT_GAMES: Record<
  string,
  { folder: string; format: PluginsTxtFormat }
> = {
  fallout4: { folder: "Fallout4", format: "fallout4" },
  skyrimse: { folder: "Skyrim Special Edition", format: "fallout4" },
  skyrimvr: { folder: "Skyrim VR", format: "fallout4" },
  fallout4vr: { folder: "Fallout4VR", format: "fallout4" },
  enderalspecialedition: {
    folder: "Enderal Special Edition",
    format: "fallout4",
  },
  // Present so the refusal below can NAME them. Leaving them out produced the
  // same silence as an unknown game, which is how `skyrim` stayed listed.
  skyrim: { folder: "Skyrim", format: "original" },
  fallout3: { folder: "Fallout3", format: "original" },
  falloutnv: { folder: "falloutnv", format: "original" },
  oblivion: { folder: "oblivion", format: "original" },
};

/** True when this game's plugins.txt is one we can read AND write correctly. */
export function supportsPluginsTxt(gameId: string): boolean {
  return PLUGINS_TXT_GAMES[gameId]?.format === "fallout4";
}

/**
 * ─── THE FOLDER NAME DEPENDS ON WHICH STORE SOLD THE GAME ──────────────
 * Copied from Vortex's own overlay, which is the authority: the same
 * `appDataPath` it uses to find plugins.txt is store-dependent, and the base
 * names above are the STEAM ones.
 *
 * This cost a real curator a real collection. Every Skyrim SE package built
 * on a GOG copy shipped `plugins.order: []` — no plugin order, no ESL flags,
 * no userlist — because the build looked in "Skyrim Special Edition" while
 * the game writes to "Skyrim Special Edition GOG". Nothing failed; the list
 * was simply empty, and an empty list is also what a game with no plugins.txt
 * legitimately produces. Fallout 4 packages from the same machine were fine,
 * which is exactly why it went unnoticed.
 */
const STORE_APPDATA_OVERRIDES: Record<string, Record<string, string>> = {
  xbox: {
    skyrimse: "Skyrim Special Edition MS",
    fallout4: "Fallout4 MS",
    oblivion: "Oblivion",
  },
  gog: {
    skyrimse: "Skyrim Special Edition GOG",
    enderalspecialedition: "Enderal Special Edition GOG",
  },
  epic: {
    skyrimse: "Skyrim Special Edition EPIC",
    fallout4: "Fallout4 EPIC",
  },
};

/**
 * Every folder this game could be using, most specific first.
 *
 * Exported for the probe below and for tests; a caller that knows the store
 * should pass it rather than relying on what happens to exist on disk.
 */
export function pluginsTxtFolderCandidates(
  gameId: string,
  store?: string,
): string[] {
  const base = PLUGINS_TXT_GAMES[gameId]?.folder;
  if (base === undefined) return [];

  // A KNOWN store is authoritative, override or not: Steam and every other
  // store without a relocation use the base folder, and there is nothing to
  // probe for. Only "we do not know" justifies looking around.
  if (store !== undefined) {
    return [STORE_APPDATA_OVERRIDES[store.toLowerCase()]?.[gameId] ?? base];
  }

  // Store unknown. Offer every variant so the probe can find the real one
  // instead of defaulting to Steam and reporting an empty profile.
  const variants = Object.values(STORE_APPDATA_OVERRIDES)
    .map((byGame) => byGame[gameId])
    .filter((f): f is string => f !== undefined);
  return [base, ...variants.filter((f) => f !== base)];
}

/**
 * Vortex's discovered store for this game, when it recorded one.
 *
 * `undefined` means "we do not know", never "Steam" — the difference decides
 * whether the caller may trust a single path or has to look.
 */
export function discoveredStore(
  state: unknown,
  gameId: string,
): string | undefined {
  const store = (
    state as {
      settings?: {
        gameMode?: { discovered?: Record<string, { store?: string }> };
      };
    }
  )?.settings?.gameMode?.discovered?.[gameId]?.store;
  return typeof store === "string" && store.length > 0 ? store : undefined;
}

function normalizePluginName(name: string): string {
  return name.trim().replace(/^\*/, "").toLowerCase();
}

/**
 * ─── plugins.txt IS latin1, NOT utf8 ───────────────────────────────────
 * Vortex's `gamebryo-plugin-management` writes it with `{encoding: "latin1"}`
 * and reads it back with `.toString("latin1")` — self-consistent, and not a
 * choice we get to make.
 *
 * Reading it as utf8 turns any non-ASCII name into replacement characters:
 * `Träume.esp` is the single byte 0xE4, which utf8 decodes to U+FFFD. The
 * mangled name goes into the manifest, `set-plugin-list` hands it to Vortex,
 * the reducer creates a phantom entry for a plugin that does not exist, and
 * the REAL plugin — absent from the list — is appended after every collection
 * plugin by the reducer's tail. A patch that had to load at position 40 loads
 * last.
 *
 * And the drift check stays silent, because it compares the user's file to
 * the manifest and both are mangled the same way. A false clean, which is the
 * expensive direction.
 */
export function parsePluginsTxt(content: string): PluginEntry[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith("#"))
    .map((line, index) => {
      const enabled = line.startsWith("*");
      const name = enabled ? line.slice(1).trim() : line;

      return {
        name,
        normalizedName: normalizePluginName(name),
        enabled,
        index,
      };
    });
}

function toPluginMap(entries: PluginEntry[]): Map<string, PluginEntry> {
  const map = new Map<string, PluginEntry>();

  for (const entry of entries) {
    map.set(entry.normalizedName, entry);
  }

  return map;
}

export function comparePluginsEntries(params: {
  referenceEntries: PluginEntry[];
  currentEntries: PluginEntry[];
  referenceFilePath: string;
  currentFilePath: string;
}): PluginsTxtDiffReport {
  const {
    referenceEntries,
    currentEntries,
    referenceFilePath,
    currentFilePath,
  } = params;

  const referenceMap = toPluginMap(referenceEntries);
  const currentMap = toPluginMap(currentEntries);

  const onlyInReference: PluginEntry[] = [];
  const onlyInCurrent: PluginEntry[] = [];
  const enabledMismatch: PluginEnabledDiff[] = [];
  const positionChanged: PluginPositionDiff[] = [];

  for (const [normalizedName, referencePlugin] of referenceMap.entries()) {
    const currentPlugin = currentMap.get(normalizedName);

    if (!currentPlugin) {
      onlyInReference.push(referencePlugin);
      continue;
    }

    if (referencePlugin.enabled !== currentPlugin.enabled) {
      enabledMismatch.push({
        name: referencePlugin.name,
        referenceEnabled: referencePlugin.enabled,
        currentEnabled: currentPlugin.enabled,
      });
    }

    if (referencePlugin.index !== currentPlugin.index) {
      positionChanged.push({
        name: referencePlugin.name,
        referenceIndex: referencePlugin.index,
        currentIndex: currentPlugin.index,
      });
    }
  }

  for (const [normalizedName, currentPlugin] of currentMap.entries()) {
    if (!referenceMap.has(normalizedName)) {
      onlyInCurrent.push(currentPlugin);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    referenceFilePath,
    currentFilePath,
    summary: {
      referenceTotal: referenceEntries.length,
      currentTotal: currentEntries.length,
      onlyInReference: onlyInReference.length,
      onlyInCurrent: onlyInCurrent.length,
      enabledMismatch: enabledMismatch.length,
      positionChanged: positionChanged.length,
    },
    onlyInReference,
    onlyInCurrent,
    enabledMismatch,
    positionChanged,
  };
}

function getLocalAppDataPath(): string {
  return (
    process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local")
  );
}

export function getCurrentPluginsTxtPath(
  gameId: string,
  /**
   * Vortex's discovered store, from {@link discoveredStore}. When known it
   * decides the folder outright; when not, the existing file wins — see the
   * probe below, and the note on STORE_APPDATA_OVERRIDES for why guessing
   * Steam is the one answer that must not be silent.
   */
  store?: string,
): string {
  const game = PLUGINS_TXT_GAMES[gameId];

  if (game === undefined) {
    throw new Error(`Unsupported gameId for plugins.txt: ${gameId}`);
  }

  // Named, not silent. Every caller of this treats a throw as "no plugin
  // ordering for this game", which is the correct outcome — but a user asking
  // why deserves the reason rather than "unsupported".
  if (game.format === "original") {
    throw new Error(
      `${gameId} uses the "original" plugins.txt format, which lists only ` +
        `enabled plugins with no prefix and keeps the load order in a ` +
        `separate loadorder.txt. Event Horizon does not read that yet, so it ` +
        `does not touch plugin order for this game rather than guess at it.`,
    );
  }

  const local = getLocalAppDataPath();
  const candidates = pluginsTxtFolderCandidates(gameId, store);
  const paths = candidates.map((f) => path.join(local, f, "plugins.txt"));

  // A known store is authoritative even if the file is not there yet.
  if (store !== undefined && paths.length === 1) return paths[0]!;

  const present = paths.filter((f) => existsSync(f));
  if (present.length === 1) return present[0]!;
  if (present.length > 1) {
    // Both a Steam and a store-specific folder exist — someone changed
    // editions. Without a discovered store there is no way to tell which the
    // game is using, and picking silently is how the wrong one gets shipped.
    ehLog("warn", "plugins-txt.ambiguous-store", { gameId, present });
    return present[0]!;
  }

  ehLog("warn", "plugins-txt.not-found", { gameId, store, tried: paths });
  return paths[0]!;
}

export async function comparePluginsTxtFiles(params: {
  referenceFilePath: string;
  currentFilePath: string;
}): Promise<PluginsTxtDiffReport> {
  const { referenceFilePath, currentFilePath } = params;

  const [referenceContent, currentContent] = await Promise.all([
    // latin1: see the note above parsePluginsTxt.
    fs.readFile(referenceFilePath, "latin1"),
    fs.readFile(currentFilePath, "latin1"),
  ]);

  return comparePluginsEntries({
    referenceEntries: parsePluginsTxt(referenceContent),
    currentEntries: parsePluginsTxt(currentContent),
    referenceFilePath,
    currentFilePath,
  });
}

export async function exportPluginsDiffReport(params: {
  diff: PluginsTxtDiffReport;
  outputDir: string;
  gameId: string;
}): Promise<string> {
  const { diff, outputDir, gameId } = params;

  await fs.mkdir(outputDir, { recursive: true });

  const filePath = path.join(
    outputDir,
    `event-horizon-plugins-diff-${gameId}-${Date.now()}.json`,
  );

  await fs.writeFile(filePath, JSON.stringify(diff, null, 2), "utf8");

  return filePath;
}
