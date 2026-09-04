/**
 * What goes beside the executable, and the one thing about it worth asserting.
 *
 * The tempting feature is automatic engine-injector detection. It was measured
 * against the real 1753-mod Skyrim collection and it does not work: "a .dll or
 * .exe at the staging root" matches SKSE **and Pandora Behaviour Engine**, a
 * standalone tool; "a .dll outside SKSE/Plugins" matches Nemesis, Community
 * Shaders, Upscaling and Achievements Mods Enabler, none of which is an
 * injector. A tool's binary and an injector's binary are the same bytes in the
 * same place.
 *
 * A false positive here means files emptied into the game root, which is worse
 * than the problem being solved. So the review REPORTS, and the only assertion
 * it makes is the script-extender gap — which is provable rather than inferred.
 */
import { describe, expect, it } from "vitest";

import {
  describeRootFolderReview,
  describeUnaccountedRootBinaries,
  describeScriptExtenderGap,
  findRootFolderMods,
} from "./rootFolderReview";
import type { AuditorMod } from "../getModsListForProfile";
import type { EhcollExternalDependency } from "../../types/ehcoll";

const mod = (
  name: string,
  modType = "",
  staged: string[] = [],
): AuditorMod =>
  ({
    id: name,
    name,
    modType,
    stagingFiles: staged.map((path) => ({ path, size: 1 })),
  }) as unknown as AuditorMod;

const dep = (id: string, name = id): EhcollExternalDependency =>
  ({ id, name, files: [] }) as unknown as EhcollExternalDependency;

describe("listing what deploys outside Data", () => {
  it("reads Vortex's own type rather than inferring anything", () => {
    const found = findRootFolderMods([
      mod("SKSE64", "dinput", ["skse64_loader.exe"]),
      mod("Ordinary Mod", "", ["meshes/x.nif"]),
    ]);
    expect(found).toEqual([{ name: "SKSE64", modType: "dinput" }]);
  });

  it("does NOT flag a tool that merely has an exe at its staging root", () => {
    // Pandora Behaviour Engine, from the real collection. Its exe sits exactly
    // where SKSE's loader sits. It is a normal mod and must stay one.
    expect(
      findRootFolderMods([
        mod("Pandora Behaviour Engine", "", ["Pandora Behaviour Engine+.exe"]),
        mod("Community Shaders", "", ["Renderdoc/renderdoc.dll"]),
        mod("Nemesis", "", ["Nemesis_Engine/Papyrus Compiler/Antlr3.Runtime.dll"]),
      ]),
    ).toEqual([]);
  });

  it("does not flag a mod whose staging has a top-level Data folder", () => {
    // The other rejected heuristic. On the real collection it matched only
    // SKSE, which was already correct — so it finds nothing wrong and would
    // only add noise for anything that happened to be packaged that way.
    expect(
      findRootFolderMods([mod("Odd packaging", "", ["Data/Scripts/a.pex"])]),
    ).toEqual([]);
  });
});

describe("the review a curator reads before packing", () => {
  it("says something even when the list is one line", () => {
    // It must not hide itself when short: noticing an ABSENCE is the job.
    const lines = describeRootFolderReview({
      rootMods: [{ name: "SKSE64", modType: "dinput" }],
      declared: [],
    });
    expect(lines.join("\n")).toContain("SKSE64");
    expect(lines.join("\n")).toMatch(/1 mod\(s\) deploy beside/);
  });

  it("is explicit when NOTHING deploys outside Data", () => {
    // The most informative case, and the one a "warnings only" panel would
    // have shown as an empty box.
    const text = describeRootFolderReview({ rootMods: [], declared: [] }).join("\n");
    expect(text).toMatch(/No mod in this collection deploys outside Data/i);
    expect(text).toMatch(/script extender, ENB, or an engine fix/i);
  });

  it("names hand-installed prerequisites alongside the mods", () => {
    const text = describeRootFolderReview({
      rootMods: [{ name: "SKSE64", modType: "dinput" }],
      declared: [dep("sse-engine-fixes-part2", "SSE Engine Fixes (Part 2)")],
    }).join("\n");
    expect(text).toContain("SSE Engine Fixes (Part 2)");
    expect(text).toMatch(/install by hand/i);
  });

  it("always says how to fix something that is missing", () => {
    const text = describeRootFolderReview({ rootMods: [], declared: [] }).join("\n");
    expect(text).toMatch(/set the type on the mod in Vortex/i);
  });
});

