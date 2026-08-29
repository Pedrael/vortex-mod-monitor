/**
 * extractBundledFromEhcoll had no tests, and it is on the CRITICAL path --
 * ten dependents, five processes, the whole install driver and the prefetch
 * pool. Removing its extraction entirely left the suite green. So did pointing
 * it at the WRONG entry. Both mutations are checked here now.
 *
 * This is the second half of moving off 7z. readEhcoll stopped spawning a
 * Windows binary to read manifest.json; this function was still spawning one
 * to read the bundled archives out of the SAME zip, so an install on Proton
 * would clear the manifest and then die on the first mod with the identical
 * error.
 *
 * The fixture is a real 7-Zip-written package with a bundled/<sha256>.zip
 * whose name is the true hash of its bytes -- see readZip.fixtures.ts.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BUNDLED_ENTRY,
  BUNDLED_SHA,
  EHCOLL_WITH_BUNDLED,
  INNER_ZIP_BYTES,
} from "../manifest/readZip.fixtures";
import { extractBundledFromEhcoll, safeRmTempDir } from "./modInstall";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "eh-bundled-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const pkg = (name = "p.ehcoll"): string => {
  const p = path.join(dir, name);
  fs.writeFileSync(p, Buffer.from(EHCOLL_WITH_BUNDLED, "base64"));
  return p;
};

describe("extractBundledFromEhcoll", () => {
  it("writes the bundled archive, preserving its path inside the temp dir", async () => {
    // The caller derives cleanup from tempDir precisely BECAUSE the entry has
    // a nested path -- bundled/<sha>.zip, not <sha>.zip. If that shape changed
    // the cleanup would leak the outer mkdtemp dir.
    const { extractedPath, tempDir } = await extractBundledFromEhcoll(
      pkg(),
      BUNDLED_ENTRY,
    );
    try {
      expect(extractedPath).toBe(
        path.join(tempDir, "bundled", `${BUNDLED_SHA}.zip`),
      );
      expect(fs.existsSync(extractedPath)).toBe(true);
    } finally {
      await safeRmTempDir(tempDir);
    }
  });

  it("extracts the archive byte-for-byte, verified by its own sha256", async () => {
    // The entry is NAMED by the sha256 of its content, so the fixture carries
    // its own correctness check -- the strongest assertion available here, and
    // the one that matters for a format whose promise is exact reproduction.
    const { extractedPath, tempDir } = await extractBundledFromEhcoll(
      pkg(),
      BUNDLED_ENTRY,
    );
    try {
      const bytes = fs.readFileSync(extractedPath);
      expect(bytes.length).toBe(INNER_ZIP_BYTES);
      const sha = crypto.createHash("sha256").update(bytes).digest("hex");
      expect(sha).toBe(BUNDLED_SHA);
    } finally {
      await safeRmTempDir(tempDir);
    }
  });

  it("extracts the entry it was ASKED for, not merely some entry", async () => {
    // Pointing this at manifest.json instead passed every earlier test,
    // because nothing compared what came out against what was requested.
    const { extractedPath, tempDir } = await extractBundledFromEhcoll(
      pkg(),
      BUNDLED_ENTRY,
    );
    try {
      const bytes = fs.readFileSync(extractedPath);
      // manifest.json is 2235 bytes of JSON; the bundled zip is 176 bytes
      // starting with a zip signature. Neither could be mistaken for the other.
      expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
      expect(bytes.length).not.toBe(2235);
    } finally {
      await safeRmTempDir(tempDir);
    }
  });

  it("gives each call its own temp dir, so concurrent extractions cannot collide", async () => {
    // The prefetch pool runs these in parallel by design.
    const [a, b] = await Promise.all([
      extractBundledFromEhcoll(pkg("a.ehcoll"), BUNDLED_ENTRY),
      extractBundledFromEhcoll(pkg("b.ehcoll"), BUNDLED_ENTRY),
    ]);
    try {
      expect(a.tempDir).not.toBe(b.tempDir);
      expect(fs.existsSync(a.extractedPath)).toBe(true);
      expect(fs.existsSync(b.extractedPath)).toBe(true);
    } finally {
      await safeRmTempDir(a.tempDir);
      await safeRmTempDir(b.tempDir);
    }
  });

  it("cleans up its temp dir when the entry is not in the package", async () => {
    // Extraction owns its cleanup until it returns successfully; a failure
    // that leaves the mkdtemp dir behind leaks one per failed mod, and a
    // 954-mod collection makes that visible.
    //
    // Counting the SHARED os.tmpdir() cannot show this: vitest runs test files
    // in parallel, so other files create and remove event-horizon-install-*
    // dirs while this one counts, and the assertion passed even with the
    // cleanup deleted. Point the temp dir at a private empty directory instead
    // -- os.tmpdir() reads these on every call, so the count is exact.
    const isolated = fs.mkdtempSync(path.join(dir, "tmp-"));
    const saved = {
      TMPDIR: process.env.TMPDIR,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
    };
    process.env.TMPDIR = isolated;
    process.env.TEMP = isolated;
    process.env.TMP = isolated;
    try {
      expect(os.tmpdir()).toBe(isolated); // the redirect must actually work
      expect(fs.readdirSync(isolated)).toEqual([]);

      await expect(
        extractBundledFromEhcoll(pkg(), "bundled/does-not-exist.zip"),
      ).rejects.toThrow(/Could not extract/);

      expect(fs.readdirSync(isolated)).toEqual([]);
    } finally {
      process.env.TMPDIR = saved.TMPDIR;
      process.env.TEMP = saved.TEMP;
      process.env.TMP = saved.TMP;
    }
  });

  it("never blames 7z, which it no longer uses", async () => {
    // A message pointing at 7z on a machine where no 7z ran sends the reader
    // to check something irrelevant -- exactly what happened to the tester.
    let msg = "";
    try {
      await extractBundledFromEhcoll(pkg(), "bundled/missing.zip");
    } catch (err) {
      msg = (err as Error).message;
    }
    expect(msg).not.toMatch(/7z|7-zip/i);
  });
});
