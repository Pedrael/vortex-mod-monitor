// src/core/exportMods.ts
import * as fs from "fs/promises";
import * as path from "path";

export async function exportModsToJsonFile(params: {
  mods: unknown[];
  gameId: string;
  profileId: string;
  outputDir: string;
}) {
  const { mods, gameId, profileId, outputDir } = params;

  await fs.mkdir(outputDir, { recursive: true });

  const fileName = `vortex-mods-${gameId}-${profileId}-${Date.now()}.json`;
  const filePath = path.join(outputDir, fileName);

  await fs.writeFile(
    filePath,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        gameId,
        profileId,
        count: mods.length,
        mods,
      },
      null,
      2,
    ),
    "utf8",
  );

  return filePath;
}
