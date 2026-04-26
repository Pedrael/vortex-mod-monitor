import { exec } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import type { AuditorMod } from "../core/getModsListForProfile";
import type { CapturedDeploymentManifest } from "../core/deploymentManifest";
import type { CapturedLoadOrderEntry } from "../core/loadOrder";

export function openFolder(folderPath: string) {
  exec(`start "" "${folderPath}"`);
}
export function openFile(filePath: string) {
  exec(`start "" "${filePath}"`);
}

export function findInObject(
  obj: unknown,
  predicate: (key: string, value: unknown, path: string) => boolean,
  currentPath = "state",
  results: Array<{ path: string; key: string; value: unknown }> = [],
  seen = new WeakSet<object>(),
) {
  if (!obj || typeof obj !== "object") return results;

  if (seen.has(obj as object)) return results;
  seen.add(obj as object);

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const nextPath = `${currentPath}.${key}`;

    if (predicate(key, value, nextPath)) {
      results.push({ path: nextPath, key, value });
    }

    if (value && typeof value === "object") {
      findInObject(value, predicate, nextPath, results, seen);
    }
  }

  return results;
}

export async function pickJsonFile(): Promise<string | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const electron = require("electron");

  const dialog = electron.remote?.dialog ?? electron.dialog;

  if (!dialog?.showOpenDialog) {
    throw new Error("Electron dialog is not available");
  }

  const result = await dialog.showOpenDialog({
    title: "Select reference Mod Auditor JSON",
    properties: ["openFile"],
    filters: [
      {
        name: "JSON files",
        extensions: ["json"],
      },
    ],
  });

  if (result.canceled || !result.filePaths?.length) {
    return undefined;
  }

  return result.filePaths[0];
}

export type ExportedModsSnapshot = {
  exportedAt?: string;
  gameId: string;
  profileId: string;
  count?: number;
  mods: AuditorMod[];

  /**
   * Per-modtype deployment manifests captured on export only.
   *
   * Optional because:
   *   1. Older snapshot files (pre-Phase 1 slice 3) won't have it.
   *   2. The Compare Mods action builds a current-side snapshot
   *      synchronously without `api`, so it cannot capture manifests.
   *
   * NOT diffed yet — `compareMods` ignores it. Captured here so that the
   * future installer (Phase 4+) can plan reconciliation against the
   * curator's actual deployment winners.
   */
  deploymentManifests?: CapturedDeploymentManifest[];

  /**
   * Per-game load order from `state.persistent.loadOrder[gameId]`.
   *
   * Optional because:
   *   1. Older snapshot files (pre-Phase 1 slice 4) won't have it.
   *   2. Games that drive load order purely via `plugins.txt` will emit
   *      an empty array; we still emit the field for forward-compat.
   *
   * Distinct from `plugins.txt` — covers non-plugin mods (script
   * extenders, ENB, etc.) on games that use Vortex's LoadOrder API.
   * NOT diffed yet — captured for the future installer.
   */
  loadOrder?: CapturedLoadOrderEntry[];
};

export type ModFieldDifference = {
  field: string;
  referenceValue: unknown;
  currentValue: unknown;
};

export type ChangedModReport = {
  compareKey: string;
  reference: AuditorMod;
  current: AuditorMod;
  differences: ModFieldDifference[];
};

export type ModsDiffReport = {
  generatedAt: string;

  reference: {
    gameId?: string;
    profileId?: string;
    exportedAt?: string;
    count: number;
  };

  current: {
    gameId?: string;
    profileId?: string;
    exportedAt?: string;
    count: number;
  };

  summary: {
    onlyInReference: number;
    onlyInCurrent: number;
    changed: number;
  };

  onlyInReference: AuditorMod[];
  onlyInCurrent: AuditorMod[];
  changed: ChangedModReport[];
};

export function getModCompareKey(mod: AuditorMod): string {
  if (mod.nexusModId !== undefined && mod.nexusFileId !== undefined) {
    return `nexus:${mod.nexusModId}:${mod.nexusFileId}`;
  }

  if (mod.archiveId) {
    return `archive:${mod.archiveId}`;
  }

  return `id:${mod.id}`;
}

/**
 * Recursively sort object keys for byte-stable JSON serialization.
 * Arrays preserve their order (their order is meaningful); only object
 * key ordering is normalized.
 *
 * Used by:
 *  - `deepEqualStable` for order-insensitive comparisons.
 *  - `core/manifest/packageZip` for deterministic `manifest.json` output.
 */
