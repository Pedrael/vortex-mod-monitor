/**
 * A Creation Engine collection is not only its mods: `uGridsToLoad`, archive
 * invalidation, the Papyrus block and resource directories change how the game
 * loads, and none of them were in the package. Measured on a real Fallout 4
 * setup: 328 settings across three files, all absent from every .ehcoll built.
 *
 * The same files hold the curator's HARDWARE, which is the reason this is a
 * split and not a copy.
 */
import { describe, expect, it } from "vitest";

import {
  isMachineOwned,
  parseIni,
  iniLocationFor,
  splitByOwnership,
} from "./gameIni";

describe("parseIni", () => {
  it("reads sections, keys and values", () => {
    const out = parseIni(
      ["[Display]", "iSize W=1920", "iSize H = 1080", "", "[General]", "uGridsToLoad=5"].join("\n"),
    );
    expect(out).toEqual([
      { section: "Display", key: "iSize W", value: "1920" },
      { section: "Display", key: "iSize H", value: "1080" },
      { section: "General", key: "uGridsToLoad", value: "5" },
    ]);
  });

  it("keeps duplicate keys in order — the game takes the last one", () => {
    // Dropping the earlier duplicate would silently change which value wins.
    const out = parseIni(["[A]", "x=1", "x=2"].join("\n"));
    expect(out.map((s) => s.value)).toEqual(["1", "2"]);
  });

  it("ignores comments and blank lines, and tolerates CRLF", () => {
    const out = parseIni("; a comment\r\n[A]\r\n# another\r\n\r\nk=v\r\n");
    expect(out).toEqual([{ section: "A", key: "k", value: "v" }]);
  });

  it("does not normalise a value — a path or device name is not ours", () => {
    const out = parseIni(["[Archive]", "sResourceDataDirsFinal=STRINGS\\, TEXTURES\\"].join("\n"));
    expect(out[0]!.value).toBe("STRINGS\\, TEXTURES\\");
  });

  it("skips a line with no '=' rather than inventing a key", () => {
    expect(parseIni(["[A]", "garbage", "k=v"].join("\n"))).toHaveLength(1);
  });
});

describe("ownership", () => {
  it("keeps the user's screen, CPU, audio and FOV out of the collection", () => {
    // The real reason this split exists: these describe the curator's machine.
    for (const key of [
      "iSize W",
      "iSize H",
      "bFull Screen",
      "bBorderless",
      "iPresentInterval",
      "iNumHWThreads",
      "iMaxAllocatedMemoryBytes",
      "sAudioDevice",
      "fDefaultWorldFOV",
    ]) {
      expect(isMachineOwned(key), `${key} must stay the user's`).toBe(true);
    }
  });

  it("lets the collection own the settings that describe the MODS", () => {
    for (const key of [
      "uGridsToLoad",
      "bInvalidateOlderFiles",
      "sResourceDataDirsFinal",
      "fShadowDistance",
      "bEnableFileSelection",
    ]) {
      expect(isMachineOwned(key), `${key} is the collection's`).toBe(false);
    }
  });

  it("matches case-insensitively — INI keys are written however people feel", () => {
    expect(isMachineOwned("isize w")).toBe(true);
    expect(isMachineOwned("ISIZE W")).toBe(true);
    expect(isMachineOwned("  iSize W  ")).toBe(true);
  });

  it("splits a file and hands back BOTH halves", () => {
    // The machine half is worth returning, not discarding: a curator who tuned
    // their FOV should be told it will not travel.
    const { collection, machine } = splitByOwnership(
      parseIni(["[Display]", "iSize W=1920", "uGridsToLoad=5", "fDefaultWorldFOV=70"].join("\n")),
    );
    expect(collection.map((s) => s.key)).toEqual(["uGridsToLoad"]);
    expect(machine.map((s) => s.key)).toEqual(["iSize W", "fDefaultWorldFOV"]);
  });
});

describe("iniLocationFor", () => {
  it("knows where each supported game keeps its settings", () => {
    expect(iniLocationFor("fallout4", "C:/Users/x/Documents")).toEqual({
      dir: "C:/Users/x/Documents/My Games/Fallout4",
      files: ["Fallout4.ini", "Fallout4Prefs.ini", "Fallout4Custom.ini"],
    });
    expect(iniLocationFor("skyrimse", "C:/Users/x/Documents")!.dir).toMatch(
      /Skyrim Special Edition$/,
    );
  });

  it("returns undefined for a game it has no layout for", () => {
    // Better than guessing a folder name and reading nothing.
    expect(iniLocationFor("someothergame", "C:/Users/x/Documents")).toBeUndefined();
  });
});
