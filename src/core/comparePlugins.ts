import * as fs from "fs/promises";
import * as path from "path";
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

const LOCAL_APPDATA_GAME_FOLDER_BY_GAME_ID: Record<string, string> = {
  fallout4: "Fallout4",
  skyrimse: "Skyrim Special Edition",
  skyrim: "Skyrim",
};

function normalizePluginName(name: string): string {
  return name.trim().replace(/^\*/, "").toLowerCase();
}

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

export function getCurrentPluginsTxtPath(gameId: string): string {
  const folderName = LOCAL_APPDATA_GAME_FOLDER_BY_GAME_ID[gameId];

  if (!folderName) {
    throw new Error(`Unsupported gameId for plugins.txt: ${gameId}`);
  }

  return path.join(getLocalAppDataPath(), folderName, "plugins.txt");
}

export async function comparePluginsTxtFiles(params: {
  referenceFilePath: string;
  currentFilePath: string;
}): Promise<PluginsTxtDiffReport> {
  const { referenceFilePath, currentFilePath } = params;

  const [referenceContent, currentContent] = await Promise.all([
    fs.readFile(referenceFilePath, "utf8"),
    fs.readFile(currentFilePath, "utf8"),
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
    `vortex-plugins-diff-${gameId}-${Date.now()}.json`,
  );

  await fs.writeFile(filePath, JSON.stringify(diff, null, 2), "utf8");

  return filePath;
}
