/**
 * Planning a deletion, which is the half that must never be wrong.
 *
 * Two rules carry the risk: an archive any mod still points at is never a
 * candidate (Event Horizon hashes those at build time), and the removals have
 * to precede the deletions because a mod entry is what holds the reference.
 */
import { describe, expect, it } from "vitest";

import {
  describeCleanupPlan,
  findSupersededMods,
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

describe("the report read before anything is deleted", () => {
  it("explains why the order is what it is", () => {
    const plan = planCleanup({
      mods: [
        mod("old", { archiveId: "a", nexusModId: 7, nexusFileId: 1 }),
        mod("new", { archiveId: "b", nexusModId: 7, nexusFileId: 2 }),
      ],
      downloads: [dl("a"), dl("b")],
    });
    const text = describeCleanupPlan(plan).join(" ");
    expect(text).toContain("installs go first");
    expect(text).toContain("permanently");
  });

  it("names the archives it is deliberately not touching", () => {
    const plan = planCleanup({
      mods: [],
      downloads: [dl("mystery", { nexusModId: 99, bytes: 3 * 1024 ** 3 })],
    });
    const text = describeCleanupPlan(plan).join(" ");
    expect(text).toContain("not installed yet");
    expect(text).toContain("NOT included");
  });

  it("says so plainly when there is nothing to do", () => {
    expect(
      describeCleanupPlan(planCleanup({ mods: [], downloads: [] })).join(" "),
    ).toContain("Nothing to clean up");
  });

  it("formats sizes a person can read", () => {
    expect(formatSize(3.61 * 1024 ** 3)).toBe("3.61 GB");
    expect(formatSize(700 * 1024 ** 2)).toBe("700 MB");
  });
});
