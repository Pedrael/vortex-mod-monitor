/**
 * Every Nexus mod carries a MANDATORY `source.sha256` whose docblock promises
 * the installer "downloads via Nexus IDs, then verifies against this hash.
 * Mismatch ⇒ HARD FAIL". Nothing did. The field was read in exactly one place
 * — locating a bundled archive inside the package — and a downloaded archive
 * was never compared against it.
 *
 * The thing it guards against is real: a mod author re-uploads under the same
 * file id, Nexus serves the new bytes to a request naming the old one, and the
 * collection installs something the curator never tested. Every downstream
 * symptom then points somewhere other than the cause.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  checkArchiveIdentity,
  describeArchiveIdentity,
} from "./checkArchiveIdentity";
import { archiveFileCacheKey, emptyArchiveHashCache } from "../archiveHashCache";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "eh-archid-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const write = (name: string, contents: string): string => {
  const p = path.join(dir, name);
  fs.writeFileSync(p, contents);
  return p;
};
const sha = (s: string): string =>
  crypto.createHash("sha256").update(s).digest("hex");

describe("the check the docblock promised", () => {
  it("confirms an archive that IS what the curator built from", async () => {
    const body = "the exact bytes nexus served the curator";
    const p = write("mod.7z", body);
    const check = await checkArchiveIdentity({
      archivePath: p,
      expectedSha256: sha(body),
    });
    expect(check.kind).toBe("matches");
  });

  it("catches a re-upload — same file id, different bytes", async () => {
    // The failure this exists for. Without it the collection installs a mod
    // the curator never tested and nothing says so.
    const p = write("mod.7z", "what nexus serves TODAY");
    const check = await checkArchiveIdentity({
      archivePath: p,
      expectedSha256: sha("what nexus served the curator"),
    });
    expect(check.kind).toBe("differs");
    if (check.kind === "differs") {
      expect(check.actual).toBe(sha("what nexus serves TODAY"));
    }
  });

  it("is case-insensitive about the recorded hash", async () => {
    // Hex is hex. A manifest hand-edited to uppercase must not read as a
    // re-upload — that would send a curator hunting a mod author for nothing.
    const body = "bytes";
    const p = write("mod.7z", body);
    const check = await checkArchiveIdentity({
      archivePath: p,
      expectedSha256: sha(body).toUpperCase(),
    });
    expect(check.kind).toBe("matches");
  });
});

describe("saying 'I cannot tell' instead of guessing", () => {
  it("no recorded hash", async () => {
    const p = write("mod.7z", "x");
    const check = await checkArchiveIdentity({
      archivePath: p,
      expectedSha256: undefined,
    });
    expect(check.kind).toBe("unknown");
    expect(check.kind === "unknown" && check.why).toMatch(/did not record/);
  });

  it("archive no longer on disk", async () => {
    const check = await checkArchiveIdentity({
      archivePath: undefined,
      expectedSha256: sha("x"),
    });
    expect(check.kind).toBe("unknown");
    expect(check.kind === "unknown" && check.why).toMatch(/no longer on disk/);
  });

  it("archive path exists but is a directory", async () => {
    const check = await checkArchiveIdentity({
      archivePath: dir,
      expectedSha256: sha("x"),
    });
    expect(check.kind).toBe("unknown");
  });

  it("never throws, whatever it is handed", async () => {
    // It runs while explaining another failure. An explanation that throws
    // leaves the user with strictly less than they had.
    await expect(
      checkArchiveIdentity({
        archivePath: path.join(dir, "nope", "gone.7z"),
        expectedSha256: sha("x"),
      }),
    ).resolves.toBeDefined();
  });
});

describe("reusing the hash the download scan already computed", () => {
  it("answers from the cache without re-reading the file", async () => {
    // On a resumed install this archive was very likely hashed minutes ago by
    // collectAvailableDownloads. Re-reading 2 GB to learn the same number is
    // the kind of heavy work that buys nothing.
    const p = write("mod.7z", "real contents");
    const stat = fs.statSync(p);
    const cache = emptyArchiveHashCache();
    // A deliberately WRONG hash in the cache: if the result follows it, the
    // cache was consulted; if it follows the file, it was not.
    cache.entries[archiveFileCacheKey(p, stat.size, stat.mtimeMs)] = {
      sha256: sha("something else entirely"),
      recoveredAt: new Date().toISOString(),
    };
    const check = await checkArchiveIdentity({
      archivePath: p,
      expectedSha256: sha("something else entirely"),
      cache,
    });
    expect(check.kind).toBe("matches");
  });

  it("falls back to hashing when the cache does not know this file", async () => {
    const body = "fresh";
    const p = write("mod.7z", body);
    const check = await checkArchiveIdentity({
      archivePath: p,
      expectedSha256: sha(body),
      cache: emptyArchiveHashCache(),
    });
    expect(check.kind).toBe("matches");
  });
});

describe("the driver actually asks, and tells the curator the answer", () => {
  // The failure being guarded: a check that exists and is never called. That
  // is precisely what happened to `source.sha256` itself — mandatory in the
  // schema, documented as a hard fail, read in exactly one unrelated place.
  const driver = async (): Promise<string> => {
    const fs = await import("fs");
    const path = await import("path");
    return fs.readFileSync(path.join(__dirname, "runInstall.ts"), "utf8");
  };

  it("consults the archive's identity when a mod cannot be reproduced", async () => {
    const src = await driver();
    expect(src).toMatch(/await checkArchiveIdentity\(/);
    expect(src).toMatch(/expectedSha256: manifestEntry\?\.source\.sha256/);
  });

  it("asks only AFTER the reinstall, not instead of it", async () => {
    // Hashing every archive up front would cost a full read per mod for a
    // question almost none of them raise.
    const src = await driver();
    const recover = src.indexOf("await tryRecoverFailedMod(");
    const check = src.indexOf("await checkArchiveIdentity(");
    expect(check).toBeGreaterThan(recover);
  });

  it("puts the verdict in the report the user sends", async () => {
    // Knowing the archive was re-uploaded is worthless in a log the curator
    // never sees. It has to be in the pasted text.
    const src = await driver();
    expect(src).toMatch(/describeArchiveIdentity\(archiveIdentity\)/);
  });

  it("logs a mismatch with both hashes", async () => {
    const src = await driver();
    expect(src).toMatch(/"install\.archive-identity"/);
    expect(src).toMatch(/expected: archiveIdentity\.expected/);
  });

  it("also checks the file the USER picked by hand", async () => {
    // The one path where bytes arrive by hand: browsed to a website,
    // downloaded something, pointed us at it. It was installed unexamined —
    // wrong version, wrong mod, half-finished download, all indistinguishable
    // from the right file and all recorded afterwards as the collection's mod.
    const src = await driver();
    const fn = src.slice(src.indexOf("function executePromptUserChoice"));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    expect(body).toMatch(/checkArchiveIdentity\(/);
    expect(body).toMatch(/archivePath: choice\.localPath/);
  });

  it("installs the picked file anyway — a note, not a refusal", async () => {
    // A browse-mode dependency legitimately resolves to a different-but-
    // equivalent build: a mirror, a repack, a page the author replaced. The
    // user made a deliberate choice we have no standing to overrule. What
    // they should not do is make it unknowingly.
    const src = await driver();
    const fn = src.slice(src.indexOf("function executePromptUserChoice"));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    const mismatch = body.indexOf('picked.kind === "differs"');
    const install = body.indexOf("await installFromLocalArchive(");
    expect(mismatch).toBeGreaterThan(-1);
    expect(install).toBeGreaterThan(-1);
    // The check happens FIRST, and the install still happens after it.
    expect(mismatch).toBeLessThan(install);
    expect(body).not.toMatch(/throw new Error\([^)]*picked/);
  });

  it("does not repeat the notice on a retry", async () => {
    // Telling a user twice about one thing invites the reasonable conclusion
    // that it happened twice.
    const src = await driver();
    expect(src).toMatch(/onNotice: \(\) => undefined/);
  });
});

describe("what the curator is told", () => {
  it("names a re-upload as the likely cause", async () => {
    // The explanation a curator can actually check, and the one they would
    // otherwise never think of.
    const text = describeArchiveIdentity({
      kind: "differs",
      expected: "a".repeat(64),
      actual: "b".repeat(64),
    });
    expect(text).toMatch(/re-uploaded under the same file id/i);
  });

  it("says a matching archive makes re-downloading pointless", async () => {
    // Stops the next suggestion before it is made: the same request fetches
    // the same bytes.
    const text = describeArchiveIdentity({ kind: "matches", sha256: "a".repeat(64) });
    expect(text).toMatch(/downloading it again would change nothing/i);
    expect(text).toMatch(/happened after the download/i);
  });

  it("shows enough hash to compare by eye, not the whole thing", async () => {
    const text = describeArchiveIdentity({
      kind: "differs",
      expected: "a".repeat(64),
      actual: "b".repeat(64),
    });
    expect(text).toContain("aaaaaaaaaaaaaaaa...");
    expect(text).not.toContain("a".repeat(64));
  });
});