describe("a collection built on a script extender it does not contain", () => {
  const plugins = (n: number): AuditorMod[] =>
    Array.from({ length: n }, (_, i) =>
      mod(`Plugin ${i}`, "", [`SKSE/Plugins/plugin${i}.dll`]),
    );

  it("names the gap and counts what depends on it", () => {
    const msg = describeScriptExtenderGap({
      gameId: "skyrimse",
      mods: plugins(37),
      declared: [],
    });
    expect(msg).toBeDefined();
    expect(msg!).toContain("37 mod(s)");
    expect(msg!).toContain("skse64_loader.exe");
  });

  it("says nothing when the collection ships the extender itself", () => {
    expect(
      describeScriptExtenderGap({
        gameId: "skyrimse",
        mods: [...plugins(3), mod("SKSE64", "dinput", ["skse64_loader.exe"])],
        declared: [],
      }),
    ).toBeUndefined();
  });

  it("says nothing when it is declared as a prerequisite instead", () => {
    expect(
      describeScriptExtenderGap({
        gameId: "skyrimse",
        mods: plugins(3),
        declared: [dep("skse64")],
      }),
    ).toBeUndefined();
  });

  it("says nothing when the collection has no SE plugins at all", () => {
    // A vanilla-ish collection needs no extender, and inventing a requirement
    // sends every user chasing something the curator never had.
    expect(
      describeScriptExtenderGap({
        gameId: "skyrimse",
        mods: [mod("Textures", "", ["textures/a.dds"])],
        declared: [],
      }),
    ).toBeUndefined();
  });

  it("does not mistake a stray dll elsewhere for an SE plugin", () => {
    expect(
      describeScriptExtenderGap({
        gameId: "skyrimse",
        mods: [mod("Community Shaders", "", ["Renderdoc/renderdoc.dll"])],
        declared: [],
      }),
    ).toBeUndefined();
  });

  it("uses the right extender per game, and stays quiet on unknown games", () => {
    const f4 = describeScriptExtenderGap({
      gameId: "fallout4",
      mods: [mod("P", "", ["F4SE/Plugins/x.dll"])],
      declared: [],
    });
    expect(f4!).toContain("F4SE");
    expect(
      describeScriptExtenderGap({
        gameId: "witcher3",
        mods: [mod("P", "", ["SKSE/Plugins/x.dll"])],
        declared: [],
      }),
    ).toBeUndefined();
  });

  it("matches the plugin folder case-insensitively and on either slash", () => {
    const msg = describeScriptExtenderGap({
      gameId: "skyrimse",
      mods: [mod("P", "", ["skse\\plugins\\Thing.DLL"])],
      declared: [],
    });
    expect(msg).toBeDefined();
  });
});

describe("executable files nothing accounts for", () => {
  const dep = (id: string, ...files: string[]): EhcollExternalDependency =>
    ({
      id,
      name: id,
      files: files.map((relPath) => ({ relPath, sha256: "x" })),
    }) as unknown as EhcollExternalDependency;

  // The real listing from a curator's Skyrim root, trimmed to executables.
  const REAL = [
    "bink2w64.dll",
    "Galaxy64.dll",
    "nircmd.exe",
    "nircmdc.exe",
    "QRes.exe",
    "SkyrimSE.exe",
    "SkyrimSELauncher.exe",
    "tbb.dll",
    "tbbmalloc.dll",
    "unins000.exe",
    "unins001.exe",
  ];

  it("drops what a mod already deploys", () => {
    // d3dx9_42.dll became mod-provided the moment the curator installed Part 2
    // as a Vortex mod. It must leave the list rather than be listed as a
    // mystery.
    const lines = describeUnaccountedRootBinaries({
      rootBinaries: [...REAL, "d3dx9_42.dll"],
      providedByMods: new Set(["d3dx9_42.dll"]),
      declared: [],
    });
    expect(lines.join("\n")).not.toContain("d3dx9_42.dll");
    expect(lines.join("\n")).toContain("tbb.dll");
  });

  it("drops what a declared prerequisite already covers", () => {
    const lines = describeUnaccountedRootBinaries({
      rootBinaries: ["d3dx9_42.dll", "tbb.dll"],
      providedByMods: new Set(),
      declared: [dep("sse-engine-fixes-part2", "d3dx9_42.dll")],
    });
    expect(lines.join("\n")).not.toContain("d3dx9_42.dll");
    expect(lines.join("\n")).toContain("tbb.dll");
  });

  it("says nothing when everything is accounted for", () => {
    expect(
      describeUnaccountedRootBinaries({
        rootBinaries: ["skse64_loader.exe"],
        providedByMods: new Set(["skse64_loader.exe"]),
        declared: [],
      }),
    ).toEqual([]);
  });

  it("makes no claim about what any file IS", () => {
    // The whole reason this exists. Naming them would mean encoding a belief
    // per file, which is what made a probe require tbb.dll as part of Engine
    // Fixes and fail silently everywhere else.
    const text = describeUnaccountedRootBinaries({
      rootBinaries: REAL,
      providedByMods: new Set(),
      declared: [],
    }).join("\n");
    expect(text).not.toMatch(/engine fixes|skse|enb|preloader/i);
    expect(text).toMatch(/cannot tell those apart/i);
  });

  it("admits most of them are harmless, so the list is not alarming", () => {
    const text = describeUnaccountedRootBinaries({
      rootBinaries: REAL,
      providedByMods: new Set(),
      declared: [],
    }).join("\n");
    expect(text).toMatch(/your own tools/i);
    expect(text).toMatch(/nothing to do if you recognise them all/i);
  });

  it("caps the names but keeps the count honest", () => {
    const many = Array.from({ length: 30 }, (_, i) => `thing${i}.dll`);
    const text = describeUnaccountedRootBinaries({
      rootBinaries: many,
      providedByMods: new Set(),
      declared: [],
    }).join("\n");
    expect(text).toContain("30 executable file(s)");
    expect(text).toContain("and 18 more");
  });
});
