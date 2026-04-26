import * as path from "path";
import { util } from "vortex-api";
import type { types } from "vortex-api";

import { getActiveGameId } from "../core/getModsListForProfile";
import {
  comparePluginsTxtFiles,
  exportPluginsDiffReport,
  getCurrentPluginsTxtPath,
} from "../core/comparePlugins";
import { openFile, openFolder } from "../utils/utils";
import { pickTxtFile } from "../utils/utils";

export function createComparePluginsAction(
  context: types.IExtensionContext,
): () => Promise<void> {
  return async () => {
    try {
      const state = context.api.getState();

      const gameId = getActiveGameId(state);
      if (!gameId) {
        throw new Error("No active game found");
      }

      const referenceFilePath = await pickTxtFile();

      if (!referenceFilePath) {
        return;
      }

      const currentFilePath = getCurrentPluginsTxtPath(gameId);

      const diff = await comparePluginsTxtFiles({
        referenceFilePath,
        currentFilePath,
      });

      const appDataPath = util.getVortexPath("appData");
      const outputDir = path.join(appDataPath, "event-horizon", "plugin-diffs");

      const diffPath = await exportPluginsDiffReport({
        diff,
        outputDir,
        gameId,
      });

      console.log(
        `[Vortex Event Horizon] Plugins diff | game=${gameId} | referenceOnly=${diff.summary.onlyInReference} | currentOnly=${diff.summary.onlyInCurrent} | enabledMismatch=${diff.summary.enabledMismatch} | positionChanged=${diff.summary.positionChanged}`,
      );

      context.api.sendNotification?.({
        type: "success",
        message: `Plugins diff | Ref only: ${diff.summary.onlyInReference} | Current only: ${diff.summary.onlyInCurrent} | Enabled: ${diff.summary.enabledMismatch} | Order: ${diff.summary.positionChanged}`,
        actions: [
          {
            title: "Open Diff",
            action: () => {
              openFile(diffPath);
            },
          },
          {
            title: "Open Folder",
            action: () => {
              openFolder(outputDir);
            },
          },
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      context.api.sendNotification?.({
        type: "error",
        message: `Plugins compare failed: ${message}`,
      });

      console.error("[Vortex Event Horizon] Plugins compare failed:", error);
    }
  };
}
