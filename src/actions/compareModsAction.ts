import * as fs from "fs/promises";
import * as path from "path";
import { util, type types } from "vortex-api";

import {
  compareSnapshots,
  exportDiffReport,
  type ExportedModsSnapshot,
  pickJsonFile,
} from "../utils/utils";

import {
  getActiveGameId,
  getActiveProfileIdFromState,
  getModsForProfile,
} from "../core/getModsListForProfile";

import { openFolder, openFile } from "../utils/utils";

export default function createCompareModsAction(
  context: types.IExtensionContext,
): () => Promise<void> {
  return async () => {
    try {
      const state = context.api.getState();

      const gameId = getActiveGameId(state);
      if (!gameId) {
        throw new Error("No active game found");
      }

      const profileId = getActiveProfileIdFromState(state, gameId);
      if (!profileId) {
        throw new Error(`No profile found for game ${gameId}`);
      }

      const referenceFilePath = await pickJsonFile();

      if (!referenceFilePath) {
        return;
      }

      const referenceRaw = await fs.readFile(referenceFilePath, "utf8");
      const referenceSnapshot = JSON.parse(
        referenceRaw,
      ) as ExportedModsSnapshot;

      const currentMods = getModsForProfile(state, gameId, profileId);

      const currentSnapshot: ExportedModsSnapshot = {
        exportedAt: new Date().toISOString(),
        gameId,
        profileId,
        count: currentMods.length,
        mods: currentMods,
      };

      const diff = compareSnapshots(referenceSnapshot, currentSnapshot);

      const appDataPath = util.getVortexPath("appData");
      const outputDir = path.join(appDataPath, "mod-monitor", "diffs");

      const diffPath = await exportDiffReport({
        diff,
        outputDir,
        gameId,
      });

      console.log(
        `[Vortex Mod Monitor] Diff generated | referenceOnly=${diff.summary.onlyInReference} | currentOnly=${diff.summary.onlyInCurrent} | changed=${diff.summary.changed}`,
      );

      context.api.sendNotification?.({
        type: "success",
        message: `Diff ready | Reference only: ${diff.summary.onlyInReference} | Current only: ${diff.summary.onlyInCurrent} | Changed: ${diff.summary.changed}`,
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
        message: `Compare failed: ${message}`,
      });

      console.error("[Vortex Mod Monitor] Compare failed:", error);
    }
  };
}
