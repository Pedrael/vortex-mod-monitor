/**
 * Engine injectors: the handful of mods that do not live in Data.
 *
 * A script extender's loader, ENB's wrapper, Engine Fixes' proxy DLL — these
 * sit beside the game executable. Vortex has a concept for this (`modType`,
 * where `dinput` deploys to the game root instead of Data) and it works: on
 * the curator's real 1753-mod Skyrim collection exactly ONE mod is `dinput`,
 * SKSE64, and Vortex writes `vortex.deployment.dinput.json` into the game
 * folder listing the 129 files it put there. That mod rides in the collection
 * like any other and `checkModTypes.ts` catches it if a user's install derives
 * the wrong type.
 *
 * ─── THE ONE VORTEX CANNOT CARRY ───────────────────────────────────────
 * SSE Engine Fixes ships in two halves. Part 1 is an SKSE plugin, so it is an
 * ordinary mod. Part 2 is the preloader: ONE file, `d3dx9_42.dll`, which sits
 * beside SkyrimSE.exe and is what loads Part 1.
 *
 * Verified from the installed mod rather than assumed. This first claimed Part
 * 2 was d3dx9_42.dll + tbb.dll + tbbmalloc.dll, because all three sat in the
 * curator's game root. The staging folder of "Engine Fixes - SKSE64 Preloader"
 * holds exactly one file, 86.5 KB; the tbb DLLs came from something unrelated.
 * Requiring the pair made the probe a silent false negative everywhere else.
 *
 * Vortex CAN carry it, which is the other correction: given the
 * engine-injector mod type, Part 2 installs as a mod and ships with the
 * collection. Most curators will not have done that, which is why the probe
 * exists.
 *
 * Left unshipped and undeclared, a tester installs Part 1, it verifies
 * perfectly, and it loads nothing.
 */
import { describe, expect, it } from "vitest";

import {
  ENGINE_FIXES_PART2_ID,
  describeMissingEngineFixesPart2,
  detectExternalDependencies,
} from "./externalDependencies";
import type { EhcollExternalDependency } from "../../types/ehcoll";

import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

/** A game folder with exactly the files named. */
const gameDir = async (files: string[]): Promise<string> => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "eh-injector-"));
  for (const f of files) {
    const full = path.join(dir, f);
    await fsp.mkdir(path.dirname(full), { recursive: true });
    await fsp.writeFile(full, `stub:${f}`);
  }
  return dir;
};

describe("detecting Engine Fixes Part 2 in the game folder", () => {
  it("fires on d3dx9_42.dll alone, because that IS the whole of Part 2", async () => {
    // Read out of the installed mod's staging folder rather than assumed:
    // "Engine Fixes - SKSE64 Preloader" contains exactly d3dx9_42.dll and
    // nothing else.
    const dir = await gameDir(["d3dx9_42.dll"]);
    const found = await detectExternalDependencies(dir, "skyrimse");
    const ef = found.find((d) => d.id === ENGINE_FIXES_PART2_ID);
    expect(ef).toBeDefined();
    expect(ef!.files.map((f) => f.relPath)).toEqual(["d3dx9_42.dll"]);
    expect(ef!.destination).toBe("<gameDir>");
  });

  it("does NOT need tbb.dll, which is not part of Engine Fixes at all", async () => {
    // The original probe required d3dx9_42.dll AND tbb.dll. That was a silent
    // false negative: on any machine with Part 2 and no tbb — the normal case
    // — the probe could never fire. It looked correct only because the one
    // machine it was written against happened to have tbb from something
    // unrelated.
    const dir = await gameDir(["d3dx9_42.dll"]);
    const found = await detectExternalDependencies(dir, "skyrimse");
    expect(found.some((d) => d.id === ENGINE_FIXES_PART2_ID)).toBe(true);
  });

  it("says nothing when the game folder has tbb but no preloader", async () => {
    // The mirror: tbb.dll on its own is Intel Threading Building Blocks and
    // says nothing whatsoever about Engine Fixes.
    const dir = await gameDir(["tbb.dll", "tbbmalloc.dll"]);
    const found = await detectExternalDependencies(dir, "skyrimse");
    expect(found.some((d) => d.id === ENGINE_FIXES_PART2_ID)).toBe(false);
  });

  it("stops calling it a prerequisite once a mod ships it", async () => {
    // The best outcome, and it must be silent: a curator who installs Part 2
    // as a Vortex mod with the engine-injector type ships it WITH the
    // collection, and the user does nothing.
    const dir = await gameDir(["d3dx9_42.dll"]);
    const found = await detectExternalDependencies(dir, "skyrimse", {
      providedByMods: new Set(["d3dx9_42.dll"]),
    });
    expect(found.some((d) => d.id === ENGINE_FIXES_PART2_ID)).toBe(false);
  });

  it("stays out of other games", async () => {
    const dir = await gameDir(["d3dx9_42.dll", "tbb.dll"]);
    const found = await detectExternalDependencies(dir, "fallout4");
    expect(found.some((d) => d.id === ENGINE_FIXES_PART2_ID)).toBe(false);
  });

  it("tells the user it does not go in Data and not through Vortex", async () => {
    // The two mistakes that make this mod famous.
    const dir = await gameDir(["d3dx9_42.dll", "tbb.dll"]);
    const ef = (await detectExternalDependencies(dir, "skyrimse")).find(
      (d) => d.id === ENGINE_FIXES_PART2_ID,
    )!;
    expect(ef.instructions).toMatch(/NOT into Data/i);
    expect(ef.instructions).toMatch(/cannot install it/i);
    expect(ef.instructionsUrl).toContain("17230");
  });

  it("keeps declaring a prereq the collection covers only PARTLY", async () => {
    // The suppression rule was `some`: one required file provided silenced the
    // whole probe. ENB needs d3d11.dll AND enbseries.ini, so a collection that
    // ships the wrapper but not the preset would have had the entire
    // dependency disappear rather than report the half still missing.
    //
    // Part 2 cannot test this — it is one file, so `some` and `every` agree —
    // which is exactly how the change slipped through unprotected until a
    // mutation run said so.
    const dir = await gameDir(["d3d11.dll", "enbseries.ini"]);
    const found = await detectExternalDependencies(dir, "skyrimse", {
      providedByMods: new Set(["d3d11.dll"]),
    });
    expect(found.some((d) => d.id === "enb")).toBe(true);
  });

  it("suppresses once the collection covers ALL of it", async () => {
    const dir = await gameDir(["d3d11.dll", "enbseries.ini"]);
    const found = await detectExternalDependencies(dir, "skyrimse", {
      providedByMods: new Set(["d3d11.dll", "enbseries.ini"]),
    });
    expect(found.some((d) => d.id === "enb")).toBe(false);
  });

  it("still suppresses anything the collection's own mods deploy", async () => {
    // The rule that keeps this feature from doing harm — a file a mod installs
    // is not a prerequisite. SKSE is the live example: it IS in the collection.
    const dir = await gameDir(["skse64_loader.exe", "skse64_1_6_1179.dll"]);
    const found = await detectExternalDependencies(dir, "skyrimse", {
      providedByMods: new Set(["skse64_loader.exe"]),
    });
    expect(found.some((d) => d.id === "skse64")).toBe(false);
  });
});

