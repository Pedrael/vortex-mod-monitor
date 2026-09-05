/**
 * The diff a curator reads before pressing Rebuild.
 *
 * The subtle case is an UPDATE: a Nexus mod whose file id moved is not "one
 * added and one removed", and reporting it that way would make a routine
 * version bump look like the curator had swapped a mod out.
 */
import { describe, expect, it } from "vitest";

import {
  describeCollectionDiff,
  diffCollectionAgainstProfile,
  isUnchanged,
  summarizeBuiltMods,
} from "./collectionDiff";
import type { AuditorMod } from "../getModsListForProfile";
import type { BuiltModSummary } from "./collectionDiff";

const builtMod = (
  compareKey: string,
  name: string,
  over: Partial<BuiltModSummary> = {},
): BuiltModSummary => ({ compareKey, name, enabled: true, ...over });

const live = (name: string, over: Partial<AuditorMod> = {}): AuditorMod =>
  ({ id: name, name, enabled: true, modType: "", ...over }) as AuditorMod;

const nexus = (name: string, modId: number, fileId: number, over: Partial<AuditorMod> = {}) =>
  live(name, { nexusModId: modId, nexusFileId: fileId, ...over });

describe("what a rebuild would ship", () => {
  it("matches an unchanged Nexus mod exactly", () => {
    const diff = diffCollectionAgainstProfile({
      built: [builtMod("nexus:7:100", "A Mod")],
      current: [nexus("A Mod", 7, 100)],
    });
    expect(isUnchanged(diff)).toBe(true);
    expect(diff.unchanged).toBe(1);
  });

  it("reports a NEW file of an existing mod as an update, not add+remove", () => {
    // The routine case. Add+remove would make a version bump look like the
    // curator swapped a mod out.
    const diff = diffCollectionAgainstProfile({
      built: [builtMod("nexus:7:100", "A Mod", { version: "1.0" })],
      current: [nexus("A Mod", 7, 200, { version: "2.0" })],
    });
    expect(diff.updated).toEqual([
      { name: "A Mod", fromVersion: "1.0", toVersion: "2.0" },
    ]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("reports a genuinely new mod as added", () => {
    const diff = diffCollectionAgainstProfile({
      built: [],
      current: [nexus("Newcomer", 9, 1, { version: "1.0" })],
    });
    expect(diff.added).toEqual([{ name: "Newcomer", version: "1.0" }]);
  });

  it("reports a mod no longer in the profile as removed", () => {
    const diff = diffCollectionAgainstProfile({
      built: [builtMod("nexus:7:100", "Gone")],
      current: [],
    });
    expect(diff.removed).toEqual([{ name: "Gone" }]);
  });

  it("does not report a mod as removed just because it was updated", () => {
    // The same guard from the other side: consuming the built entry is what
    // stops the old file appearing in `removed` as well.
    const diff = diffCollectionAgainstProfile({
      built: [builtMod("nexus:7:100", "A Mod")],
      current: [nexus("A Mod", 7, 200)],
    });
    expect(diff.removed).toEqual([]);
  });

  it("notices a mod switched off since the build", () => {
    const diff = diffCollectionAgainstProfile({
      built: [builtMod("nexus:7:100", "A Mod")],
      current: [nexus("A Mod", 7, 100, { enabled: false })],
    });
    expect(diff.toggled).toEqual([{ name: "A Mod", nowEnabled: false }]);
    expect(diff.unchanged).toBe(0);
  });

  it("keeps two files of the same mod apart", () => {
    // A page with a main and an optional file: both installed, both known.
    const diff = diffCollectionAgainstProfile({
      built: [builtMod("nexus:7:100", "Main"), builtMod("nexus:7:101", "Optional")],
      current: [nexus("Main", 7, 100), nexus("Optional", 7, 101)],
    });
    expect(isUnchanged(diff)).toBe(true);
    expect(diff.unchanged).toBe(2);
  });
});

describe("external mods, matched only as far as is honest", () => {
  it("matches by name and says the match was approximate", () => {
    const diff = diffCollectionAgainstProfile({
      built: [builtMod("external:" + "a".repeat(64), "My Patch")],
      current: [live("My Patch")],
    });
    expect(isUnchanged(diff)).toBe(true);
    expect(diff.approximate).toBe(1);
  });

  it("reads a renamed external mod as removed plus added", () => {
    // Wrong-looking but honest: inventing a match would report the collection
    // unchanged when it is not.
    const diff = diffCollectionAgainstProfile({
      built: [builtMod("external:" + "a".repeat(64), "Old Name")],
      current: [live("New Name")],
    });
    expect(diff.added.map((a) => a.name)).toEqual(["New Name"]);
    expect(diff.removed.map((r) => r.name)).toEqual(["Old Name"]);
  });

  it("does not count an exact Nexus match as approximate", () => {
    const diff = diffCollectionAgainstProfile({
      built: [builtMod("nexus:7:100", "A Mod")],
      current: [nexus("A Mod", 7, 100)],
    });
    expect(diff.approximate).toBe(0);
  });

  it("treats a mod with only one Nexus id as external", () => {
    // `isNexusSourced` requires both ids. Half an identity is not one.
    const diff = diffCollectionAgainstProfile({
      built: [builtMod("nexus:7:100", "Half")],
      current: [live("Half", { nexusModId: 7 })],
    });
    expect(diff.approximate).toBe(1);
  });
});

describe("the line above the diff", () => {
  it("says plainly when nothing moved", () => {
    const diff = diffCollectionAgainstProfile({
      built: [builtMod("nexus:7:1", "A")],
      current: [nexus("A", 7, 1)],
    });
    expect(describeCollectionDiff(diff)).toContain("still matches the published");
  });

  it("describes what a rebuild WOULD do, not what happened", () => {
    const diff = diffCollectionAgainstProfile({
      built: [builtMod("nexus:7:1", "A")],
      current: [nexus("A", 7, 2), nexus("B", 8, 1)],
    });
    const text = describeCollectionDiff(diff);
    expect(text).toContain("Rebuilding would ship");
    expect(text).toContain("1 added");
    expect(text).toContain("1 updated");
  });

  it("warns when part of the answer rests on name matching", () => {
    const diff = diffCollectionAgainstProfile({
      built: [
        builtMod("external:" + "a".repeat(64), "Ext"),
        builtMod("nexus:7:1", "A"),
      ],
      current: [live("Ext"), nexus("A", 7, 2)],
    });
    expect(describeCollectionDiff(diff)).toContain("matched by name");
  });
});

describe("projecting the manifest down", () => {
  it("keeps the four fields and drops the rest", () => {
    const [row] = summarizeBuiltMods([
      {
        compareKey: "nexus:7:1",
        name: "A",
        version: "1.0",
        state: { enabled: true, stagingFiles: [{ path: "x", size: 1 }] },
      } as never,
    ]);
    expect(row).toEqual({
      compareKey: "nexus:7:1",
      name: "A",
      version: "1.0",
      enabled: true,
    });
  });

  it("treats an absent enabled flag as enabled", () => {
    // The manifest omits `false` only for mods that were on, and an older
    // package may not carry the field at all.
    expect(summarizeBuiltMods([{ compareKey: "k", name: "A", state: {} } as never])[0]!.enabled)
      .toBe(true);
    expect(
      summarizeBuiltMods([
        { compareKey: "k", name: "A", state: { enabled: false } } as never,
      ])[0]!.enabled,
    ).toBe(false);
  });
});
