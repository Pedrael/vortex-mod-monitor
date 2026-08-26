/**
 * Does parseManifest preserve everything buildManifest emits?
 *
 * Every validator in the parser constructs a FRESH object from known fields
 * and discards the rest — 36 of them. So a field can be added to the manifest
 * type, written by the builder, and silently dropped on the way in, with the
 * compiler happy and nothing failing. That is not hypothetical: the same shape
 * ate `url` and `mode` in the collection config, and `gameIniApplication` in
 * the install receipt.
 *
 * A real build through the real parser, deep-compared. It is a net, not a
 * proof — it only covers fields this fixture populates — so it is worth
 * extending whenever the manifest grows.
 */
import { describe, expect, it, afterEach } from "vitest";

import { buildManifest } from "../../src/core/manifest/buildManifest";
import { parseManifest } from "../../src/core/manifest/parseManifest";
import { captureStagingFiles } from "../../src/core/manifest/captureStagingFiles";
import { scopeCollectionMods } from "../../src/core/manifest/collectionScope";
import { makeWorld, type World } from "./world";

let world: World | undefined;
afterEach(() => {
  world?.cleanup();
  world = undefined;
});

describe("manifest round-trip", () => {
  it("parse preserves everything build emits", async () => {
    world = makeWorld({
      mods: [
        {
          id: "nexus-mod",
          name: "Nexus Mod",
          nexus: { modId: 111, fileId: 222 },
          archiveSha256: "a".repeat(64),
          files: { "Data/a.esp": "a" },
          installerChoices: {
            type: "fomod",
            options: [
              { name: "Step", groups: [{ name: "G", choices: [{ name: "C", idx: 1 }] }] },
            ],
          },
          modType: "dinput",
          version: "1.2.3",
        },
        {
          id: "ext-mod",
          name: "External Mod",
          archiveSha256: "b".repeat(64),
          files: { "Data/b.esp": "b" },
        },
      ],
    });
    const scope = scopeCollectionMods(world.mods);
    const enriched = await captureStagingFiles(
      world.state as never, world.gameId, scope.included, { level: "thorough" },
    );
    const { manifest } = buildManifest({
      snapshot: { gameId: world.gameId, mods: enriched } as never,
      package: {
        id: "00000000-0000-4000-8000-000000000000",
        name: "RT", version: "1.0.0", author: "a", verificationLevel: "thorough",
        description: "d",
      },
      game: { version: "1.10.163.0", versionPolicy: "exact" },
      vortex: { version: "2.6.0", deploymentMethod: "hardlink" },
      externalMods: {
        "ext-mod": {
          instructions: "Get it here",
          url: "https://example.com/p",
          mode: "browse",
          bundled: false,
        },
      },
    } as never);

    const parsed = parseManifest(JSON.stringify(manifest)).manifest;
    // The real assertion: nothing the builder produced was eaten on the way in.
    expect(parsed).toEqual(JSON.parse(JSON.stringify(manifest)));
  });
});
