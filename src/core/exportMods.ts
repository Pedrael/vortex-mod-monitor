import * as fs from "fs/promises";
import * as path from "path";

import type { CapturedDeploymentManifest } from "./deploymentManifest";

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
}) {
  const { mods, gameId, profileId, outputDir, deploymentManifests } = params;

  await fs.mkdir(outputDir, { recursive: true });

  const fileName = `vortex-mods-${gameId}-${profileId}-${Date.now()}.json`;
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

  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");

  return filePath;
}
