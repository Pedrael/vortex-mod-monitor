/**
 * The whole value of this module is the split it makes, so the tests are the
 * two populations it has to tell apart: an unselected option folder (benign,
 * and the bulk of the raw signal) versus a folder with holes in it (what a
 * lost write actually looks like).
 */
import { describe, expect, it } from "vitest";

import type { ArchiveEntry, ArchiveListing } from "./archiveContents";
import { findOmissionLeads } from "./omissionLeads";

function listing(paths: string[]): ArchiveListing {
  const entries: ArchiveEntry[] = paths.map((p, i) => ({
    path: p,
    size: 100 + i,
    crc: (i + 1).toString(16).padStart(8, "0"),
  }));
  return { entries, withCrc: entries.length, crcCoverage: 1 };
}

/** Everything in the archive except the named paths is treated as staged. */
const stagedExcept = (l: ArchiveListing, missing: string[]): string[] =>
  l.entries.map((e) => e.path).filter((p) => !missing.includes(p));

describe("findOmissionLeads", () => {
  it("suppresses a directory that is absent in its ENTIRETY", () => {
    // An unselected FOMOD option: every file in "02 Blue" is missing, and none
    // of it was ever meant to install. This is the 8.5% noise floor.
    const l = listing([
      "01 Red/a.dds",
      "01 Red/b.dds",
      "02 Blue/a.dds",
      "02 Blue/b.dds",
    ]);
    const out = findOmissionLeads(l, stagedExcept(l, ["02 Blue/a.dds", "02 Blue/b.dds"]));
    expect(out.leads).toEqual([]);
    expect(out.suppressed).toBe(2);
    expect(out.suppressedDirectories).toBe(1);
  });

  it("flags holes in an otherwise-installed directory", () => {
    // The bulk-install signature: the folder is mostly there, a few files are
    // not. Nothing but directory cohesion is needed to see it.
    const l = listing([
      "Textures/a.dds",
      "Textures/b.dds",
      "Textures/c.dds",
      "Textures/d.dds",
    ]);
    const out = findOmissionLeads(l, stagedExcept(l, ["Textures/d.dds"]));
    expect(out.leads).toHaveLength(1);
    expect(out.leads[0]!.path).toBe("Textures/d.dds");
    expect(out.leads[0]!.confidence).toBe("high");
    expect(out.leads[0]!.dirTotal).toBe(4);
    expect(out.leads[0]!.dirMissing).toBe(1);
    expect(out.leads[0]!.reason).toContain("3 of 4");
  });

  it("demotes a missing file whose type appears nowhere beside it", () => {
    // A readme in a folder of meshes: present in the archive, skipped on
    // install. Still surfaced, but ranked below a genuine hole.
    const l = listing(["Meshes/a.nif", "Meshes/b.nif", "Meshes/readme.txt"]);
    const out = findOmissionLeads(l, stagedExcept(l, ["Meshes/readme.txt"]));
    expect(out.leads).toHaveLength(1);
    expect(out.leads[0]!.confidence).toBe("medium");
    expect(out.leads[0]!.reason).toContain("more likely a file the installer skips");
  });

  it("suppresses installer metadata wherever it sits", () => {
    const l = listing(["fomod/ModuleConfig.xml", "fomod/info.xml", "Data/a.esp"]);
    // A ModuleConfig means the archive declares alternatives, so this module
    // refuses to answer at all rather than guess.
    const out = findOmissionLeads(
      l,
      stagedExcept(l, ["fomod/ModuleConfig.xml", "fomod/info.xml"]),
    );
    expect(out.leads).toEqual([]);
    expect(out.declaredAlternatives).toBe(true);
  });

  it("ranks the fullest directory first, high confidence above medium", () => {
    const l = listing([
      // 3/4 present — one hole, same extension.
      "A/1.dds", "A/2.dds", "A/3.dds", "A/4.dds",
      // 1/2 present — a bigger proportional hole, same extension.
      "B/1.dds", "B/2.dds",
      // 2/3 present but the missing one is a lone .txt -> medium.
      "C/1.nif", "C/2.nif", "C/notes.txt",
    ]);
    const out = findOmissionLeads(
      l,
      stagedExcept(l, ["A/4.dds", "B/2.dds", "C/notes.txt"]),
    );
    expect(out.leads.map((x) => x.path)).toEqual(["A/4.dds", "B/2.dds", "C/notes.txt"]);
    expect(out.leads.map((x) => x.confidence)).toEqual(["high", "high", "medium"]);
  });

  it("handles archive-root files without inventing a directory", () => {
    const l = listing(["a.esp", "b.esp", "c.esp"]);
    const out = findOmissionLeads(l, stagedExcept(l, ["c.esp"]));
    expect(out.leads[0]!.dir).toBe("");
    expect(out.leads[0]!.reason).toContain("the archive root");
  });

  it("matches through a stripped wrapper directory", () => {
    // Vortex drops a leading folder: archive "01 Main/Textures/a.dds" lands as
    // "Textures/a.dds". Comparing tails the wrong way round reported EVERY
    // file of such a mod as missing.
    const l = listing(["01 Main/Textures/a.dds", "01 Main/Textures/b.dds"]);
    const out = findOmissionLeads(l, ["Textures/a.dds", "Textures/b.dds"]);
    expect(out.leads).toEqual([]);
  });

  it("still flags a hole when the wrapper directory was stripped", () => {
    const l = listing([
      "01 Main/Textures/a.dds",
      "01 Main/Textures/b.dds",
      "01 Main/Textures/c.dds",
    ]);
    const out = findOmissionLeads(l, ["Textures/a.dds", "Textures/b.dds"]);
    expect(out.leads.map((x) => x.path)).toEqual(["01 Main/Textures/c.dds"]);
    expect(out.leads[0]!.confidence).toBe("high");
  });

  it("returns nothing when the archive is fully staged", () => {
    const l = listing(["Data/a.esp"]);
    expect(findOmissionLeads(l, ["Data/a.esp"])).toEqual({
      leads: [],
      suppressed: 0,
      suppressedDirectories: 0,
      declaredAlternatives: false,
    });
  });
});
