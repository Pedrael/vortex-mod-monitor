/**
 * "I edited this mod myself, and that is deliberate."
 *
 * xLODGen and DynDOLOD write their output into a mod's folder; curators repack
 * BA2s and clean plugins in place. The staging folder then holds files the
 * mod's own archive cannot produce — and a user installing from that archive
 * can NEVER have them.
 *
 * Before this flag existed those files were recorded as required, so every
 * client failed verification, was reinstalled from the same archive, failed
 * identically, and the mod was recorded broken. A permanent false failure that
 * no retry could clear. Measured on a real Skyrim pack: `sse-xlodgen-output-pbr`
 * carried 1608 such files.
 *
 * ─── WHAT THE FLAG BUYS IS A QUESTION, NOT AN EXEMPTION ────────────────
 * The declaration does not switch the mod's integrity check off. Files the
 * archive DOES contain must still arrive — that is the Vortex-drops-files bug
 * this whole project exists to catch, and a curator flagging a mod is not
 * claiming their users' Vortex is immune. So a declared mod still reinstalls
 * when a file that IS in the archive goes missing, and only files the archive
 * has never heard of are excused.
 *
 * That distinction is the whole test.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../manifest/listArchive", () => ({
  listArchiveNativeFirst: vi.fn(),
}));

import { listArchiveNativeFirst } from "../manifest/listArchive";
import { judgeReinstall } from "./judgeReinstall";

const listing = (names: string[]) => ({
  kind: "ok" as const,
  listing: {
    entries: names.map((p) => ({ path: p, size: 10, crc: 1234 })),
    withCrc: names.length,
    crcCoverage: 1,
  },
});

const judge = (over: Record<string, unknown> = {}) =>
  judgeReinstall({
    missingFiles: [],
    differingPaths: [],
    stagingRoot: "/staging/ModA",
    archivePath: "/downloads/ModA.7z",
    ...over,
  } as Parameters<typeof judgeReinstall>[0]);

describe("a mod the curator declared post-processed", () => {
  it("excuses files the archive has never heard of", async () => {
    vi.mocked(listArchiveNativeFirst).mockResolvedValue(
      listing(["meshes/real.nif"]) as never,
    );
    const v = await judge({
      postProcessed: true,
      missingFiles: ["textures/terrain/generated.dds"],
    });
    expect(v.kind).toBe("curator-only");
    if (v.kind === "curator-only") {
      expect(v.excused).toBe(1);
      expect(v.why).toMatch(/not in the archive/i);
    }
  });

  it("STILL reinstalls when a file the archive contains goes missing", async () => {
    // The safety net stays up. This is the failure the project exists to catch,
    // and a declaration must never be able to hide it.
    vi.mocked(listArchiveNativeFirst).mockResolvedValue(
      listing(["meshes/real.nif"]) as never,
    );
    const v = await judge({
      postProcessed: true,
      missingFiles: ["meshes/real.nif"],
    });
    expect(v.kind).toBe("reinstall");
    if (v.kind === "reinstall") {
      expect(v.archiveConsulted).toBe(true);
      expect(v.why).toMatch(/ARE in the archive/i);
    }
  });

  it("reinstalls if ANY missing file is reproducible, not just all of them", async () => {
    // Mixed is the realistic case: a generated file alongside one Vortex ate.
    vi.mocked(listArchiveNativeFirst).mockResolvedValue(
      listing(["meshes/real.nif"]) as never,
    );
    const v = await judge({
      postProcessed: true,
      missingFiles: ["textures/generated.dds", "meshes/real.nif"],
    });
    expect(v.kind).toBe("reinstall");
  });

  it("matches on the filename, because FOMODs relocate files", async () => {
    // The staged path is not the archive path when an installer moved it, so a
    // full-path comparison would excuse a genuinely missing file.
    vi.mocked(listArchiveNativeFirst).mockResolvedValue(
      listing(["00 Core/meshes/real.nif"]) as never,
    );
    const v = await judge({
      postProcessed: true,
      missingFiles: ["meshes/real.nif"],
    });
    expect(v.kind).toBe("reinstall");
  });
});

describe("a mod that was NOT declared", () => {
  it("refuses absent files outright, without opening the archive", async () => {
    // Unchanged behaviour, and deliberately so: a mod with unreproducible
    // files the curator did not flag is a mod where something happened they
    // did not intend, and it should fail loudly.
    vi.mocked(listArchiveNativeFirst).mockClear();
    const v = await judge({ missingFiles: ["textures/generated.dds"] });
    expect(v.kind).toBe("reinstall");
    if (v.kind === "reinstall") expect(v.archiveConsulted).toBe(false);
    expect(vi.mocked(listArchiveNativeFirst)).not.toHaveBeenCalled();
  });

  it("is not rescued by the flag being merely absent-vs-false", async () => {
    const undeclared = await judge({
      postProcessed: false,
      missingFiles: ["textures/generated.dds"],
    });
    expect(undeclared.kind).toBe("reinstall");
  });
});

describe("a verification failure with nothing in it", () => {
  it("still reinstalls when there are neither missing nor differing files", async () => {
    const v = await judge({});
    expect(v.kind).toBe("reinstall");
    if (v.kind === "reinstall") expect(v.why).toMatch(/no file detail/i);
  });
});
