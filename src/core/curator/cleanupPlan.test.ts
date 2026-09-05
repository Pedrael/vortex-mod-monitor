/**
 * Planning a deletion, which is the half that must never be wrong.
 *
 * Two rules carry the risk: an archive any mod still points at is never a
 * candidate (Event Horizon hashes those at build time), and the removals have
 * to precede the deletions because a mod entry is what holds the reference.
 */
import { describe, expect, it } from "vitest";

import {
  archivesFreedByRemoval,
  cleanupSubset,
  findSupersededMods,
  orphanArchives,
  tickedArchives,
  formatSize,
  planCleanup,
  type DownloadEntry,
} from "./cleanupPlan";
import type { CuratorMod } from "./profileActions";

const mod = (
  id: string,
  over: Partial<CuratorMod & { archiveId?: string }> = {},
): CuratorMod & { archiveId?: string } => ({
  id,
  name: id,
  enabled: true,
  modType: "",
  ...over,
});

const dl = (id: string, over: Partial<DownloadEntry> = {}): DownloadEntry => ({
  id,
  fileName: `${id}.7z`,
  bytes: 1024 ** 3,
  ...over,
});

describe("which installs are old versions", () => {
  it("keeps the highest file id and retires the rest", () => {
    const removals = findSupersededMods([
      mod("old", { nexusModId: 7, nexusFileId: 100 }),
      mod("new", { nexusModId: 7, nexusFileId: 200 }),
    ]);
    expect(removals).toHaveLength(1);
    expect(removals[0]!.mod.id).toBe("old");
    expect(removals[0]!.supersededBy.id).toBe("new");
  });

  it("does not retire the same FILE installed twice", () => {
    // Redundant, but not a version question — choosing between identical
    // twins is a different decision than retiring an older release.
    expect(
      findSupersededMods([
        mod("a", { nexusModId: 7, nexusFileId: 100 }),
        mod("b", { nexusModId: 7, nexusFileId: 100 }),
      ]),
    ).toEqual([]);
  });

  it("says nothing when file ids are missing", () => {
    // No ordering, so no way to know which is older.
    expect(
      findSupersededMods([
        mod("a", { nexusModId: 7 }),
        mod("b", { nexusModId: 7 }),
      ]),
    ).toEqual([]);
  });

  it("never groups mods from different pages", () => {
    expect(
      findSupersededMods([
        mod("a", { nexusModId: 7, nexusFileId: 1 }),
        mod("b", { nexusModId: 8, nexusFileId: 2 }),
      ]),
    ).toEqual([]);
  });
});

