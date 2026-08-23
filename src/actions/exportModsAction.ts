import * as path from "path";
import { util } from "@nexusmods/vortex-api";
import type { types } from "@nexusmods/vortex-api";

import {
  getActiveGameId,
  getActiveProfileIdFromState,
  getModsForProfile,
} from "../core/getModsListForProfile";
import { enrichModsWithArchiveHashes } from "../core/archiveHashing";
import { captureDeploymentManifests } from "../core/deploymentManifest";
import { exportModsToJsonFile } from "../core/exportMods";
import { captureLoadOrder } from "../core/loadOrder";
import { openFile, openFolder } from "../utils/utils";
import { getVortexUserDataPath } from "../core/paths";
import { beginOp } from "../core/logging/ehLog";

export default function createExportModsAction(
  context: types.IExtensionContext,
): () => Promise<void> {
  return async () => {
    const hashingNotificationId = "vortex-event-horizon:hashing";
    let hashingNotificationShown = false;
    const op = beginOp("export");

    try {
      const state = context.api.getState();

      const gameId = getActiveGameId(state);
      if (!gameId) throw new Error("No active game found");

      const profileId = getActiveProfileIdFromState(state, gameId);
      if (!profileId) throw new Error(`No profile found for game ${gameId}`);

      const rawMods = getModsForProfile(state, gameId, profileId);
      op.step("profile-resolved", {
        gameId,
        profileId,
        modCount: rawMods.length,
      });

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

      const loadOrder = captureLoadOrder(state, gameId);
      op.step("captured", {
        deploymentManifests: deploymentManifests.length,
        loadOrderEntries: loadOrder.length,
      });

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

      const appDataPath = getVortexUserDataPath();
      const outputDir = path.join(appDataPath, "event-horizon", "exports");

      const filePath = await exportModsToJsonFile({
        mods,
        gameId,
        profileId,
        outputDir,
        deploymentManifests,
        loadOrder,
      });

      console.log(
        `[Vortex Event Horizon] Exported ${mods.length} mods | game=${gameId} | profile=${profileId} | fomod=${fomodDetectedCount} | detailed=${detailedFomodCount} | hashed=${hashedCount}/${mods.length} | deployedFiles=${deployedFileCount} across ${deploymentManifests.length} modtype(s) | loadOrder=${loadOrder.length}`,
      );

      op.ok({
        gameId,
        profileId,
        mods: mods.length,
        fomodDetected: fomodDetectedCount,
        fomodDetailed: detailedFomodCount,
        // hashed < mods means some archives could not be hashed, which is the
        // single most useful number for diagnosing a non-reproducing install.
        hashed: hashedCount,
        deployedFiles: deployedFileCount,
        loadOrder: loadOrder.length,
        filePath,
      });

      context.api.sendNotification?.({
        type: "success",
        message: `Exported ${mods.length} mods | FOMOD: ${fomodDetectedCount} | Hashed: ${hashedCount}/${mods.length} | Deployed files: ${deployedFileCount} | LO: ${loadOrder.length}`,
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

      op.fail(error);
      console.error("[Vortex Event Horizon] Export failed:", error);
    } finally {
      if (hashingNotificationShown) {
        context.api.dismissNotification?.(hashingNotificationId);
      }
    }
  };
}
