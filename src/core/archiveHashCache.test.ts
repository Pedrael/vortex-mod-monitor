/**
 * The rule this file exists to defend: the cache FILLS GAPS, it never overrides
 * bytes. A hash computed from a real file this run always wins, so a stale or
 * hand-edited entry cannot contradict what is on disk.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ARCHIVE_HASH_CACHE_FILE,
  applyCachedHashes,
  archiveHashCacheKey,
  emptyArchiveHashCache,
  loadArchiveHashCache,
  rememberArchiveHash,
  saveArchiveHashCache,
} from "./archiveHashCache";
import type { AuditorMod } from "./getModsListForProfile";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

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

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "eh-hashcache-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("applyCachedHashes", () => {
  it("NEVER overrides a hash computed from a real file", () => {
    const cache = rememberArchiveHash(emptyArchiveHashCache(), {
      nexusModId: 1, nexusFileId: 2, sha256: SHA_B, at: "now",
    });
    const { mods, filled } = applyCachedHashes(
      [mod({ id: "m", nexusModId: 1, nexusFileId: 2, archiveSha256: SHA_A })],
      cache,
    );
    expect(mods[0]!.archiveSha256).toBe(SHA_A);
    expect(filled).toBe(0);
  });

  it("fills a mod whose archive is gone", () => {
    const cache = rememberArchiveHash(emptyArchiveHashCache(), {
      nexusModId: 1, nexusFileId: 2, sha256: SHA_A, at: "now",
    });
    const { mods, filled } = applyCachedHashes(
      [mod({ id: "m", nexusModId: 1, nexusFileId: 2 })],
      cache,
    );
    expect(mods[0]!.archiveSha256).toBe(SHA_A);
    expect(filled).toBe(1);
  });

  it("does not match a different file of the same mod", () => {
    // A new version is a new fileId and genuinely different bytes.
    const cache = rememberArchiveHash(emptyArchiveHashCache(), {
      nexusModId: 1, nexusFileId: 2, sha256: SHA_A, at: "now",
    });
    const { filled } = applyCachedHashes(
      [mod({ id: "m", nexusModId: 1, nexusFileId: 99 })],
      cache,
    );
    expect(filled).toBe(0);
  });

  it("ignores external mods — a filename is not an identity", () => {
    const cache = rememberArchiveHash(emptyArchiveHashCache(), {
      nexusModId: 1, nexusFileId: 2, sha256: SHA_A, at: "now",
    });
    const { filled } = applyCachedHashes([mod({ id: "ext" })], cache);
    expect(filled).toBe(0);
  });

  it("returns the original array when it changes nothing", () => {
    const mods = [mod({ id: "m" })];
    expect(applyCachedHashes(mods, emptyArchiveHashCache()).mods).toBe(mods);
  });
});

describe("rememberArchiveHash", () => {
  it("refuses anything that is not a sha256", () => {
    const cache = rememberArchiveHash(emptyArchiveHashCache(), {
      nexusModId: 1, nexusFileId: 2, sha256: "not-a-hash", at: "now",
    });
    expect(cache.entries).toEqual({});
  });

  it("keys on the identity the manifest uses", () => {
    const cache = rememberArchiveHash(emptyArchiveHashCache(), {
      nexusModId: "77337", nexusFileId: 42, sha256: SHA_A, size: 10, at: "t",
    });
    expect(cache.entries[archiveHashCacheKey(77337, "42")]!.sha256).toBe(SHA_A);
  });
});

describe("persistence", () => {
  it("round-trips", async () => {
    const cache = rememberArchiveHash(emptyArchiveHashCache(), {
      nexusModId: 1, nexusFileId: 2, sha256: SHA_A, size: 5, at: "t",
    });
    await saveArchiveHashCache(dir, cache);
    await expect(loadArchiveHashCache(dir)).resolves.toEqual(cache);
  });

  it("treats a missing file as an empty cache, not an error", async () => {
    await expect(loadArchiveHashCache(dir)).resolves.toEqual(emptyArchiveHashCache());
  });

  it("survives a corrupt file rather than failing the build", async () => {
    fs.writeFileSync(path.join(dir, ARCHIVE_HASH_CACHE_FILE), "{ not json");
    await expect(loadArchiveHashCache(dir)).resolves.toEqual(emptyArchiveHashCache());
  });

  it("drops only the bad entries, keeping the rest", async () => {
    fs.writeFileSync(
      path.join(dir, ARCHIVE_HASH_CACHE_FILE),
      JSON.stringify({
        schemaVersion: 1,
        entries: {
          good: { sha256: SHA_A, recoveredAt: "t" },
          truncated: { sha256: "abc" },
          empty: {},
        },
      }),
    );
    const loaded = await loadArchiveHashCache(dir);
    expect(Object.keys(loaded.entries)).toEqual(["good"]);
  });

  it("does not leave a truncated cache if a write is interrupted", async () => {
    // Written to a temp name and renamed, so readers never see a partial file.
    await saveArchiveHashCache(dir, emptyArchiveHashCache());
    expect(fs.readdirSync(dir)).toEqual([ARCHIVE_HASH_CACHE_FILE]);
  });
});
