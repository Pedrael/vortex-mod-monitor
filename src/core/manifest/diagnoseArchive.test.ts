/**
 * 7z's failure message names four possibilities and distinguishes none:
 * "missing, corrupt, password-protected, or not an archive". That is fine at
 * your own keyboard and useless when the person who hit it is on another
 * machine and all you have is a screenshot.
 *
 * The case that matters most is TRUNCATION, because it is the one a healthy
 * collection produces: a ZIP's central directory is at the END, so a package
 * sent through a chat client or an interrupted copy has a perfect header and
 * nothing 7z can use. "Corrupt" sends the curator off to rebuild a package
 * that was never broken.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  describeArchiveDiagnosis,
  diagnoseArchive,
} from "./diagnoseArchive";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "eh-diag-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const write = (name: string, buf: Buffer): string => {
  const p = path.join(dir, name);
  fs.writeFileSync(p, buf);
  return p;
};

/** A minimal but structurally complete zip: local header + EOCD. */
const completeZip = (): Buffer =>
  Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.alloc(200, 7),
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    Buffer.alloc(18),
  ]);

describe("diagnoseArchive", () => {
  it("calls a cut-short download TRUNCATED, not corrupt", async () => {
    // The header is perfect; the central directory never arrived. Telling the
    // curator to rebuild would send them after a package that is fine.
    const p = write(
      "partial.ehcoll",
      Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(50_000, 1)]),
    );
    const d = await diagnoseArchive(p);
    expect(d.kind).toBe("truncated");

    const said = describeArchiveDiagnosis(d, p).join(" ");
    expect(said).toMatch(/INCOMPLETE/);
    expect(said).toMatch(/transfer was cut short/);
    // The actionable part: re-send, and compare sizes.
    expect(said).toMatch(/again/);
    expect(said).not.toMatch(/rebuild it/);
  });

  it("accepts a structurally complete zip", async () => {
    const d = await diagnoseArchive(write("ok.ehcoll", completeZip()));
    expect(d.kind).toBe("looks-like-a-zip");
  });

  it("names a missing file as missing", async () => {
    const d = await diagnoseArchive(path.join(dir, "nope.ehcoll"));
    expect(d.kind).toBe("missing");
    expect(describeArchiveDiagnosis(d, "nope.ehcoll").join(" ")).toMatch(
      /no file at/,
    );
  });

  it("separates an empty file from a truncated one", async () => {
    // Both are failed transfers, but zero bytes means nothing arrived at all.
    const d = await diagnoseArchive(write("empty.ehcoll", Buffer.alloc(0)));
    expect(d.kind).toBe("empty");
  });

  it("recognises a downloaded error page", async () => {
    // The classic: a link that returned HTML, saved under the right name.
    const d = await diagnoseArchive(
      write("page.ehcoll", Buffer.from("<!DOCTYPE html><html>Not found")),
    );
    expect(d.kind).toBe("not-an-archive");
    if (d.kind !== "not-an-archive") throw new Error("unreachable");
    expect(d.looksLike).toMatch(/HTML/);
  });

  it("recognises other archive formats renamed to .ehcoll", async () => {
    const seven = await diagnoseArchive(
      write("x.ehcoll", Buffer.concat([Buffer.from([0x37, 0x7a, 0xbc, 0xaf]), Buffer.alloc(40)])),
    );
    expect(seven.kind).toBe("not-an-archive");
    const rar = await diagnoseArchive(
      write("y.ehcoll", Buffer.concat([Buffer.from("Rar!"), Buffer.alloc(40)])),
    );
    expect(rar.kind).toBe("not-an-archive");
  });

  it("never throws, because it runs while reporting another error", async () => {
    // An error handler that fails turns a bad message into no message.
    await expect(diagnoseArchive(dir)).resolves.toBeDefined();
    await expect(
      diagnoseArchive(path.join(dir, "a", "b", "c.ehcoll")),
    ).resolves.toBeDefined();
  });

  it("reports the size, so it can be compared with the sender's", async () => {
    const p = write(
      "sized.ehcoll",
      Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(2_000_000, 1)]),
    );
    const said = describeArchiveDiagnosis(await diagnoseArchive(p), p).join(" ");
    expect(said).toMatch(/MB/);
  });
});
