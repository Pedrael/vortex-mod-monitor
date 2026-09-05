/**
 * Executing a deletion, where the ordering rule earns its keep.
 *
 * The plan says an archive is deletable BECAUSE a mod that references it is
 * going away. If that removal fails the premise is gone, and deleting anyway
 * leaves Vortex pointing at a file that no longer exists.
 */
import { describe, expect, it, vi } from "vitest";

import { describeCleanupOutcome, readDownloads, runCleanup } from "./runCleanup";
import type { CleanupPlan, DownloadEntry } from "./cleanupPlan";
import type { CuratorMod } from "./profileActions";
import type { types } from "@nexusmods/vortex-api";

const mod = (id: string, archiveId?: string): CuratorMod => ({
  id,
  name: id,
  enabled: true,
  modType: "",
  ...(archiveId !== undefined ? { archiveId } : {}),
});

const entry = (id: string, bytes = 1024 ** 3): DownloadEntry => ({
  id,
  fileName: `${id}.7z`,
  bytes,
});

const plan = (over: Partial<CleanupPlan> = {}): CleanupPlan => ({
  removeMods: [],
  deleteArchives: [],
  bytesFreed: 0,
  unclearOrphans: [],
  unclearBytes: 0,
  keptReferenced: 0,
  ...over,
});

describe("the order, and what depends on it", () => {
  it("removes every install before deleting any archive", () => {
    const order: string[] = [];
    return runCleanup({
      plan: plan({
        removeMods: [{ mod: mod("old", "a"), supersededBy: mod("new", "b"), evidence: "same-file" }],
        deleteArchives: [{ entry: entry("a"), reason: "freed-by-removal" }],
      }),
      removeMod: async (id) => {
        order.push(`remove:${id}`);
      },
      deleteArchive: async (e) => {
        order.push(`delete:${e.id}`);
      },
    }).then(() => {
      expect(order).toEqual(["remove:old", "delete:a"]);
    });
  });

  it("does NOT delete an archive whose removal failed", async () => {
    // The rule. Vortex still references it, so deleting would produce exactly
    // the "archive missing from disk" state this project has to recover from.
    const deleted: string[] = [];
    const outcome = await runCleanup({
      plan: plan({
        removeMods: [{ mod: mod("old", "a"), supersededBy: mod("new", "b"), evidence: "same-file" }],
        deleteArchives: [{ entry: entry("a"), reason: "freed-by-removal" }],
      }),
      removeMod: async () => {
        throw new Error("mod is deployed");
      },
      deleteArchive: async (e) => {
        deleted.push(e.id);
      },
    });

    expect(deleted).toEqual([]);
    expect(outcome.archivesSkipped).toHaveLength(1);
    expect(outcome.archivesSkipped[0]!.why).toContain("still points at this file");
    expect(outcome.bytesFreed).toBe(0);
  });

  it("still deletes an unrelated orphan when a removal fails", async () => {
    // One failure must not abandon deletions that never depended on it.
    const outcome = await runCleanup({
      plan: plan({
        removeMods: [{ mod: mod("old", "a"), supersededBy: mod("new", "b"), evidence: "same-file" }],
        deleteArchives: [
          { entry: entry("a"), reason: "freed-by-removal" },
          { entry: entry("loose"), reason: "orphan-superseded" },
        ],
      }),
      removeMod: async () => {
        throw new Error("nope");
      },
      deleteArchive: async () => undefined,
    });
    expect(outcome.archivesDeleted).toEqual(["loose.7z"]);
    expect(outcome.archivesSkipped).toHaveLength(1);
  });

  it("counts only the bytes it actually freed", async () => {
    const outcome = await runCleanup({
      plan: plan({
        deleteArchives: [
          { entry: entry("ok", 2 * 1024 ** 3), reason: "orphan-superseded" },
          { entry: entry("locked", 9 * 1024 ** 3), reason: "orphan-superseded" },
        ],
      }),
      removeMod: async () => undefined,
      deleteArchive: async (e) => {
        if (e.id === "locked") throw new Error("file in use");
      },
    });
    expect(outcome.bytesFreed).toBe(2 * 1024 ** 3);
    expect(outcome.archivesFailed).toHaveLength(1);
  });

  it("stops on cancel without touching the rest", async () => {
    const controller = new AbortController();
    const deleteArchive = vi.fn(async () => undefined);
    const outcome = await runCleanup({
      plan: plan({
        removeMods: [{ mod: mod("a"), supersededBy: mod("b"), evidence: "same-file" as const }],
        deleteArchives: [{ entry: entry("x"), reason: "orphan-superseded" }],
      }),
      removeMod: async () => {
        controller.abort();
      },
      deleteArchive,
      signal: controller.signal,
    });
    expect(deleteArchive).not.toHaveBeenCalled();
    expect(outcome.cancelled).toBe(true);
  });
});

describe("reading the download list", () => {
  const state = (files: Record<string, unknown>): types.IState =>
    ({ persistent: { downloads: { files } } }) as unknown as types.IState;

  it("takes finished downloads for this game", () => {
    const rows = readDownloads(
      state({
        keep: {
          localPath: "A.7z",
          size: 100,
          state: "finished",
          game: ["skyrimse"],
          modInfo: { nexus: { ids: { modId: 7, fileId: 9 } } },
        },
      }),
      "skyrimse",
    );
    expect(rows).toEqual([
      { id: "keep", fileName: "A.7z", bytes: 100, nexusModId: 7, nexusFileId: 9 },
    ]);
  });

  it("skips a download that never finished", () => {
    // Not disk to reclaim this way, and deleting mid-transfer is a different
    // kind of surprise.
    expect(
      readDownloads(
        state({ part: { localPath: "A.7z", size: 1, state: "started" } }),
        "skyrimse",
      ),
    ).toEqual([]);
  });

  it("skips a download belonging to another game", () => {
    expect(
      readDownloads(
        state({ fo: { localPath: "A.7z", size: 1, state: "finished", game: ["fallout4"] } }),
        "skyrimse",
      ),
    ).toEqual([]);
  });

  it("ignores Vortex's `installed` field entirely", () => {
    // Vortex's own doc: "this will not be unset if the mod is uninstalled".
    // Trusting it would leave real leftovers looking installed forever.
    const src = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "runCleanup.ts"),
      "utf8",
    ) as string;
    const code = src.slice(src.indexOf("export function readDownloads"));
    expect(code.includes("installed")).toBe(false);
  });
});

describe("what the curator is told afterwards", () => {
  it("reports skipped archives as a safety outcome, not a failure", () => {
    const text = describeCleanupOutcome({
      modsRemoved: [],
      modsFailed: [{ name: "x", why: "deployed" }],
      archivesDeleted: [],
      archivesFailed: [],
      archivesSkipped: [{ fileName: "a.7z", why: "held" }],
      bytesFreed: 0,
      cancelled: false,
    }).join(" ");
    expect(text).toContain("left alone");
    expect(text).toContain("Nothing points at a missing file");
  });
});