describe("what may be deleted", () => {
  it("NEVER touches an archive a surviving mod points at", () => {
    // The rule that stops a build reporting missing archives.
    const plan = planCleanup({
      mods: [mod("keep", { archiveId: "dl-1", nexusModId: 7, nexusFileId: 9 })],
      downloads: [dl("dl-1")],
    });
    expect(plan.deleteArchives).toEqual([]);
    expect(plan.keptReferenced).toBe(1);
  });

  it("frees an archive only the retired install was holding", () => {
    const plan = planCleanup({
      mods: [
        mod("old", { archiveId: "dl-old", nexusModId: 7, nexusFileId: 100 }),
        mod("new", { archiveId: "dl-new", nexusModId: 7, nexusFileId: 200 }),
      ],
      downloads: [dl("dl-old"), dl("dl-new")],
      removeModIds: new Set(["old"]),
    });
    expect(plan.removeMods.map((r) => r.mod.id)).toEqual(["old"]);
    expect(plan.deleteArchives.map((a) => a.entry.id)).toEqual(["dl-old"]);
    expect(plan.deleteArchives[0]!.reason).toBe("freed-by-removal");
  });

  it("keeps an archive shared by a retired AND a surviving mod", () => {
    // Two mods from one archive: retiring one must not delete the file the
    // other still needs.
    const plan = planCleanup({
      mods: [
        mod("old", { archiveId: "shared", nexusModId: 7, nexusFileId: 100 }),
        mod("new", { archiveId: "shared", nexusModId: 7, nexusFileId: 200 }),
      ],
      downloads: [dl("shared")],
      removeModIds: new Set(["old"]),
    });
    expect(plan.removeMods).toHaveLength(1);
    expect(plan.deleteArchives).toEqual([]);
  });

  it("deletes an orphan when a version of that mod survives", () => {
    const plan = planCleanup({
      mods: [mod("cur", { archiveId: "dl-new", nexusModId: 7, nexusFileId: 9 })],
      downloads: [dl("dl-new"), dl("dl-stale", { nexusModId: 7 })],
    });
    expect(plan.deleteArchives.map((a) => a.entry.id)).toEqual(["dl-stale"]);
    expect(plan.deleteArchives[0]!.reason).toBe("orphan-superseded");
  });

  it("REFUSES an orphan for a mod nothing installed", () => {
    // Could be a leftover, could be a download not installed yet. They look
    // identical from here, and deleting a deliberate download to save space
    // is worse than not saving it.
    const plan = planCleanup({
      mods: [],
      downloads: [dl("maybe-wanted", { nexusModId: 99 })],
    });
    expect(plan.deleteArchives).toEqual([]);
    expect(plan.unclearOrphans.map((o) => o.entry.id)).toEqual(["maybe-wanted"]);
    expect(plan.unclearBytes).toBe(1024 ** 3);
  });

  it("treats a mod with no known archive as protecting nothing it holds", () => {
    // It cannot vouch for any file, so nothing is freed on its account — but
    // it also must not cause an unrelated archive to be deleted.
    const plan = planCleanup({
      mods: [mod("no-archive", { nexusModId: 7, nexusFileId: 1 })],
      downloads: [dl("dl-1", { nexusModId: 7 })],
    });
    expect(plan.deleteArchives.map((a) => a.entry.id)).toEqual(["dl-1"]);
  });

  it("sums only what it will actually delete", () => {
    const plan = planCleanup({
      mods: [mod("cur", { archiveId: "keep", nexusModId: 7, nexusFileId: 9 })],
      downloads: [
        dl("keep", { bytes: 5 * 1024 ** 3 }),
        dl("stale", { nexusModId: 7, bytes: 2 * 1024 ** 3 }),
        dl("unknown", { nexusModId: 42, bytes: 9 * 1024 ** 3 }),
      ],
    });
    expect(plan.bytesFreed).toBe(2 * 1024 ** 3);
    expect(plan.unclearBytes).toBe(9 * 1024 ** 3);
  });
});


describe("the two ways this used to delete the wrong thing", () => {
  it("never plans a removal the curator did not tick", () => {
    // It used to choose them itself. A lower file id is not proof of an older
    // version — a Nexus page ships a main file and its optional patches under
    // one mod id — so acting on that guess deleted a patch installed on
    // purpose. Suggesting is fine; acting is not.
    const mods = [
      mod("main", { archiveId: "dl-main", nexusModId: 7, nexusFileId: 100 }),
      mod("optional", { archiveId: "dl-opt", nexusModId: 7, nexusFileId: 200 }),
    ];
    const plan = planCleanup({
      mods,
      downloads: [dl("dl-main"), dl("dl-opt")],
    });
    expect(plan.removeMods).toEqual([]);
    expect(plan.deleteArchives).toEqual([]);
    // Still offered as a candidate for the curator to judge.
    expect(findSupersededMods(mods)).toHaveLength(1);
  });

  it("does not even SUGGEST retiring an enabled install for a disabled one", () => {
    // The rollback. A curator who hit a regression in v2 disables it and
    // re-enables v1; suggesting they delete v1 inverts what they chose. This
    // was verified with a probe: the old planner retired "v1-IN-USE" and
    // deleted its archive.
    expect(
      findSupersededMods([
        mod("v1-in-use", { nexusModId: 7, nexusFileId: 100, enabled: true }),
        mod("v2-disabled", { nexusModId: 7, nexusFileId: 200, enabled: false }),
      ]),
    ).toEqual([]);
  });

  it("still suggests retiring a disabled older install", () => {
    // The ordinary case must survive the guard above.
    const suggestions = findSupersededMods([
      mod("old", { nexusModId: 7, nexusFileId: 100, enabled: false }),
      mod("new", { nexusModId: 7, nexusFileId: 200, enabled: true }),
    ]);
    expect(suggestions.map((r) => r.mod.id)).toEqual(["old"]);
  });

  it("still deletes orphan archives without any removal being ticked", () => {
    // The bulk of the space is here — archives nothing references at all —
    // and that path never depended on guessing versions.
    const plan = planCleanup({
      mods: [mod("cur", { archiveId: "keep", nexusModId: 7, nexusFileId: 9 })],
      downloads: [dl("keep"), dl("stale", { nexusModId: 7 })],
    });
    expect(plan.deleteArchives.map((a) => a.entry.id)).toEqual(["stale"]);
  });
});

