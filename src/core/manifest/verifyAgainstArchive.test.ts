import { describe, expect, it } from "vitest";

import type { ArchiveListing } from "./archiveContents";
import { verifyStagingAgainstArchive } from "./verifyAgainstArchive";

function listing(entries: Array<{ path: string; size?: number; crc?: string }>): ArchiveListing {
  const withCrc = entries.filter((e) => e.crc !== undefined).length;
  return {
    entries,
    withCrc,
    crcCoverage: entries.length === 0 ? 1 : withCrc / entries.length,
  };
}

describe("verifyStagingAgainstArchive", () => {
  it("matches by CONTENT even when the FOMOD renamed the file", () => {
    // The whole point: `<file source="optional/hi/a.dds" destination="Textures/a.dds">`
    // means the paths disagree and the bytes do not.
    const result = verifyStagingAgainstArchive(
      [{ path: "Textures/a.dds", size: 500, crc: "deadbeef" }],
      listing([{ path: "optional/hi/a.dds", size: 500, crc: "deadbeef" }]),
    );
    expect(result.matched).toBe(1);
    expect(result.unexplained).toBe(0);
    expect(result.verdicts[0].via?.path).toBe("optional/hi/a.dds");
  });

  it("reports a post-install-modified file as UNEXPLAINED, never as corrupt", () => {
    // Real case from the profile: BA2 repacked after install, so size and crc
    // both differ. Legitimate. The verdict vocabulary must not call this
    // corruption — see the module note.
    const result = verifyStagingAgainstArchive(
      [{ path: "Textures.ba2", size: 91398814, crc: "44b193f9" }],
      listing([{ path: "Textures.ba2", size: 122430936, crc: "4eef1d22" }]),
    );
    expect(result.unexplained).toBe(1);
    expect(result.verdicts[0].kind).toBe("unexplained");
    // Deliberately asserting the vocabulary: no verdict may imply corruption.
    expect(["matched", "size-only", "unexplained"]).toContain(result.verdicts[0].kind);
  });

  it("degrades to size-only when a crc is missing on either side", () => {
    const noCrcInArchive = verifyStagingAgainstArchive(
      [{ path: "a", size: 10, crc: "aaaaaaaa" }],
      listing([{ path: "a", size: 10 }]),
    );
    expect(noCrcInArchive.sizeOnly).toBe(1);
    expect(noCrcInArchive.matched).toBe(0);

    const noCrcStaged = verifyStagingAgainstArchive(
      [{ path: "a", size: 10 }],
      listing([{ path: "a", size: 10, crc: "aaaaaaaa" }]),
    );
    expect(noCrcStaged.sizeOnly).toBe(1);
    expect(noCrcStaged.matched).toBe(0);
  });

  it("never upgrades a size-only agreement to a match", () => {
    // Same size, different content, is NOT proof of anything.
    const result = verifyStagingAgainstArchive(
      [{ path: "a", size: 10, crc: "ffffffff" }],
      listing([{ path: "a", size: 10 }]),
    );
    expect(result.matched).toBe(0);
    expect(result.sizeOnly).toBe(1);
  });

  it("does not let one archive entry explain two staged copies", () => {
    const result = verifyStagingAgainstArchive(
      [
        { path: "a.dds", size: 10, crc: "aaaaaaaa" },
        { path: "b.dds", size: 10, crc: "aaaaaaaa" },
      ],
      listing([{ path: "src.dds", size: 10, crc: "aaaaaaaa" }]),
    );
    expect(result.matched).toBe(1);
    expect(result.unexplained).toBe(1);
  });

  it("reports archive entries that were never staged — the omission signal", () => {
    const result = verifyStagingAgainstArchive(
      [{ path: "chosen.esp", size: 1, crc: "11111111" }],
      listing([
        { path: "chosen.esp", size: 1, crc: "11111111" },
        { path: "optionA/x.dds", size: 2, crc: "22222222" },
        { path: "optionB/y.dds", size: 3, crc: "33333333" },
      ]),
    );
    expect(result.matched).toBe(1);
    expect(result.archiveEntriesNotStaged.map((e) => e.path).sort()).toEqual([
      "optionA/x.dds",
      "optionB/y.dds",
    ]);
  });

  it("counts duplicates left over in the archive as not staged", () => {
    const result = verifyStagingAgainstArchive(
      [{ path: "a", size: 5, crc: "abcdabcd" }],
      listing([
        { path: "one/a", size: 5, crc: "abcdabcd" },
        { path: "two/a", size: 5, crc: "abcdabcd" },
      ]),
    );
    expect(result.matched).toBe(1);
    expect(result.archiveEntriesNotStaged).toHaveLength(1);
  });

  it("treats a mod that stages nothing as fully explained", () => {
    const result = verifyStagingAgainstArchive([], listing([{ path: "a", size: 1, crc: "aa" }]));
    expect(result.explainedRatio).toBe(1);
    expect(result.archiveEntriesNotStaged).toHaveLength(1);
  });

  it("carries crcCoverage through so a weak listing is visible to the caller", () => {
    const result = verifyStagingAgainstArchive(
      [{ path: "a", size: 1, crc: "aaaaaaaa" }],
      listing([
        { path: "a", size: 1, crc: "aaaaaaaa" },
        { path: "b", size: 2 },
      ]),
    );
    expect(result.crcCoverage).toBe(0.5);
  });

  it("computes explainedRatio over matched AND size-only", () => {
    const result = verifyStagingAgainstArchive(
      [
        { path: "a", size: 1, crc: "aaaaaaaa" },
        { path: "b", size: 2 },
        { path: "c", size: 99, crc: "cccccccc" },
      ],
      listing([
        { path: "a", size: 1, crc: "aaaaaaaa" },
        { path: "b", size: 2 },
      ]),
    );
    expect(result.matched).toBe(1);
    expect(result.sizeOnly).toBe(1);
    expect(result.unexplained).toBe(1);
    expect(result.explainedRatio).toBeCloseTo(2 / 3);
  });
});
