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
 * ordinary mod. Part 2 is loose binaries that must be copied into the game
 * root by hand — the mod page says so, Vortex cannot install it, and therefore
 * no collection can contain it.
 *
 * Verified on the real machine rather than assumed: the game root holds
 * `d3dx9_42.dll`, `tbb.dll` and `tbbmalloc.dll`, and Vortex's own dinput
 * deployment manifest does NOT list any of them. Meanwhile "Engine Fixes -
 * Main File" is in the collection staging `SKSE/Plugins/EngineFixes.dll` and
 * `EngineFixes_preload.txt`. The built collection shipped
 * `externalDependencies: []`.
 *
 * So a tester installs Part 1, it verifies perfectly, and it loads nothing.
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
  it("finds it from the pair of binaries the curator really has", async () => {
    // The exact three files observed in the real Skyrim AE root.
    const dir = await gameDir(["d3dx9_42.dll", "tbb.dll", "tbbmalloc.dll"]);
    const found = await detectExternalDependencies(dir, "skyrimse");
    const ef = found.find((d) => d.id === ENGINE_FIXES_PART2_ID);
    expect(ef).toBeDefined();
    expect(ef!.files.map((f) => f.relPath).sort()).toEqual([
      "d3dx9_42.dll",
      "tbb.dll",
      "tbbmalloc.dll",
    ]);
    expect(ef!.destination).toBe("<gameDir>");
  });

  it("does not fire on either file alone", async () => {
    // d3dx9_42.dll is a stock DirectX redistributable and tbb.dll ships with
    // plenty of unrelated software. Declaring a prerequisite the curator never
    // had sends every user chasing it.
    for (const solo of ["d3dx9_42.dll", "tbb.dll"]) {
      const dir = await gameDir([solo]);
      const found = await detectExternalDependencies(dir, "skyrimse");
      expect(
        found.some((d) => d.id === ENGINE_FIXES_PART2_ID),
        `fired on ${solo} alone`,
      ).toBe(false);
    }
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
