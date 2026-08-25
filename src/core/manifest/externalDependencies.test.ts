/**
 * The case that matters most is the one that nearly shipped: F4SE detected in
 * the game folder, and F4SE ALSO installed as a Vortex mod. Declaring it a
 * prerequisite would send every user of the collection off to hand-install
 * something they were about to receive anyway.
 *
 * The fixtures are the curator's real install: F4SE present as
 * f4se_loader.exe + f4se_1_10_163.dll + f4se_steam_loader.dll, provided by the
 * mod "Fallout 4 Script Extender (F4SE)-42147-0-6-23-...", no ENB, no
 * preloader.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyDependencyOverrides,
  detectExternalDependencies,
  filesProvidedByMods,
  getGameDirectory,
} from "./externalDependencies";

let gameDir: string;

const write = (rel: string, body: string): string => {
  const full = path.join(gameDir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body);
  return crypto.createHash("sha256").update(body).digest("hex");
};

beforeEach(() => {
  gameDir = fs.mkdtempSync(path.join(os.tmpdir(), "eh-gamedir-"));
});
afterEach(() => {
  fs.rmSync(gameDir, { recursive: true, force: true });
});

describe("detectExternalDependencies", () => {
  it("does NOT declare a prerequisite the collection already installs", async () => {
    write("f4se_loader.exe", "loader");
    write("f4se_1_10_163.dll", "dll");

    const provided = filesProvidedByMods([
      {
        stagingFiles: [
          { path: "f4se_loader.exe" },
          { path: "f4se_1_10_163.dll" },
        ],
      },
    ]);
    const deps = await detectExternalDependencies(gameDir, "fallout4", {
      providedByMods: provided,
    });
    expect(deps).toEqual([]);
  });

  it("declares it when no mod accounts for it", async () => {
    const loaderSha = write("f4se_loader.exe", "loader");
    const dllSha = write("f4se_1_10_163.dll", "dll");

    const [dep] = await detectExternalDependencies(gameDir, "fallout4", {});
    expect(dep!.id).toBe("f4se");
    expect(dep!.destination).toBe("<gameDir>");
    // The dll name encodes the GAME version the extender targets, which is
    // precisely what a user has to match.
    expect(dep!.version).toBe("1.10.163");
    expect(dep!.instructions).toMatch(/f4se_loader\.exe/);
    expect(dep!.instructionsUrl).toContain("silverlock");
    expect(dep!.files).toEqual([
      { relPath: "f4se_loader.exe", sha256: loaderSha },
      { relPath: "f4se_1_10_163.dll", sha256: dllSha },
    ]);
  });

  it("will not call a lone d3d11.dll an ENB", async () => {
    // ReShade and a dozen other wrappers use that name. Without the .ini
    // beside it there is no evidence, so nothing is claimed.
    write("d3d11.dll", "could be anything");
    const deps = await detectExternalDependencies(gameDir, "fallout4", {});
    expect(deps.map((d) => d.id)).not.toContain("enb");
  });

  it("declares ENB once the corroborating file is there", async () => {
    write("d3d11.dll", "wrapper");
    write("enbseries.ini", "[PROXY]");
    const deps = await detectExternalDependencies(gameDir, "fallout4", {});
    const enb = deps.find((d) => d.id === "enb");
    expect(enb).toBeDefined();
    expect(enb!.files.map((f) => f.relPath).sort()).toEqual([
      "d3d11.dll",
      "enbseries.ini",
    ]);
  });

  it("ignores probes belonging to other games", async () => {
    write("skse64_loader.exe", "skyrim");
    const deps = await detectExternalDependencies(gameDir, "fallout4", {});
    expect(deps).toEqual([]);
  });

  it("finds nothing in a clean game folder", async () => {
    write("Fallout4.exe", "game");
    await expect(
      detectExternalDependencies(gameDir, "fallout4", {}),
    ).resolves.toEqual([]);
  });
});

describe("getGameDirectory", () => {
  it("reads Vortex's own discovery record", () => {
    const state = {
      settings: {
        gameMode: { discovered: { fallout4: { path: "D:\\GOGGames\\Fallout 4 GOTY" } } },
      },
    };
    expect(getGameDirectory(state, "fallout4")).toBe("D:\\GOGGames\\Fallout 4 GOTY");
  });

  it("returns undefined when the game was never discovered — a cannot-check", () => {
    expect(getGameDirectory({}, "fallout4")).toBeUndefined();
    expect(getGameDirectory({ settings: { gameMode: { discovered: {} } } }, "fallout4"))
      .toBeUndefined();
  });
});

describe("applyDependencyOverrides", () => {
  const dep = {
    id: "f4se",
    name: "F4SE",
    category: "script-extender",
    version: "1.10.163",
    destination: "<gameDir>" as const,
    files: [{ relPath: "f4se_loader.exe", sha256: "a".repeat(64) }],
    instructions: "generic",
    instructionsUrl: "https://f4se.silverlock.org/",
  };

  it("drops one the curator excluded", () => {
    expect(applyDependencyOverrides([dep], { f4se: { included: false } })).toEqual([]);
  });

  it("prefers the curator's instructions — theirs know which build to get", () => {
    const [out] = applyDependencyOverrides([dep], {
      f4se: { instructions: "Use 0.6.23 for GOG." },
    });
    expect(out!.instructions).toBe("Use 0.6.23 for GOG.");
  });

  it("ignores blank overrides rather than erasing the default", () => {
    const [out] = applyDependencyOverrides([dep], {
      f4se: { instructions: "   ", instructionsUrl: "" },
    });
    expect(out!.instructions).toBe("generic");
    expect(out!.instructionsUrl).toBe("https://f4se.silverlock.org/");
  });
});
