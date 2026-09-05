/**
 * The rules behind the curator view, tested where they are decided.
 *
 * Two of them are the reason this layer is pure at all: "is there an update"
 * must never be answered by comparing version STRINGS, and "these are
 * duplicates" must not be stated with more confidence than the evidence
 * carries.
 */
import { describe, expect, it } from "vitest";

import {
  findDuplicates,
  findEndorsable,
  findFrozen,
  findUpdatable,
  findUpdateShadowed,
  summarizeProfile,
  type CuratorMod,
} from "./profileActions";

const mod = (over: Partial<CuratorMod> = {}): CuratorMod => ({
  id: "m1",
  name: "A Mod",
  enabled: true,
  modType: "",
  ...over,
});

describe("which mods have an update", () => {
  it("offers one when Nexus has a newer file", () => {
    const [c] = findUpdatable([
      mod({ nexusModId: 1, nexusFileId: 100, newestFileId: 200 }),
    ]);
    expect(c).toMatchObject({ fromFileId: 100, toFileId: 200 });
  });

  it("says nothing when the installed file IS the newest", () => {
    expect(
      findUpdatable([mod({ nexusFileId: 200, newestFileId: 200 })]),
    ).toEqual([]);
  });

  it("refuses to offer a DOWNGRADE", () => {
    // Vortex can carry a stale `newestFileId` from before a mod was updated by
    // hand. `!==` would call that an update and install an older file.
    expect(
      findUpdatable([mod({ nexusFileId: 300, newestFileId: 200 })]),
    ).toEqual([]);
  });

  it("never decides from version strings", () => {
    // "1.10" is BELOW "1.9" as a string and above it as a version. The file
    // ids are what settle it, and here they say no update exists.
    expect(
      findUpdatable([
        mod({
          version: "1.9",
          newestVersion: "1.10",
          nexusFileId: 500,
          newestFileId: 500,
        }),
      ]),
    ).toEqual([]);
  });

  it("still SHOWS the version strings it refused to decide from", () => {
    const [c] = findUpdatable([
      mod({
        version: "1.9",
        newestVersion: "1.10",
        nexusFileId: 1,
        newestFileId: 2,
      }),
    ]);
    expect(c).toMatchObject({ fromVersion: "1.9", toVersion: "1.10" });
  });

  it("says 'unknown' rather than inventing a version", () => {
    const [c] = findUpdatable([mod({ nexusFileId: 1, newestFileId: 2 })]);
    expect(c).toMatchObject({ fromVersion: "unknown", toVersion: "unknown" });
  });

  it("skips a mod Vortex knows nothing about", () => {
    expect(findUpdatable([mod({ nexusFileId: 1 })])).toEqual([]);
    expect(findUpdatable([mod({ newestFileId: 2 })])).toEqual([]);
  });

  it("excludes a frozen mod even when an update exists", () => {
    // Filtered inside the finder, so no caller can offer one by forgetting.
    expect(
      findUpdatable([
        mod({ nexusFileId: 1, newestFileId: 2, frozenAtVersion: "1.0" }),
      ]),
    ).toEqual([]);
  });
});

describe("freezing, and noticing when it did not hold", () => {
  it("reports a freeze that is holding", () => {
    const [f] = findFrozen([mod({ version: "1.0", frozenAtVersion: "1.0" })]);
    expect(f!.driftedTo).toBeUndefined();
  });

  it("reports drift when the version moved anyway", () => {
    // We cannot stop Vortex's own update button. The promise is that we
    // NOTICE, so this arm is the whole feature.
    const [f] = findFrozen([mod({ version: "1.1", frozenAtVersion: "1.0" })]);
    expect(f!.driftedTo).toBe("1.1");
  });

  it("says when a freeze is actually withholding something", () => {
    const [f] = findFrozen([
      mod({ frozenAtVersion: "1.0", nexusFileId: 1, newestFileId: 9 }),
    ]);
    expect(f!.updateWithheld).toBe(true);
  });

  it("does not claim to withhold an update that does not exist", () => {
    const [f] = findFrozen([
      mod({ frozenAtVersion: "1.0", nexusFileId: 9, newestFileId: 9 }),
    ]);
    expect(f!.updateWithheld).toBe(false);
  });

  it("ignores mods that were never frozen", () => {
    expect(findFrozen([mod({ version: "1.0" })])).toEqual([]);
  });
});

describe("what can be endorsed", () => {
  it("includes an untouched Nexus mod", () => {
    expect(findEndorsable([mod({ nexusModId: 5 })])).toHaveLength(1);
    expect(
      findEndorsable([mod({ nexusModId: 5, endorsed: "Undecided" })]),
    ).toHaveLength(1);
  });

  it("leaves an answered one alone, either way", () => {
    expect(
      findEndorsable([
        mod({ nexusModId: 5, endorsed: "Endorsed" }),
        mod({ nexusModId: 6, endorsed: "Abstained" }),
      ]),
    ).toEqual([]);
  });

  it("skips a mod that did not come from Nexus", () => {
    expect(findEndorsable([mod({ endorsed: "Undecided" })])).toEqual([]);
  });
});

