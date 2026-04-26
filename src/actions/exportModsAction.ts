import * as path from "path";
import { util } from "vortex-api";
import type { types } from "vortex-api";

import {
  getActiveGameId,
  getActiveProfileIdFromState,
  getModsForProfile,
} from "../core/getModsListForProfile";
import { exportModsToJsonFile } from "../core/exportMods";
import { openFile, openFolder } from "../utils/utils";

export default function createExportModsAction(
  context: types.IExtensionContext,
): () => Promise<void> {
  return async () => {
    try {
      const state = context.api.getState();

      const gameId = getActiveGameId(state);
      if (!gameId) throw new Error("No active game found");

      const profileId = getActiveProfileIdFromState(state, gameId);
      if (!profileId) throw new Error(`No profile found for game ${gameId}`);

      const mods = getModsForProfile(state, gameId, profileId);

      const fomodDetectedCount = mods.filter(
        (mod) => mod.installerType === "fomod",
      ).length;

      const detailedFomodCount = mods.filter(
        (mod) => mod.hasDetailedInstallerChoices,
      ).length;

      const appDataPath = util.getVortexPath("appData");
      const outputDir = path.join(appDataPath, "mod-auditor", "exports");

      const filePath = await exportModsToJsonFile({
        mods,
        gameId,
        profileId,
        outputDir,
      });

      console.log(
        `[Vortex Mod Auditor] Exported ${mods.length} mods | game=${gameId} | profile=${profileId} | fomod=${fomodDetectedCount} | detailed=${detailedFomodCount}`,
      );

      context.api.sendNotification?.({
        type: "success",
        message: `Exported ${mods.length} mods | FOMOD: ${fomodDetectedCount} | Detailed: ${detailedFomodCount}`,
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

      console.error("[Vortex Mod Auditor] Export failed:", error);
    }
  };
}
