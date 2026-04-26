import * as path from "path";
import { util } from "vortex-api";
import type { types } from "vortex-api";

import {
  getActiveGameId,
  getActiveProfileIdFromState,
  getModsForProfile,
} from "../core/getModsListForProfile";
import { enrichModsWithArchiveHashes } from "../core/archiveHashing";
import { captureDeploymentManifests } from "../core/deploymentManifest";
import { exportModsToJsonFile } from "../core/exportMods";
import { openFile, openFolder } from "../utils/utils";

export default function createExportModsAction(
  context: types.IExtensionContext,
): () => Promise<void> {
  return async () => {
    const hashingNotificationId = "vortex-mod-monitor:hashing";
    let hashingNotificationShown = false;

    try {
      const state = context.api.getState();

      const gameId = getActiveGameId(state);
      if (!gameId) throw new Error("No active game found");

      const profileId = getActiveProfileIdFromState(state, gameId);
      if (!profileId) throw new Error(`No profile found for game ${gameId}`);

      const rawMods = getModsForProfile(state, gameId, profileId);

      context.api.sendNotification?.({
        id: hashingNotificationId,
        type: "activity",
        message: `Hashing ${rawMods.length} mod archives...`,
      });
      hashingNotificationShown = true;

      const mods = await enrichModsWithArchiveHashes(
        state,
        gameId,
        rawMods,
        { concurrency: 4 },
      );

      context.api.dismissNotification?.(hashingNotificationId);
      hashingNotificationShown = false;

      const deploymentManifests = await captureDeploymentManifests(
        context.api,
        state,
        gameId,
      );

      const fomodDetectedCount = mods.filter(
        (mod) => mod.installerType === "fomod",
      ).length;

      const detailedFomodCount = mods.filter(
        (mod) => mod.hasDetailedInstallerChoices,
      ).length;

      const hashedCount = mods.filter(
        (mod) => mod.archiveSha256 !== undefined,
      ).length;

      const deployedFileCount = deploymentManifests.reduce(
        (sum, m) => sum + m.entryCount,
        0,
      );

      const appDataPath = util.getVortexPath("appData");
      const outputDir = path.join(appDataPath, "mod-monitor", "exports");

      const filePath = await exportModsToJsonFile({
        mods,
        gameId,
        profileId,
        outputDir,
        deploymentManifests,
      });

      console.log(
        `[Vortex Mod Monitor] Exported ${mods.length} mods | game=${gameId} | profile=${profileId} | fomod=${fomodDetectedCount} | detailed=${detailedFomodCount} | hashed=${hashedCount}/${mods.length} | deployedFiles=${deployedFileCount} across ${deploymentManifests.length} modtype(s)`,
      );

      context.api.sendNotification?.({
        type: "success",
        message: `Exported ${mods.length} mods | FOMOD: ${fomodDetectedCount} | Hashed: ${hashedCount}/${mods.length} | Deployed files: ${deployedFileCount}`,
        actions: [
          {
            title: "Open Export",
            action: () => openFile(filePath),
          },
          {
            title: "Open Folder",
            action: () => openFolder(outputDir),
          },
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      context.api.sendNotification?.({
        type: "error",
        message: `Export failed: ${message}`,
      });

      console.error("[Vortex Mod Monitor] Export failed:", error);
    } finally {
      if (hashingNotificationShown) {
        context.api.dismissNotification?.(hashingNotificationId);
      }
    }
  };
}