describe("shipping Part 1 with no Part 2 anywhere", () => {
  const deployed = (...names: string[]): ReadonlySet<string> =>
    new Set(names.map((n) => n.toLowerCase()));

  const declared = (id?: string): EhcollExternalDependency[] =>
    id === undefined
      ? []
      : ([{ id, name: id, files: [] }] as unknown as EhcollExternalDependency[]);

  it("warns when the collection carries Part 1 and nothing declares Part 2", () => {
    const msg = describeMissingEngineFixesPart2({
      gameId: "skyrimse",
      declared: declared(),
      deployedFiles: deployed("EngineFixes_preload.txt"),
    });
    expect(msg).toBeDefined();
    expect(msg!).toMatch(/does nothing on its own/i);
    expect(msg!).toContain("17230");
  });

  it("says nothing once Part 2 is declared", () => {
    expect(
      describeMissingEngineFixesPart2({
        gameId: "skyrimse",
        declared: declared(ENGINE_FIXES_PART2_ID),
        deployedFiles: deployed("EngineFixes_preload.txt"),
      }),
    ).toBeUndefined();
  });

  it("says nothing when the collection has no Engine Fixes at all", () => {
    expect(
      describeMissingEngineFixesPart2({
        gameId: "skyrimse",
        declared: declared(),
        deployedFiles: deployed("SomeOtherMod.esp"),
      }),
    ).toBeUndefined();
  });

  it("recognises Part 1 by its dll as well as its preload marker", () => {
    expect(
      describeMissingEngineFixesPart2({
        gameId: "skyrimse",
        declared: declared(),
        deployedFiles: deployed("EngineFixes.dll"),
      }),
    ).toBeDefined();
  });

  it("says nothing when a MOD in the collection ships Part 2", () => {
    // The reported bug, and the worst shape a warning can take: it fired
    // BECAUSE the curator fixed the problem. They installed Part 2 as a Vortex
    // mod with the engine-injector type, so the probe correctly stopped
    // calling it a prerequisite — and this check, looking only at what was
    // declared, then announced it was missing from their game folder.
    expect(
      describeMissingEngineFixesPart2({
        gameId: "skyrimse",
        declared: declared(),
        deployedFiles: deployed("EngineFixes_preload.txt", "d3dx9_42.dll"),
      }),
    ).toBeUndefined();
  });

  it("stays out of other games", () => {
    expect(
      describeMissingEngineFixesPart2({
        gameId: "fallout4",
        declared: declared(),
        deployedFiles: deployed("EngineFixes_preload.txt"),
      }),
    ).toBeUndefined();
  });
});