describe("splitting the plan into the two acts", () => {
  const mods = [
    mod("old", { nexusModId: 7, nexusFileId: 70, archiveId: "arc-old" }),
    mod("new", { nexusModId: 7, nexusFileId: 80, archiveId: "arc-new" }),
  ];
  const downloads: DownloadEntry[] = [
    { id: "arc-old", fileName: "Mod-7-0.7z", bytes: 100, nexusModId: 7 },
    { id: "arc-new", fileName: "Mod-8-0.7z", bytes: 200, nexusModId: 7 },
    { id: "arc-loose", fileName: "Mod-6-0.7z", bytes: 400, nexusModId: 7 },
  ];

  it("calls an already-free archive an orphan, needing no removal", () => {
    // arc-loose is referenced by nothing and mod 7 is still installed.
    const plan = planCleanup({ mods, downloads });
    expect(orphanArchives(plan).map((a) => a.entry.id)).toEqual(["arc-loose"]);
    expect(archivesFreedByRemoval(plan)).toEqual([]);
  });

  it("keeps an archive freed by a removal out of the orphan list", () => {
    // Ticking "old" for removal frees arc-old — but only AFTER the removal,
    // so it must not appear in the card that deletes archives on their own.
    const plan = planCleanup({ mods, downloads, removeModIds: new Set(["old"]) });
    expect(archivesFreedByRemoval(plan).map((a) => a.entry.id)).toEqual(["arc-old"]);
    expect(orphanArchives(plan).map((a) => a.entry.id)).toEqual(["arc-loose"]);
  });

  it("recomputes the bytes a narrowed plan actually frees", () => {
    // The number on an Apply button is a promise about what Apply does. A
    // subset that carried the original total would overstate it.
    const plan = planCleanup({ mods, downloads });
    const subset = cleanupSubset({
      plan,
      removeMods: [],
      deleteArchives: orphanArchives(plan),
    });
    expect(plan.bytesFreed).toBe(400);
    expect(subset.bytesFreed).toBe(400);

    const none = cleanupSubset({ plan, removeMods: [], deleteArchives: [] });
    expect(none.bytesFreed).toBe(0);
  });

  it("narrows to exactly what was ticked", () => {
    const plan = planCleanup({ mods, downloads });
    expect(tickedArchives(orphanArchives(plan), new Set(["arc-loose"]))).toHaveLength(1);
    expect(tickedArchives(orphanArchives(plan), new Set(["nothing"]))).toEqual([]);
  });

  it("never lets the archive card carry a removal", () => {
    // The two cards are separate ACTS. An archive-only apply that quietly
    // uninstalled a mod would be the worst possible surprise here.
    const plan = planCleanup({ mods, downloads, removeModIds: new Set(["old"]) });
    const archivesOnly = cleanupSubset({
      plan,
      removeMods: [],
      deleteArchives: orphanArchives(plan),
    });
    expect(archivesOnly.removeMods).toEqual([]);
  });
});
