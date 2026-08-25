/**
 * The mod that motivated this is real: a settings bundle the curator edits in
 * place. 188 files in the source archive, 179 in staging — 12 removed, 3 added.
 * It built, shipped, and would have handed every user the original archive.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __testPaths } from "../../../test/stubs/vortex-api";
import {
  describeExternalDrift,
  detectExternalDrift,
  repackBundledExternals,
  type ExternalDrift,
} from "./bundleFromStaging";
import { fakeSevenZip } from "./testing/fakeSevenZip";
import type { AuditorMod } from "../getModsListForProfile";
import type { CollectionConfig } from "./collectionConfig";

const mod = (over: Partial<AuditorMod> & { id: string }): AuditorMod =>
  ({
    name: over.id,
    enabled: true,
    collectionIds: [],
    hasInstallerChoices: false,
    hasDetailedInstallerChoices: false,
    fomodSelections: [],
    rules: [],
    modType: "",
    fileOverrides: [],
    enabledINITweaks: [],
    installOrder: 0,
    ...over,
  }) as AuditorMod;

const config = (externalMods: CollectionConfig["externalMods"]): CollectionConfig =>
  ({ schemaVersion: 1, packageId: "p", externalMods }) as CollectionConfig;

let staging: string;
beforeEach(() => {
  staging = fs.mkdtempSync(path.join(os.tmpdir(), "eh-bundle-"));
  __testPaths.installPath = staging;
});
afterEach(() => {
  fs.rmSync(staging, { recursive: true, force: true });
  __testPaths.installPath = "/stub/install";
});

const listing = (paths: string[]) => async () => ({
  entries: paths.map((p) => ({ path: p })),
});

describe("detectExternalDrift", () => {
  const base = {
    state: {} as never,
    gameId: "fallout4",
    sevenZip: fakeSevenZip({}),
    isExternal: () => true,
    archivePathFor: () => "C:/dl/settings.7z",
  };

  it("reports files removed AND added — that is what editing in place looks like", async () => {
    const [drift] = await detectExternalDrift({
      ...base,
      mods: [
        mod({
          id: "settings",
          name: "Ivy'sPantiesSettings",
          installationPath: "settings",
          stagingFiles: [
            { path: "F4SE/Plugins/BakaFramework.toml", size: 1 },
            { path: "PC_README.md", size: 1 },
          ] as never,
        }),
      ],
      config: config({}),
      listArchive: listing([
        "F4SE/Plugins/BakaFramework.toml",
        "F4SE/Plugins/x-cell.toml",
      ]),
    });
    expect(drift!.removed).toEqual(["f4se/plugins/x-cell.toml"]);
    expect(drift!.added).toEqual(["pc_readme.md"]);
  });

  it("says nothing when staging still matches the archive", async () => {
    const drift = await detectExternalDrift({
      ...base,
      mods: [
        mod({
          id: "clean",
          installationPath: "clean",
          stagingFiles: [{ path: "a.esp", size: 1 }] as never,
        }),
      ],
      config: config({}),
      listArchive: listing(["a.esp"]),
    });
    expect(drift).toEqual([]);
  });

  it("sees through a stripped wrapper directory rather than crying drift", async () => {
    // Vortex drops a leading folder on install; identical content must not
    // read as "every file added and every file removed".
    const drift = await detectExternalDrift({
      ...base,
      mods: [
        mod({
          id: "wrapped",
          installationPath: "wrapped",
          stagingFiles: [{ path: "Textures/a.dds", size: 1 }] as never,
        }),
      ],
      config: config({}),
      listArchive: listing(["01 Main/Textures/a.dds"]),
    });
    expect(drift).toEqual([]);
  });

  it("records whether the curator already ticked bundle", async () => {
    const [drift] = await detectExternalDrift({
      ...base,
      mods: [
        mod({
          id: "settings",
          installationPath: "settings",
          stagingFiles: [{ path: "mine.txt", size: 1 }] as never,
        }),
      ],
      config: config({ settings: { bundled: true } }),
      listArchive: listing(["theirs.txt"]),
    });
    expect(drift!.bundled).toBe(true);
  });
});

describe("describeExternalDrift", () => {
  const drifted = (over: Partial<ExternalDrift> = {}): ExternalDrift => ({
    modId: "settings",
    modName: "Ivy'sPantiesSettings",
    removed: ["a", "b"],
    added: ["PC_README.md"],
    bundled: false,
    ...over,
  });

  it("tells the curator the user would get the ORIGINAL, and what to do", () => {
    const lines = describeExternalDrift([drifted()]).join(" ");
    expect(lines).toMatch(/ships the ARCHIVE/);
    expect(lines).toMatch(/not your version/);
    expect(lines).toMatch(/tick "bundle"/i);
    expect(lines).toMatch(/Ivy'sPantiesSettings/);
  });

  it("stays quiet about mods already flagged for bundling", () => {
    // Their drift is about to ship correctly; nagging would train the curator
    // to ignore the message that matters.
    expect(describeExternalDrift([drifted({ bundled: true })])).toEqual([]);
  });

  it("says nothing at all when nothing drifted", () => {
    expect(describeExternalDrift([])).toEqual([]);
  });
});

describe("repackBundledExternals", () => {
  const sevenZip = fakeSevenZip({});

  it("refuses to pack something absurdly large, and says why", async () => {
    const dir = path.join(staging, "huge");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "big.bin"), Buffer.alloc(4096));

    const out = await repackBundledExternals({
      state: {} as never,
      gameId: "fallout4",
      mods: [mod({ id: "huge", name: "Huge", installationPath: "huge" })],
      config: config({ huge: { bundled: true } }),
      sevenZip,
      workDir: path.join(staging, ".repack"),
      isExternal: () => true,
      options: { maxBytes: 1024 },
    });
    expect(out.bundles).toEqual([]);
    expect(out.warnings[0]).toMatch(/over the/);
    expect(out.warnings[0]).toMatch(/NOT bundled/);
    // Identity must be untouched when nothing was packed.
    expect(out.mods[0]!.archiveSha256).toBeUndefined();
  });

  it("ignores mods the curator did not flag", async () => {
    const out = await repackBundledExternals({
      state: {} as never,
      gameId: "fallout4",
      mods: [mod({ id: "plain", installationPath: "plain" })],
      config: config({}),
      sevenZip,
      workDir: path.join(staging, ".repack"),
      isExternal: () => true,
    });
    expect(out.bundles).toEqual([]);
    expect(out.warnings).toEqual([]);
  });

  it("warns rather than throwing when Vortex records no staging folder", async () => {
    const out = await repackBundledExternals({
      state: {} as never,
      gameId: "fallout4",
      mods: [mod({ id: "nopath", name: "No Path" })],
      config: config({ nopath: { bundled: true } }),
      sevenZip,
      workDir: path.join(staging, ".repack"),
      isExternal: () => true,
    });
    expect(out.bundles).toEqual([]);
    expect(out.warnings[0]).toMatch(/no staging folder/);
  });
});
