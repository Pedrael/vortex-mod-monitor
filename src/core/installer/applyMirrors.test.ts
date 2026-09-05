/**
 * The mirror, executed — real files, a real ZIP, the real extractor.
 *
 * `mirrorStaging.test.ts` covers the decision; nothing there touches a disk.
 * This runs the half that does, because the two failures that cost this
 * project releases were both in code no test ever EXECUTED. A plan that is
 * right and an applier that writes to the wrong path fail identically from the
 * outside.
 *
 * The ZIP is built here rather than mocked: `extractZipEntryToFile` is the
 * thing under test, and a stub that returns bytes proves the stub works.
 */
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyMirrorPlan, describeMirrorOutcome, mirrorEntryFor } from "./applyMirrors";
import { planMirror } from "./mirrorStaging";
import { crc32 } from "../manifest/readZip";

const sha = (b: Buffer): string => createHash("sha256").update(b).digest("hex");

/**
 * A minimal STORED zip. No compression, no ZIP64 — enough entries to extract.
 *
 * Written by hand because the 7z the packager uses is stubbed out under test,
 * and the point here is to drive the real reader.
 */
function makeZip(entries: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const sum = crc32(e.data);

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4); // version needed
    lfh.writeUInt16LE(0, 6); // flags
    lfh.writeUInt16LE(0, 8); // method: stored
    lfh.writeUInt32LE(0, 10); // time+date
    lfh.writeUInt32LE(sum, 14);
    lfh.writeUInt32LE(e.data.length, 18);
    lfh.writeUInt32LE(e.data.length, 22);
    lfh.writeUInt16LE(name.length, 26);
    lfh.writeUInt16LE(0, 28);
    locals.push(lfh, name, e.data);

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0, 8);
    cdh.writeUInt16LE(0, 10);
    cdh.writeUInt32LE(0, 12);
    cdh.writeUInt32LE(sum, 16);
    cdh.writeUInt32LE(e.data.length, 20);
    cdh.writeUInt32LE(e.data.length, 24);
    cdh.writeUInt16LE(name.length, 28);
    cdh.writeUInt32LE(offset, 42);
    central.push(cdh, name);

    offset += lfh.length + name.length + e.data.length;
  }

  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

let dir: string;
let staging: string;
let ehcoll: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "eh-mirror-t-"));
  staging = join(dir, "staging");
  ehcoll = join(dir, "pkg.ehcoll");
  await mkdir(staging, { recursive: true });
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const CLEANED = Buffer.from("the curator's cleaned plugin");
const STOCK = Buffer.from("whatever the archive produced");

describe("applying a mirror to a real folder", () => {
  it("writes a file the user does not have", async () => {
    await writeFile(ehcoll, makeZip([
      { name: mirrorEntryFor(sha(CLEANED)), data: CLEANED },
    ]));

    const outcome = await applyMirrorPlan({
      stagingRoot: staging,
      ehcollPath: ehcoll,
      plan: planMirror({
        target: [{ path: "Data/x.esp", size: CLEANED.length, sha256: sha(CLEANED) }],
        current: [],
      }),
    });

    expect(outcome).toMatchObject({ restored: 1, removed: 0, failures: [] });
    expect(await readFile(join(staging, "Data", "x.esp"))).toEqual(CLEANED);
  });

  it("replaces a file whose bytes differ, and creates missing folders", async () => {
    await mkdir(join(staging, "Data"), { recursive: true });
    await writeFile(join(staging, "Data", "x.esp"), STOCK);
    await writeFile(ehcoll, makeZip([
      { name: mirrorEntryFor(sha(CLEANED)), data: CLEANED },
    ]));

    await applyMirrorPlan({
      stagingRoot: staging,
      ehcollPath: ehcoll,
      plan: planMirror({
        target: [{ path: "Data/x.esp", size: CLEANED.length, sha256: sha(CLEANED) }],
        current: [{ path: "Data/x.esp", size: STOCK.length, sha256: sha(STOCK) }],
      }),
    });

    expect(await readFile(join(staging, "Data", "x.esp"))).toEqual(CLEANED);
  });

  it("removes a file the curator does not have", async () => {
    await writeFile(join(staging, "leftover.esp"), STOCK);
    await writeFile(ehcoll, makeZip([
      { name: mirrorEntryFor(sha(CLEANED)), data: CLEANED },
    ]));

    const outcome = await applyMirrorPlan({
      stagingRoot: staging,
      ehcollPath: ehcoll,
      plan: planMirror({
        target: [{ path: "keep.esp", size: CLEANED.length, sha256: sha(CLEANED) }],
        current: [{ path: "leftover.esp", size: STOCK.length, sha256: sha(STOCK) }],
      }),
    });

    expect(outcome.removed).toBe(1);
    expect(existsSync(join(staging, "leftover.esp"))).toBe(false);
    expect(existsSync(join(staging, "keep.esp"))).toBe(true);
  });
});

