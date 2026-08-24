/**
 * Tests for archive content listing.
 *
 * These matter more than usual: this listing is meant to be the reference that
 * does NOT depend on anyone's staging folder, so a parsing mistake here would
 * quietly reintroduce the trust problem it exists to solve. The riskiest
 * behaviour is a WRONG crc (invents a mismatch); the safe degradation is a
 * MISSING one (falls back to size).
 */
import { EventEmitter } from "events";
import { describe, expect, it } from "vitest";

import {
  contentKey,
  indexByContent,
  listArchiveContents,
  normalizeArchivePath,
} from "./archiveContents";
import type { SevenZipApi, SevenZipListEntry } from "./sevenZip";

/** A SevenZipApi whose `list` replays the given entries, then ends. */
function fakeSevenZip(entries: SevenZipListEntry[], err?: Error): SevenZipApi {
  return {
    list: () => {
      const em = new EventEmitter();
      setImmediate(() => {
        if (err) {
          em.emit("error", err);
          return;
        }
        for (const e of entries) em.emit("data", e);
        em.emit("end");
      });
      return em as unknown as ReturnType<SevenZipApi["list"]>;
    },
  } as unknown as SevenZipApi;
}

describe("listArchiveContents", () => {
  it("returns file entries with size and normalised lowercase crc", async () => {
    const sz = fakeSevenZip([
      { file: "Data\\Textures\\a.dds", size: 100, crc: "612E4497" },
      { file: "Data/Meshes/b.nif", size: 200, crc: "0A1B2C3D" },
    ]);
    const out = await listArchiveContents(sz, "x.zip");
    expect(out.entries).toEqual([
      { path: "Data/Textures/a.dds", size: 100, crc: "612e4497" },
      { path: "Data/Meshes/b.nif", size: 200, crc: "0a1b2c3d" },
    ]);
    expect(out.crcCoverage).toBe(1);
  });

  it("drops directory entries so they do not depress crc coverage", async () => {
    const sz = fakeSevenZip([
      { file: "Data", attr: "D...." },
      { file: "Data/sub", folder: "+" },
      { file: "Data/a.esp", size: 10, crc: "aabbccdd" },
    ]);
    const out = await listArchiveContents(sz, "x.7z");
    expect(out.entries.map((e) => e.path)).toEqual(["Data/a.esp"]);
    expect(out.crcCoverage).toBe(1);
  });

  it("pads short crcs so string comparison is safe", async () => {
    // 7z prints CRCs unpadded; "ABCD" and "0000abcd" are the same value.
    const sz = fakeSevenZip([{ file: "a.txt", size: 1, crc: "ABCD" }]);
    const out = await listArchiveContents(sz, "x.zip");
    expect(out.entries[0].crc).toBe("0000abcd");
  });

  it("accepts a numeric crc from node-7z", async () => {
    const sz = fakeSevenZip([{ file: "a.txt", size: 1, crc: 43981 }]);
    const out = await listArchiveContents(sz, "x.zip");
    // 43981 === 0xabcd
    expect(out.entries[0].crc).toBe("0000abcd");
  });

  it("treats an unusable crc as ABSENT rather than inventing a value", async () => {
    // A wrong crc manufactures a mismatch; a missing one degrades to size.
    const sz = fakeSevenZip([
      { file: "a.txt", size: 1, crc: "not-hex" },
      { file: "b.txt", size: 2, crc: "" },
      { file: "c.txt", size: 3 },
    ]);
    const out = await listArchiveContents(sz, "x.zip");
    expect(out.entries.every((e) => e.crc === undefined)).toBe(true);
    expect(out.withCrc).toBe(0);
    expect(out.crcCoverage).toBe(0);
  });

  it("reports partial coverage honestly", async () => {
    const sz = fakeSevenZip([
      { file: "a", size: 1, crc: "aabbccdd" },
      { file: "b", size: 2 },
      { file: "c", size: 3, crc: "11223344" },
      { file: "d", size: 4 },
    ]);
    const out = await listArchiveContents(sz, "x.zip");
    expect(out.withCrc).toBe(2);
    expect(out.crcCoverage).toBe(0.5);
  });

  it("REJECTS when the archive cannot be read, never resolving empty", async () => {
    // "Failed to list" and "archive is empty" must not look the same: the
    // first means we cannot verify, the second means there is nothing to.
    const sz = fakeSevenZip([], new Error("corrupt archive"));
    await expect(listArchiveContents(sz, "bad.zip")).rejects.toThrow("corrupt archive");
  });

  it("treats a genuinely empty archive as full coverage, not zero", async () => {
    const out = await listArchiveContents(fakeSevenZip([]), "empty.zip");
    expect(out.entries).toEqual([]);
    expect(out.crcCoverage).toBe(1);
  });
});

describe("indexByContent", () => {
  it("indexes by size+crc so renamed files still match", async () => {
    // A FOMOD installs `source` to a different `destination`; the path differs,
    // the bytes do not.
    const listing = await listArchiveContents(
      fakeSevenZip([{ file: "optional/hi-res/a.dds", size: 500, crc: "deadbeef" }]),
      "x.zip",
    );
    const idx = indexByContent(listing);
    expect(idx.get(contentKey(500, "deadbeef"))).toHaveLength(1);
  });

  it("buckets duplicate content under one key", async () => {
    const listing = await listArchiveContents(
      fakeSevenZip([
        { file: "a/x.dds", size: 10, crc: "aaaaaaaa" },
        { file: "b/x.dds", size: 10, crc: "aaaaaaaa" },
      ]),
      "x.zip",
    );
    expect(indexByContent(listing).get(contentKey(10, "aaaaaaaa"))).toHaveLength(2);
  });

  it("still indexes entries with no crc, under size alone", async () => {
    const listing = await listArchiveContents(
      fakeSevenZip([{ file: "a", size: 7 }]),
      "x.zip",
    );
    expect(indexByContent(listing).get(contentKey(7, undefined))).toHaveLength(1);
  });
});

describe("normalizeArchivePath", () => {
  it("converts separators and strips a leading ./", () => {
    expect(normalizeArchivePath("Data\\Textures\\a.dds")).toBe("Data/Textures/a.dds");
    expect(normalizeArchivePath("./a.txt")).toBe("a.txt");
  });
});
