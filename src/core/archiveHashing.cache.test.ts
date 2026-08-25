/**
 * Does the hashing pass ACTUALLY consult the cache?
 *
 * It did not, for one deploy: the edit that added the lookup never matched the
 * file's whitespace and silently did nothing, while the option was still
 * destructured and still passed. Everything typechecked, every unit test on the
 * cache module passed — because they tested the cache, and nothing tested the
 * caller. The build then re-hashed 955 archives in 17 minutes and reported
 * "reusedFromCache: 955".
 *
 * So this exercises `enrichModsWithArchiveHashes` itself, against real files on
 * disk, and asserts the second pass does not read them again.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __testPaths } from "../../test/stubs/vortex-api";
import { enrichModsWithArchiveHashes } from "./archiveHashing";
import {
  emptyArchiveHashCache,
  makeHashLookup,
  mergeHashes,
} from "./archiveHashCache";
import type { AuditorMod } from "./getModsListForProfile";

const mod = (id: string, archiveId: string): AuditorMod =>
  ({
    id,
    name: id,
    archiveId,
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
  }) as AuditorMod;

let tmp: string;

/** Vortex state whose download records point at the temp files. */
function stateFor(files: Record<string, string>): any {
  return {
    persistent: {
      downloads: {
        files: Object.fromEntries(
          Object.entries(files).map(([archiveId, name]) => [
            archiveId,
            { localPath: name },
          ]),
        ),
      },
    },
  };
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eh-hashpass-"));
  __testPaths.downloadPath = tmp;
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  __testPaths.downloadPath = "/stub/downloads";
});

describe("enrichModsWithArchiveHashes + hash cache", () => {
  it("records a hash on the first pass and REUSES it on the second", async () => {
    fs.writeFileSync(path.join(tmp, "a.7z"), "alpha");
    fs.writeFileSync(path.join(tmp, "b.7z"), "beta");
    const state = stateFor({ arcA: "a.7z", arcB: "b.7z" });
    const mods = [mod("a", "arcA"), mod("b", "arcB")];

    const first = makeHashLookup(emptyArchiveHashCache());
    const pass1 = await enrichModsWithArchiveHashes(state, "fallout4", mods, {
      hashCache: first.lookup,
    });
    expect(first.hits).toBe(0);
    expect(first.added.size).toBe(2);

    const cache = mergeHashes(emptyArchiveHashCache(), first.added, "t");
    const second = makeHashLookup(cache);
    const pass2 = await enrichModsWithArchiveHashes(state, "fallout4", mods, {
      hashCache: second.lookup,
    });

    // The point: nothing was hashed again, and the answers are identical.
    expect(second.hits).toBe(2);
    expect(second.added.size).toBe(0);
    expect(pass2.map((m) => m.archiveSha256)).toEqual(
      pass1.map((m) => m.archiveSha256),
    );
  });

  it("re-hashes a file whose contents changed", async () => {
    const file = path.join(tmp, "a.7z");
    fs.writeFileSync(file, "alpha");
    const state = stateFor({ arcA: "a.7z" });
    const mods = [mod("a", "arcA")];

    const first = makeHashLookup(emptyArchiveHashCache());
    const [before] = await enrichModsWithArchiveHashes(state, "fallout4", mods, {
      hashCache: first.lookup,
    });

    // Different size AND a later mtime — the fingerprint must miss.
    fs.writeFileSync(file, "alpha-but-longer");
    fs.utimesSync(file, new Date(), new Date(Date.now() + 5000));

    const cache = mergeHashes(emptyArchiveHashCache(), first.added, "t");
    const second = makeHashLookup(cache);
    const [after] = await enrichModsWithArchiveHashes(state, "fallout4", mods, {
      hashCache: second.lookup,
    });

    expect(second.hits).toBe(0);
    expect(after!.archiveSha256).not.toBe(before!.archiveSha256);
  });

  it("behaves exactly as before when no cache is supplied", async () => {
    // Five of the six callers pass nothing; they must be untouched.
    fs.writeFileSync(path.join(tmp, "a.7z"), "alpha");
    const state = stateFor({ arcA: "a.7z" });
    const out = await enrichModsWithArchiveHashes(state, "fallout4", [
      mod("a", "arcA"),
    ]);
    expect(out[0]!.archiveSha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
