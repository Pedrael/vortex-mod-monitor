/**
 * Choosing the baseline, and telling three failures apart.
 *
 * The one that matters: "could not read the package" must never render as
 * "no changes". A curator reading "nothing changed" decides not to rebuild,
 * and that decision would have been made on an unread file.
 */
import { describe, expect, it, vi } from "vitest";

import { loadBuildDiff } from "./buildDiff";
import type { AuditorMod } from "../../../core/getModsListForProfile";
import type { BuiltPackage } from "./publishedDetails";

const pkg = (fileName: string): BuiltPackage => ({
  fileName,
  fullPath: `C:/out/${fileName}`,
  bytes: 1024,
  builtAt: new Date("2026-01-01"),
});

const mod = (over: Partial<AuditorMod> = {}): AuditorMod =>
  ({
    id: "m",
    name: "A Mod",
    enabled: true,
    modType: "",
    rules: [],
    fileOverrides: [],
    enabledINITweaks: [],
    hasInstallerChoices: false,
    hasDetailedInstallerChoices: false,
    ...over,
  }) as AuditorMod;

const manifestOf = (mods: unknown[], version = "1.0.3"): never =>
  ({ manifest: { package: { version }, mods } }) as never;

const shipped = (name: string, compareKey: string): unknown => ({
  compareKey,
  name,
  version: "1.0",
  state: { enabled: true },
});

describe("which package is the baseline", () => {
  it("uses the newest package built under this name", async () => {
    const findPackages = vi.fn(async () => [pkg("meridia-1.0.3.ehcoll")]);
    const readPackage = vi.fn(async () => manifestOf([]));
    const out = await loadBuildDiff({
      collectionName: "Meridia Panties",
      outputDir: "C:/out",
      current: [],
      findPackages,
      readPackage,
    });
    expect(findPackages).toHaveBeenCalledWith("C:/out", "meridia-panties", []);
    expect(readPackage).toHaveBeenCalledWith("C:/out/meridia-1.0.3.ehcoll");
    expect(out.kind).toBe("diff");
  });

  it("says first-build when nothing has been built yet", async () => {
    const out = await loadBuildDiff({
      collectionName: "Brand New",
      outputDir: "C:/out",
      current: [],
      findPackages: async () => [],
      readPackage: async () => manifestOf([]),
    });
    expect(out).toEqual({ kind: "first-build" });
  });

  it("never searches with an empty slug", async () => {
    // An empty slug matches every package in the folder, so an unnamed draft
    // would be diffed against somebody else's collection.
    const findPackages = vi.fn(async () => [pkg("other-1.0.0.ehcoll")]);
    const out = await loadBuildDiff({
      collectionName: "   ",
      outputDir: "C:/out",
      current: [],
      findPackages,
      readPackage: async () => manifestOf([]),
    });
    expect(findPackages).not.toHaveBeenCalled();
    expect(out.kind).toBe("first-build");
  });

  it("passes the other slugs through, so a shared prefix cannot claim a build", async () => {
    const findPackages = vi.fn(async () => []);
    await loadBuildDiff({
      collectionName: "Ivy",
      outputDir: "C:/out",
      knownSlugs: ["ivy-2"],
      current: [],
      findPackages,
      readPackage: async () => manifestOf([]),
    });
    expect(findPackages).toHaveBeenCalledWith("C:/out", "ivy", ["ivy-2"]);
  });
});

describe("what it reports", () => {
  it("diffs the profile against what the package shipped", async () => {
    const out = await loadBuildDiff({
      collectionName: "Meridia Panties",
      outputDir: "C:/out",
      current: [mod({ id: "keep", name: "Kept", nexusModId: 1, nexusFileId: 1 } as never)],
      findPackages: async () => [pkg("meridia-panties-1.0.3.ehcoll")],
      readPackage: async () =>
        manifestOf([shipped("Gone", "nexus:9:9"), shipped("Kept", "nexus:1:1")]),
    });
    expect(out.kind).toBe("diff");
    if (out.kind !== "diff") throw new Error("expected a diff");
    expect(out.diff.removed.map((r) => r.name)).toEqual(["Gone"]);
    expect(out.diff.unchanged).toBe(1);
    expect(out.againstVersion).toBe("1.0.3");
    expect(out.fileName).toBe("meridia-panties-1.0.3.ehcoll");
  });

  it("reports an unreadable package as unreadable, NOT as no changes", async () => {
    // The whole reason this outcome exists. "No changes" here would tell the
    // curator not to rebuild, off the back of a file nobody managed to open.
    const out = await loadBuildDiff({
      collectionName: "Meridia Panties",
      outputDir: "C:/out",
      current: [],
      findPackages: async () => [pkg("meridia-panties-1.0.3.ehcoll")],
      readPackage: async () => {
        throw new Error("not a zip");
      },
    });
    expect(out).toEqual({
      kind: "unreadable",
      fileName: "meridia-panties-1.0.3.ehcoll",
      why: "not a zip",
    });
  });

  it("survives a thrown non-Error", async () => {
    const out = await loadBuildDiff({
      collectionName: "Meridia Panties",
      outputDir: "C:/out",
      current: [],
      findPackages: async () => [pkg("p.ehcoll")],
      readPackage: async () => {
        throw "eperm";
      },
    });
    expect(out.kind).toBe("unreadable");
    if (out.kind !== "unreadable") throw new Error("expected unreadable");
    expect(out.why).toBe("eperm");
  });
});
