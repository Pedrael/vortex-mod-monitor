/**
 * The record of an install that ended badly.
 *
 * Three ways an install can end, and until this only one left a trace: a
 * SUCCESS wrote a receipt, a CRASH left a marker behind, and a clean failure
 * left nothing. The third is the common one — a tester's run stopped at the
 * deploy step with 963 mods staged, and his machine had no record of it at
 * all.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

import {
  clearInstallAttempt,
  describeInstallAttempt,
  getAttemptDir,
  listInstallAttempts,
  writeInstallAttempt,
  type InstallAttempt,
} from "./attemptRecord";

let dir: string;
beforeEach(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), "eh-attempt-"));
});
afterEach(async () => {
  await fsp.rm(dir, { recursive: true, force: true }).catch(() => undefined);
});

const attempt = (over: Partial<InstallAttempt> = {}): InstallAttempt => ({
  packageId: "pkg-1",
  packageName: "Ivy 2",
  packageVersion: "1.0.12",
  gameId: "fallout4",
  endedAt: "2026-09-01T23:34:03.000Z",
  outcome: "failed",
  phase: "installing-mods",
  installedCount: 963,
  totalMods: 967,
  error: "No deployment method active",
  profileId: "prof-1",
  ...over,
});

describe("writing and reading attempts", () => {
  it("round-trips a failed attempt", async () => {
    await writeInstallAttempt(dir, attempt());
    const [found] = await listInstallAttempts(dir);
    expect(found?.installedCount).toBe(963);
    expect(found?.error).toBe("No deployment method active");
  });

  it("keeps one record per collection, the latest", async () => {
    // Same identity as the receipt: a collection has at most one of each, so
    // a re-run replaces rather than accumulates.
    await writeInstallAttempt(dir, attempt({ installedCount: 100 }));
    await writeInstallAttempt(dir, attempt({ installedCount: 963 }));
    const all = await listInstallAttempts(dir);
    expect(all).toHaveLength(1);
    expect(all[0]?.installedCount).toBe(963);
  });

  it("forgets the failure once an install succeeds", async () => {
    // A panel that keeps warning about a problem the user has just fixed
    // teaches them to ignore it.
    await writeInstallAttempt(dir, attempt());
    await clearInstallAttempt(dir, "pkg-1");
    expect(await listInstallAttempts(dir)).toEqual([]);
  });

  it("clearing something that was never there is fine", async () => {
    // The normal case: most installs never failed.
    await expect(clearInstallAttempt(dir, "nope")).resolves.toBeUndefined();
  });

  it("newest first", async () => {
    await writeInstallAttempt(dir, attempt({ packageId: "old", endedAt: "2026-01-01T00:00:00.000Z" }));
    await writeInstallAttempt(dir, attempt({ packageId: "new", endedAt: "2026-09-01T00:00:00.000Z" }));
    expect((await listInstallAttempts(dir)).map((a) => a.packageId)).toEqual([
      "new",
      "old",
    ]);
  });
});

describe("refusing to fail the install", () => {
  it("never throws when the directory cannot be written", async () => {
    // The install has already ended by the time this runs. Losing the record
    // of a failure is a far smaller harm than turning a partial install into
    // a crash.
    const bogus = path.join(dir, "file-not-a-dir");
    await fsp.writeFile(bogus, "x", "utf8");
    await expect(
      writeInstallAttempt(bogus, attempt()),
    ).resolves.toBeUndefined();
  });

  it("returns nothing rather than throwing on a missing directory", async () => {
    expect(await listInstallAttempts(path.join(dir, "nope"))).toEqual([]);
  });

  it("one unreadable record does not hide the others", async () => {
    await writeInstallAttempt(dir, attempt({ packageId: "good" }));
    await fsp.writeFile(
      path.join(getAttemptDir(dir), "broken.json"),
      "{ not json",
      "utf8",
    );
    expect((await listInstallAttempts(dir)).map((a) => a.packageId)).toEqual([
      "good",
    ]);
  });

  it("skips a record with no identity rather than half-rendering it", async () => {
    await fsp.mkdir(getAttemptDir(dir), { recursive: true });
    await fsp.writeFile(
      path.join(getAttemptDir(dir), "anon.json"),
      JSON.stringify({ installedCount: 5 }),
      "utf8",
    );
    expect(await listInstallAttempts(dir)).toEqual([]);
  });
});

describe("describeInstallAttempt", () => {
  it("leads with how far it got", () => {
    // 963 of 967 and 4 of 967 call for completely different reactions, and
    // both used to be shown as nothing at all.
    expect(describeInstallAttempt(attempt())).toContain("963 of 967 mods");
  });

  it("says the installed mods are still there", () => {
    // The thing that decides what the user does next: re-running continues
    // rather than starting over.
    const msg = describeInstallAttempt(attempt());
    expect(msg).toContain("still on your machine");
    expect(msg).toContain("rather than starting over");
  });

  it("does not blame the user for a failure", () => {
    expect(describeInstallAttempt(attempt()).toLowerCase()).not.toContain(
      "you stopped",
    );
  });

  it("does say so when the user DID stop it", () => {
    const msg = describeInstallAttempt(attempt({ outcome: "aborted" }));
    expect(msg).toContain("You stopped this install");
    expect(msg).toContain("Nothing is broken");
  });

  it("handles a run that installed nothing", () => {
    const msg = describeInstallAttempt(
      attempt({ installedCount: 0, totalMods: 0 }),
    );
    expect(msg).toContain("before installing anything");
    expect(msg).not.toContain("0 of 0");
  });
});
