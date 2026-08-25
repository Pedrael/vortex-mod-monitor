/**
 * The one assertion that matters most here is `allowInstall === false`.
 *
 * These mods are already installed, with FOMOD choices the curator made once.
 * Re-running the installer to get an archive back would risk the very thing the
 * archive exists to describe — and a batch of reinstalls is the condition under
 * which Vortex is observed to drop files. Recovery fetches bytes and nothing
 * else.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __testPaths } from "../../test/stubs/vortex-api";
import {
  applyRecovery,
  findRecoverableMods,
  recoverMissingArchives,
  type RecoverableMod,
} from "./archiveRecovery";
import type { AuditorMod } from "./getModsListForProfile";

const mod = (over: Partial<AuditorMod> & { id: string }): AuditorMod =>
  ({
    name: over.id,
    enabled: true,
    collectionIds: [],
    hasInstallerChoices: false,
    hasDetailedInstallerChoices: false,
    fomodSelections: [],
    rules: [],
    modType: "",
    fileOverrides: [],
    enabledINITweaks: [],
    installOrder: 0,
    ...over,
  }) as AuditorMod;

let tmp: string;
let downloads: Record<string, unknown>;
/** Every nexusDownload call, so the arguments can be asserted. */
let calls: unknown[][];
let inFlight = 0;
let maxConcurrent = 0;

function writeArchive(name: string, body: string): string {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, body);
  return crypto.createHash("sha256").update(body).digest("hex");
}

/** A Vortex api whose downloads land instantly and finish. */
function fakeApi(behaviour?: {
  fail?: Set<number>;
  stuck?: Set<number>;
  missingExt?: boolean;
}): any {
  calls = [];
  const api: any = {
    getState: () => ({ persistent: { downloads: { files: downloads } } }),
  };
  if (behaviour?.missingExt === true) {
    api.ext = {};
    return api;
  }
  api.ext = {
    nexusDownload: async (...args: unknown[]) => {
      calls.push(args);
      inFlight += 1;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      const fileId = args[2] as number;
      const id = `dl-${fileId}`;
      if (behaviour?.fail?.has(fileId) === true) {
        downloads[id] = { id, state: "failed", failCause: { message: "410 Gone" } };
      } else if (behaviour?.stuck?.has(fileId) === true) {
        downloads[id] = { id, state: "finalizing" };
      } else {
        downloads[id] = { id, state: "finished", localPath: `file-${fileId}.7z` };
      }
      inFlight -= 1;
      return id;
    },
  };
  return api;
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eh-recovery-"));
  __testPaths.downloadPath = tmp;
  downloads = {};
  inFlight = 0;
  maxConcurrent = 0;
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  __testPaths.downloadPath = "/stub/downloads";
});

describe("findRecoverableMods", () => {
  it("targets only mods with no hash AND a Nexus file to ask for", () => {
    const { recoverable, unattemptable } = findRecoverableMods([
      mod({ id: "fine", archiveSha256: "abc", nexusModId: 1, nexusFileId: 2 }),
      mod({ id: "gettable", nexusModId: 10, nexusFileId: 20 }),
      mod({ id: "external" }),
      mod({ id: "half", nexusModId: 5 }),
    ]);
    expect(recoverable.map((r) => r.mod.id)).toEqual(["gettable"]);
    expect(unattemptable.map((m) => m.id)).toEqual(["external", "half"]);
  });

  it("accepts Nexus ids that arrive as strings", () => {
    const { recoverable } = findRecoverableMods([
      mod({ id: "m", nexusModId: "77337" as never, nexusFileId: "123" as never }),
    ]);
    expect(recoverable[0]!.nexusModId).toBe(77337);
    expect(recoverable[0]!.nexusFileId).toBe(123);
  });
});

