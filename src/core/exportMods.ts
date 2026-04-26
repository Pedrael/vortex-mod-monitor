import * as fs from "fs/promises";
import * as path from "path";

import type { CapturedDeploymentManifest } from "./deploymentManifest";
import type { CapturedLoadOrderEntry } from "./loadOrder";

export async function exportModsToJsonFile(params: {
  mods: unknown[];
  gameId: string;
  profileId: string;
  outputDir: string;
  /**
   * Optional deployment manifests captured at export time. When provided,
   * embedded into the snapshot under `deploymentManifests`. Omitted from
   * the JSON entirely when undefined (keeps older-format-compatible
   * snapshots when capture was skipped or failed).
   */
  deploymentManifests?: CapturedDeploymentManifest[];
  /**
   * Optional per-game load order captured at export time. Always emitted
   * when provided (even if empty), so reference snapshots from
   * LoadOrder-API games carry it. Omitted from the JSON entirely when
   * undefined (forward-compat with future captures and pre-slice-4 files).
   */
  loadOrder?: CapturedLoadOrderEntry[];
}) {
  const {
    mods,
    gameId,
    profileId,
    outputDir,
    deploymentManifests,
    loadOrder,
  } = params;

  await fs.mkdir(outputDir, { recursive: true });

  const fileName = `event-horizon-mods-${gameId}-${profileId}-${Date.now()}.json`;
  const filePath = path.join(outputDir, fileName);

  const payload: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    gameId,
    profileId,
    count: mods.length,
    mods,
  };

  if (deploymentManifests !== undefined) {
    payload.deploymentManifests = deploymentManifests;
  }

  if (loadOrder !== undefined) {
    payload.loadOrder = loadOrder;
  }

  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");

  return filePath;
}
