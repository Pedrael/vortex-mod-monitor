/**
 * These cases come from the curator's real profile: 939 mods tracked, 37
 * disabled, 123 Nexus mods spread over 304 staging folders, and 7 identity
 * collisions in which exactly one copy was enabled.
 */
import { describe, expect, it } from "vitest";

import type { AuditorMod } from "../getModsListForProfile";
import { describeScope, scopeCollectionMods } from "./collectionScope";

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

describe("scopeCollectionMods", () => {
  it("keeps only enabled mods — a profile IS its enabled set", () => {
    const scope = scopeCollectionMods([
      mod({ id: "a" }),
      mod({ id: "b", enabled: false }),
      mod({ id: "c" }),
    ]);
    expect(scope.included.map((m) => m.id)).toEqual(["a", "c"]);
    expect(scope.excludedDisabled.map((m) => m.id)).toEqual(["b"]);
  });

  it("resolves an identity collision by scoping, with no tie-break needed", () => {
    // The real shape of all 7 build-blocking collisions: the same Nexus file
    // staged twice, the superseded copy switched off.
    const scope = scopeCollectionMods([
      mod({ id: "gne", nexusModId: 37961, nexusFileId: 363058, enabled: false }),
      mod({ id: "gne.1", nexusModId: 37961, nexusFileId: 363058 }),
    ]);
    expect(scope.included.map((m) => m.id)).toEqual(["gne.1"]);
    expect(scope.collidingIdentities).toEqual([]);
    expect(describeScope(scope)).toEqual([]);
  });

  it("REPORTS a collision that scoping cannot resolve", () => {
    // Both enabled: the manifest will reject this, so say so before the build
    // spends an hour getting there.
    const scope = scopeCollectionMods([
      mod({ id: "x", name: "Dupe", nexusModId: 1, nexusFileId: 2 }),
      mod({ id: "y", name: "Dupe", nexusModId: 1, nexusFileId: 2 }),
    ]);
    expect(scope.collidingIdentities).toHaveLength(1);
    expect(scope.collidingIdentities[0]!.key).toBe("nexus:1:2");
    expect(describeScope(scope)[0]).toMatch(/cannot contain the same mod twice/);
  });

  it("reports the SAME mod installed twice and left enabled", () => {
    const scope = scopeCollectionMods([
      mod({
        id: "vrp1", name: "VRP Shared", nexusModId: 77615, nexusFileId: 1,
        version: "1.1", installationPath: "VRP Shared-77615-1-1-1746371099",
      }),
      mod({
        id: "vrp2", name: "VRP Shared", nexusModId: 77615, nexusFileId: 2,
        version: "1.2", installationPath: "VRP Shared-77615-1-2-1756431742",
      }),
    ]);
    expect(scope.multipleInstalls).toHaveLength(1);
    expect(describeScope(scope)[0]).toMatch(/is installed 2 times/);
    expect(describeScope(scope)[0]).toMatch(/shipped as-is/);
  });

  it("does NOT flag different files that share one Nexus mod page", () => {
    // The bug this replaces: grouping by page id flagged 74 groups on the real
    // profile and every one was a false positive. A page hosts a base plus its
    // addons, four different guns, five icon packs — all meant to coexist.
    const scope = scopeCollectionMods([
      mod({
        id: "a", name: "We Are Unique - Base", nexusModId: 100245, nexusFileId: 1,
        version: "N1.0.5", installationPath: "We Are Unique - Base - RobCo-100245-1-0-1-1768649343",
      }),
      mod({
        id: "b", name: "We Are Unique - Addon", nexusModId: 100245, nexusFileId: 2,
        version: "U1.1.0", installationPath: "We Are Unique - Addon - RobCo-100245-1-0-1-1768649409",
      }),
    ]);
    expect(scope.multipleInstalls).toEqual([]);
    expect(describeScope(scope)).toEqual([]);
  });

  it("sees through Vortex's `.1` re-install suffix", () => {
    const scope = scopeCollectionMods([
      mod({
        id: "r1", name: "RDIS TagSets All in One", nexusModId: 102329, nexusFileId: 1,
        version: "1.0.2", installationPath: "RDIS TagSets All in One-102329-1-0-2-1772977728",
      }),
      mod({
        id: "r2", name: "RDIS TagSets All in One", nexusModId: 102329, nexusFileId: 2,
        version: "1.0.2", installationPath: "RDIS TagSets All in One-102329-1-0-2-1772977728.1",
      }),
    ]);
    expect(scope.multipleInstalls).toHaveLength(1);
  });

  it("does not flag one mod that simply has several files of the same version", () => {
    const scope = scopeCollectionMods([
      mod({ id: "p1", nexusModId: 5, nexusFileId: 1, version: "1.0" }),
      mod({ id: "p2", nexusModId: 5, nexusFileId: 2, version: "1.0" }),
    ]);
    expect(scope.multipleInstalls).toEqual([]);
  });

  it("leaves external mods alone — they carry no Nexus identity to collide", () => {
    const scope = scopeCollectionMods([
      mod({ id: "ext1", name: "Loose Files" }),
      mod({ id: "ext2", name: "Loose Files" }),
    ]);
    expect(scope.included).toHaveLength(2);
    expect(scope.collidingIdentities).toEqual([]);
    expect(scope.multipleInstalls).toEqual([]);
  });

  it("returns an empty scope rather than throwing when nothing is enabled", () => {
    const scope = scopeCollectionMods([mod({ id: "a", enabled: false })]);
    expect(scope.included).toEqual([]);
    expect(scope.excludedDisabled).toHaveLength(1);
  });
});