describe("a blob that is not what it claims", () => {
  it("is NOT written, and is reported", async () => {
    // The package is content-addressed, so the entry name is the expectation.
    // Writing bytes that fail it would be a mirror that installs the wrong
    // file and calls it success — the one outcome worse than stopping.
    await writeFile(ehcoll, makeZip([
      { name: mirrorEntryFor(sha(CLEANED)), data: STOCK },
    ]));

    const outcome = await applyMirrorPlan({
      stagingRoot: staging,
      ehcollPath: ehcoll,
      plan: planMirror({
        target: [{ path: "x.esp", size: CLEANED.length, sha256: sha(CLEANED) }],
        current: [],
      }),
    });

    expect(outcome.restored).toBe(0);
    expect(outcome.failures).toHaveLength(1);
    expect(outcome.failures[0]!.why).toContain("not the file the manifest describes");
    expect(existsSync(join(staging, "x.esp"))).toBe(false);
  });

  it("leaves the existing file untouched rather than half-replacing it", async () => {
    await writeFile(join(staging, "x.esp"), STOCK);
    await writeFile(ehcoll, makeZip([
      { name: mirrorEntryFor(sha(CLEANED)), data: Buffer.from("corrupt") },
    ]));

    await applyMirrorPlan({
      stagingRoot: staging,
      ehcollPath: ehcoll,
      plan: planMirror({
        target: [{ path: "x.esp", size: CLEANED.length, sha256: sha(CLEANED) }],
        current: [{ path: "x.esp", size: STOCK.length, sha256: sha(STOCK) }],
      }),
    });

    expect(await readFile(join(staging, "x.esp"))).toEqual(STOCK);
  });

  it("keeps going after one failure", async () => {
    const OTHER = Buffer.from("second file, perfectly fine");
    await writeFile(ehcoll, makeZip([
      { name: mirrorEntryFor(sha(CLEANED)), data: Buffer.from("wrong") },
      { name: mirrorEntryFor(sha(OTHER)), data: OTHER },
    ]));

    const outcome = await applyMirrorPlan({
      stagingRoot: staging,
      ehcollPath: ehcoll,
      plan: planMirror({
        target: [
          { path: "bad.esp", size: CLEANED.length, sha256: sha(CLEANED) },
          { path: "good.esp", size: OTHER.length, sha256: sha(OTHER) },
        ],
        current: [],
      }),
    });

    expect(outcome.restored).toBe(1);
    expect(outcome.failures).toHaveLength(1);
    expect(await readFile(join(staging, "good.esp"))).toEqual(OTHER);
  });

  it("reports a blob the package does not carry at all", async () => {
    await writeFile(ehcoll, makeZip([{ name: "unrelated", data: STOCK }]));

    const outcome = await applyMirrorPlan({
      stagingRoot: staging,
      ehcollPath: ehcoll,
      plan: planMirror({
        target: [{ path: "x.esp", size: CLEANED.length, sha256: sha(CLEANED) }],
        current: [],
      }),
    });

    expect(outcome.restored).toBe(0);
    expect(outcome.failures).toHaveLength(1);
  });
});

describe("what the user is told", () => {
  it("names the files that could not be mirrored", () => {
    const line = describeMirrorOutcome("Apocalypse", {
      restored: 2,
      removed: 1,
      failures: [{ path: "x.esp", why: "missing from package" }],
    });
    expect(line).toContain("2 file(s) written");
    expect(line).toContain("1 removed");
    expect(line).toContain("does not match the curator's copy");
    expect(line).toContain("x.esp");
  });

  it("says nothing when there was nothing to do", () => {
    expect(
      describeMirrorOutcome("Mod", { restored: 0, removed: 0, failures: [] }),
    ).toBeUndefined();
  });
});
