/**
 * ──────────────────────────────────────────────────────────────────────
 * Packing the same bytes twice should pack them once.
 *
 * DynDOLOD output is commonly several gigabytes and almost never changes
 * between two versions of a collection, and every build re-7z'd it. The
 * archive was named `<modId>.zip` — which says which mod and nothing about
 * which VERSION of it — deleted at the start of each repack and again after
 * the package was written, so reuse was impossible by construction.
 *
 * ─── THE FAKE HERE WRITES A FILE, ON PURPOSE ───────────────────────────
 * `fakeSevenZip`'s `add` records the call and creates nothing, so the repack
 * always threw at the hashing step and every existing test in this area
 * asserts on a WARNING. That fake cannot observe reuse: with no archive on
 * disk there is nothing to reuse, and a test built on it would report a cache
 * miss as a pass. So this one actually produces an archive.
 * ──────────────────────────────────────────────────────────────────────
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __testPaths } from "../../../test/stubs/vortex-api";
import { repackBundledExternals } from "./bundleFromStaging";
import type { AuditorMod } from "../getModsListForProfile";
import type { CollectionConfig } from "./collectionConfig";
import type { SevenZipApi } from "./sevenZip";

/** A 7z that really writes an archive, and counts how often it was asked to. */
function packingSevenZip(): SevenZipApi & { adds: string[] } {
  const adds: string[] = [];
  return {
    adds,
    list: async () => ({}),
    extractFull: async () => ({ code: 0, errors: [] }),
    add: async (archive: string, sources: readonly string[]) => {
      adds.push(archive);
      // Content derived from the sources so two different staging sets do not
      // accidentally produce byte-identical archives.
      fs.mkdirSync(path.dirname(archive), { recursive: true });
      fs.writeFileSync(archive, `ZIP:${sources.join("|")}:${adds.length}`);
      return { code: 0, errors: [] };
    },
  } as SevenZipApi & { adds: string[] };
}

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
let workDir: string;
beforeEach(() => {
  staging = fs.mkdtempSync(path.join(os.tmpdir(), "eh-reuse-"));
  __testPaths.installPath = staging;
  workDir = path.join(staging, ".repack");
  const dir = path.join(staging, "lods");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "tamriel.bto"), "lod bytes");
});
afterEach(() => {
  fs.rmSync(staging, { recursive: true, force: true });
  __testPaths.installPath = "/stub/install";
});

const lods = (sha: string): AuditorMod =>
  mod({
    id: "lods",
    name: "DynDOLOD_Output",
    installationPath: "lods",
    stagingFiles: [{ path: "tamriel.bto", size: 9, sha256: sha }],
  } as never);

const run = async (
  sevenZip: SevenZipApi,
  m: AuditorMod,
): ReturnType<typeof repackBundledExternals> =>
  repackBundledExternals({
    state: {} as never,
    gameId: "skyrimse",
    mods: [m],
    config: config({ lods: { bundled: true } }),
    sevenZip,
    workDir,
    isExternal: () => true,
  });

describe("packing the same staging twice", () => {
  it("packs once and reuses the archive the second time", async () => {
    const zip = packingSevenZip();
    const first = await run(zip, lods("a".repeat(64)));
    const second = await run(zip, lods("a".repeat(64)));

    expect(zip.adds).toHaveLength(1);
    expect(second.bundles[0]!.reused).toBe(true);
    expect(first.bundles[0]!.reused).toBeUndefined();
  });

  it("gives the mod the SAME identity both times", async () => {
    // Identity follows the archive's bytes. Reuse is only correct if it also
    // means the manifest names the same thing — otherwise a rebuild that
    // changed nothing would still report this mod as changed.
    const zip = packingSevenZip();
    const first = await run(zip, lods("a".repeat(64)));
    const second = await run(zip, lods("a".repeat(64)));
    expect(second.bundles[0]!.sha256).toBe(first.bundles[0]!.sha256);
    expect(second.mods[0]!.archiveSha256).toBe(first.mods[0]!.archiveSha256);
  });

  it("REPACKS when the staging content has changed", async () => {
    // The expensive mistake this must never make: shipping last week's LOD
    // output while claiming to ship this week's.
    const zip = packingSevenZip();
    await run(zip, lods("a".repeat(64)));
    const changed = await run(zip, lods("b".repeat(64)));
    expect(zip.adds).toHaveLength(2);
    expect(changed.bundles[0]!.reused).toBeUndefined();
  });

  it("keeps only the newest archive for that mod", async () => {
    const zip = packingSevenZip();
    await run(zip, lods("a".repeat(64)));
    const second = await run(zip, lods("b".repeat(64)));

    const zips = fs.readdirSync(workDir).filter((f) => f.endsWith(".zip"));
    expect(zips).toHaveLength(1);
    // The one that survived is the one this build used. Asserted against the
    // returned path rather than a guessed filename: the name is a hash of the
    // whole staging SET, not of any single file's contents.
    expect(zips[0]).toBe(path.basename(second.bundles[0]!.sourcePath));
  });

  it("repacks when the staging set carries no hashes to key on", async () => {
    // `computeStagingSetHash` refuses a partial capture, and refusing is
    // right: reuse would then be a guess about files nobody measured.
    const zip = packingSevenZip();
    const noHash = mod({
      id: "lods",
      name: "DynDOLOD_Output",
      installationPath: "lods",
      stagingFiles: [{ path: "tamriel.bto", size: 9 }],
    } as never);
    await run(zip, noHash);
    await run(zip, noHash);
    expect(zip.adds).toHaveLength(2);
  });

  it("repacks when the archive was truncated after its sidecar was written", async () => {
    // What a crash mid-write leaves: a real file, a real sidecar, and a hash
    // describing bytes that were never finished.
    const zip = packingSevenZip();
    const first = await run(zip, lods("a".repeat(64)));
    fs.writeFileSync(first.bundles[0]!.sourcePath, "truncated");

    const second = await run(zip, lods("a".repeat(64)));
    expect(zip.adds).toHaveLength(2);
    expect(second.bundles[0]!.reused).toBeUndefined();
  });

  it("repacks when the sidecar is missing entirely", async () => {
    const zip = packingSevenZip();
    const first = await run(zip, lods("a".repeat(64)));
    fs.rmSync(`${first.bundles[0]!.sourcePath}.json`, { force: true });

    await run(zip, lods("a".repeat(64)));
    expect(zip.adds).toHaveLength(2);
  });

  it("does not touch another mod's cached archive", async () => {
    // The folder is shared by every collection the curator builds.
    const zip = packingSevenZip();
    const other = path.join(workDir, `other-${"c".repeat(64)}.zip`);
    fs.mkdirSync(workDir, { recursive: true });
    fs.writeFileSync(other, "someone else's");

    await run(zip, lods("a".repeat(64)));
    expect(fs.existsSync(other)).toBe(true);
  });
});