describe("recoverMissingArchives", () => {
  const target = (id: string, fileId: number): RecoverableMod => ({
    mod: mod({ id, nexusModId: 100, nexusFileId: fileId }),
    nexusModId: 100,
    nexusFileId: fileId,
  });

  it("downloads WITHOUT installing", async () => {
    const sha = writeArchive("file-1.7z", "archive-bytes");
    const api = fakeApi();
    const report = await recoverMissingArchives(api, "fallout4", [target("a", 1)]);

    // The load-bearing assertion: allowInstall is false.
    expect(calls).toHaveLength(1);
    expect(calls[0]![4]).toBe(false);
    expect(report.recovered).toHaveLength(1);
    expect((report.recovered[0] as { archiveSha256: string }).archiveSha256).toBe(sha);
  });

  it("hashes the bytes it actually fetched", async () => {
    const shaA = writeArchive("file-1.7z", "aaa");
    const shaB = writeArchive("file-2.7z", "bbb");
    const api = fakeApi();
    const report = await recoverMissingArchives(api, "fallout4", [
      target("a", 1),
      target("b", 2),
    ]);
    expect(report.recovered.map((r) => (r as { archiveSha256: string }).archiveSha256))
      .toEqual([shaA, shaB]);
    expect(shaA).not.toBe(shaB);
  });

  it("never runs two downloads at once", async () => {
    writeArchive("file-1.7z", "a");
    writeArchive("file-2.7z", "b");
    writeArchive("file-3.7z", "c");
    const api = fakeApi();
    await recoverMissingArchives(api, "fallout4", [
      target("a", 1), target("b", 2), target("c", 3),
    ]);
    expect(maxConcurrent).toBe(1);
  });

  it("keeps going when one mod is gone from Nexus", async () => {
    writeArchive("file-1.7z", "a");
    writeArchive("file-3.7z", "c");
    const api = fakeApi({ fail: new Set([2]) });
    const report = await recoverMissingArchives(api, "fallout4", [
      target("a", 1), target("gone", 2), target("c", 3),
    ]);
    expect(report.recovered.map((r) => r.mod.id)).toEqual(["a", "c"]);
    expect(report.failed).toHaveLength(1);
    expect((report.failed[0] as { reason: string }).reason).toMatch(/410 Gone/);
  });

  it("does not hash a download that never finished", async () => {
    const api = fakeApi({ stuck: new Set([1]) });
    const report = await recoverMissingArchives(api, "fallout4", [target("a", 1)], {
      settleTimeoutMs: 30,
    });
    expect(report.recovered).toEqual([]);
    expect((report.failed[0] as { reason: string }).reason).toMatch(/did not finish/);
  });

  it("reports plainly when Nexus integration is unavailable", async () => {
    const api = fakeApi({ missingExt: true });
    const report = await recoverMissingArchives(api, "fallout4", [target("a", 1)]);
    expect(report.recovered).toEqual([]);
    expect((report.failed[0] as { reason: string }).reason).toMatch(/Nexus integration/);
  });

  it("stops when cancelled", async () => {
    writeArchive("file-1.7z", "a");
    const ctrl = new AbortController();
    ctrl.abort();
    const api = fakeApi();
    await expect(
      recoverMissingArchives(api, "fallout4", [target("a", 1)], { signal: ctrl.signal }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe("applyRecovery", () => {
  it("folds recovered hashes back in and leaves everything else alone", () => {
    const mods = [mod({ id: "a" }), mod({ id: "b", archiveSha256: "keep" })];
    const out = applyRecovery(mods, {
      recovered: [
        { kind: "recovered", mod: mods[0]!, archiveSha256: "new", downloadId: "d" },
      ],
      failed: [],
      unattemptable: [],
    });
    expect(out[0]!.archiveSha256).toBe("new");
    expect(out[1]!.archiveSha256).toBe("keep");
  });

  it("returns the same list untouched when nothing was recovered", () => {
    const mods = [mod({ id: "a" })];
    expect(applyRecovery(mods, { recovered: [], failed: [], unattemptable: [] })).toBe(mods);
  });
});