export function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value;
}

export function deepEqualStable(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortDeep(a)) === JSON.stringify(sortDeep(b));
}

export function compareMods(
  referenceMod: AuditorMod,
  currentMod: AuditorMod,
): ModFieldDifference[] {
  const compareFields: Array<keyof AuditorMod> = [
    "name",
    "version",
    "enabled",
    "source",
    "nexusModId",
    "nexusFileId",
    "archiveId",
    "archiveSha256",
    "collectionIds",
    "installerType",
    "hasInstallerChoices",
    "hasDetailedInstallerChoices",
    "fomodSelections",
    "rules",
    "modType",
    "fileOverrides",
    "enabledINITweaks",
    "installTime",
    "installOrder",
  ];

  const differences: ModFieldDifference[] = [];

  for (const field of compareFields) {
    if (!deepEqualStable(referenceMod[field], currentMod[field])) {
      differences.push({
        field: String(field),
        referenceValue: referenceMod[field],
        currentValue: currentMod[field],
      });
    }
  }

  return differences;
}

function buildModsMap(mods: AuditorMod[]): Map<string, AuditorMod> {
  const map = new Map<string, AuditorMod>();

  for (const mod of mods) {
    map.set(getModCompareKey(mod), mod);
  }

  return map;
}

export function compareSnapshots(
  referenceSnapshot: ExportedModsSnapshot,
  currentSnapshot: ExportedModsSnapshot,
): ModsDiffReport {
  const referenceMap = buildModsMap(referenceSnapshot.mods ?? []);
  const currentMap = buildModsMap(currentSnapshot.mods ?? []);

  const onlyInReference: AuditorMod[] = [];
  const onlyInCurrent: AuditorMod[] = [];
  const changed: ChangedModReport[] = [];

  for (const [compareKey, referenceMod] of referenceMap.entries()) {
    const currentMod = currentMap.get(compareKey);

    if (!currentMod) {
      onlyInReference.push(referenceMod);
      continue;
    }

    const differences = compareMods(referenceMod, currentMod);

    if (differences.length > 0) {
      changed.push({
        compareKey,
        reference: referenceMod,
        current: currentMod,
        differences,
      });
    }
  }

  for (const [compareKey, currentMod] of currentMap.entries()) {
    if (!referenceMap.has(compareKey)) {
      onlyInCurrent.push(currentMod);
    }
  }

  return {
    generatedAt: new Date().toISOString(),

    reference: {
      gameId: referenceSnapshot.gameId,
      profileId: referenceSnapshot.profileId,
      exportedAt: referenceSnapshot.exportedAt,
      count: referenceSnapshot.mods?.length ?? 0,
    },

    current: {
      gameId: currentSnapshot.gameId,
      profileId: currentSnapshot.profileId,
      exportedAt: currentSnapshot.exportedAt,
      count: currentSnapshot.mods?.length ?? 0,
    },

    summary: {
      onlyInReference: onlyInReference.length,
      onlyInCurrent: onlyInCurrent.length,
      changed: changed.length,
    },

    onlyInReference,
    onlyInCurrent,
    changed,
  };
}

export async function exportDiffReport(params: {
  diff: ModsDiffReport;
  outputDir: string;
  gameId: string;
}): Promise<string> {
  const { diff, outputDir, gameId } = params;

  await fs.mkdir(outputDir, { recursive: true });

  const filePath = path.join(
    outputDir,
    `event-horizon-mod-diff-${gameId}-${Date.now()}.json`,
  );

  await fs.writeFile(filePath, JSON.stringify(diff, null, 2), "utf8");

  return filePath;
}

export async function pickTxtFile(): Promise<string | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const electron = require("electron");

  const dialog = electron.remote?.dialog ?? electron.dialog;

  if (!dialog?.showOpenDialog) {
    throw new Error("Electron dialog is not available");
  }

  const result = await dialog.showOpenDialog({
    title: "Select reference plugins.txt",
    properties: ["openFile"],
    filters: [
      {
        name: "Text files",
        extensions: ["txt"],
      },
      {
        name: "All files",
        extensions: ["*"],
      },
    ],
  });

  if (result.canceled || !result.filePaths?.length) {
    return undefined;
  }

  return result.filePaths[0];
}
