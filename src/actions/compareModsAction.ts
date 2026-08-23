import * as fs from "fs/promises";
import * as path from "path";
import { util, type types } from "@nexusmods/vortex-api";

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
import { getVortexUserDataPath } from "../core/paths";
import { beginOp } from "../core/logging/ehLog";

export default function createCompareModsAction(
  context: types.IExtensionContext,
): () => Promise<void> {
  return async () => {
    const op = beginOp("compare-mods");
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

      const referenceFilePath = await pickJsonFile(context.api);

      if (!referenceFilePath) {
        // User cancelled the picker. Log it so a "nothing happened" report can
        // be told apart from a silent failure.
        op.ok({ cancelled: true });
        return;
      }

      const referenceRaw = await fs.readFile(referenceFilePath, "utf8");
      const referenceSnapshot = JSON.parse(
        referenceRaw,
      ) as ExportedModsSnapshot;

      const currentMods = getModsForProfile(state, gameId, profileId);
      op.step("loaded", {
        gameId,
        profileId,
        referenceFilePath,
        referenceMods: referenceSnapshot?.mods?.length,
        currentMods: currentMods.length,
      });

      const enabledMods = currentMods.filter((m) => m.enabled);
      const disabledMods = currentMods.filter((m) => !m.enabled);

      const currentSnapshot: ExportedModsSnapshot = {
        exportedAt: new Date().toISOString(),
        gameId,
        profileId,
        count: currentMods.length,
        mods: currentMods,
        enabledMods,
        disabledMods,
      };

      const diff = compareSnapshots(referenceSnapshot, currentSnapshot);

      const appDataPath = getVortexUserDataPath();
      const outputDir = path.join(appDataPath, "event-horizon", "diffs");

      const diffPath = await exportDiffReport({
        diff,
        outputDir,
        gameId,
      });

      op.ok({
        gameId,
        onlyInReference: diff.summary.onlyInReference,
        onlyInCurrent: diff.summary.onlyInCurrent,
        changed: diff.summary.changed,
        diffPath,
      });

      console.log(
        `[Vortex Event Horizon] Diff generated | referenceOnly=${diff.summary.onlyInReference} | currentOnly=${diff.summary.onlyInCurrent} | changed=${diff.summary.changed}`,
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

      op.fail(error);
      console.error("[Vortex Event Horizon] Compare failed:", error);
    }
  };
}