describe("duplicate installs, with the confidence the evidence carries", () => {
  it("calls the same FILE twice what it is", () => {
    const groups = findDuplicates([
      mod({ id: "a", nexusModId: 7, nexusFileId: 70 }),
      mod({ id: "b", nexusModId: 7, nexusFileId: 70 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.kind).toBe("same-file");
  });

  it("only calls two files from one page a LEAD", () => {
    // A main file plus an optional one from the same page is legitimate and
    // looks identical to a stale leftover. Naming it a duplicate would invite
    // the curator to delete a mod they need.
    const groups = findDuplicates([
      mod({ id: "a", nexusModId: 7, nexusFileId: 70 }),
      mod({ id: "b", nexusModId: 7, nexusFileId: 71 }),
    ]);
    expect(groups[0]!.kind).toBe("same-page");
  });

  it("says nothing about a mod installed once", () => {
    expect(
      findDuplicates([
        mod({ id: "a", nexusModId: 7 }),
        mod({ id: "b", nexusModId: 8 }),
      ]),
    ).toEqual([]);
  });

  it("does not group mods that are not from Nexus at all", () => {
    expect(findDuplicates([mod({ id: "a" }), mod({ id: "b" })])).toEqual([]);
  });

  it("treats two installs with no file id as the same file", () => {
    // They are indistinguishable from each other, which is exactly what
    // `same-file` claims — not a guess, an absence of any difference.
    const groups = findDuplicates([
      mod({ id: "a", nexusModId: 7 }),
      mod({ id: "b", nexusModId: 7 }),
    ]);
    expect(groups[0]!.kind).toBe("same-file");
  });
});

describe("the headline counts", () => {
  it("counts each thing once, and frozen drift separately", () => {
    expect(
      summarizeProfile([
        mod({ id: "a", nexusModId: 1, nexusFileId: 1, newestFileId: 2 }),
        mod({ id: "b", enabled: false, version: "2", frozenAtVersion: "1" }),
        mod({ id: "c", nexusModId: 3, endorsed: "Endorsed" }),
        mod({ id: "d", nexusModId: 4, nexusFileId: 9 }),
        mod({ id: "e", nexusModId: 4, nexusFileId: 9 }),
      ]),
    ).toEqual({
      total: 5,
      enabled: 4,
      updatable: 1,
      frozen: 1,
      frozenDrifted: 1,
      endorsable: 3,
      duplicateGroups: 1,
    });
  });

  it("is all zeroes for an empty profile rather than throwing", () => {
    expect(summarizeProfile([])).toMatchObject({ total: 0, updatable: 0 });
  });
});

describe("two installs of one mod, both with an update waiting", () => {
  // Found by running it: the real profile had Animated Armoury installed twice
  // — 7.0 and 8.1 — and BOTH were offered an update to 8.2. Taking both would
  // install 8.2 twice and leave four copies where there were two, with the
  // tool making the exact mess it exists to clean up.
  const twoInstalls = [
    mod({ id: "old", nexusModId: 47213, nexusFileId: 700, newestFileId: 820, version: "7.0" }),
    mod({ id: "new", nexusModId: 47213, nexusFileId: 810, newestFileId: 820, version: "8.1" }),
  ];

  it("offers the update once, on the newest install", () => {
    const candidates = findUpdatable(twoInstalls);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.mod.id).toBe("new");
    expect(candidates[0]!.fromVersion).toBe("8.1");
  });

  it("names the copy it did NOT offer, so it is not a silent omission", () => {
    const shadowed = findUpdateShadowed(twoInstalls);
    expect(shadowed).toHaveLength(1);
    expect(shadowed[0]!.mod.id).toBe("old");
    expect(shadowed[0]!.newerInstall.id).toBe("new");
  });

  it("still offers one update per mod when pages differ", () => {
    expect(
      findUpdatable([
        mod({ id: "a", nexusModId: 1, nexusFileId: 1, newestFileId: 2 }),
        mod({ id: "b", nexusModId: 2, nexusFileId: 1, newestFileId: 2 }),
      ]),
    ).toHaveLength(2);
  });

  it("shadows nothing when a mod is installed once", () => {
    expect(
      findUpdateShadowed([
        mod({ id: "a", nexusModId: 1, nexusFileId: 1, newestFileId: 2 }),
      ]),
    ).toEqual([]);
  });

  it("keeps a mod with no Nexus page, which cannot duplicate anything", () => {
    expect(
      findUpdatable([mod({ id: "x", nexusFileId: 1, newestFileId: 2 })]),
    ).toHaveLength(1);
  });
});
