/**
 * MICROSCOPE PASS 1 — the drift reference and the drift measurement must
 * describe THE SAME FILE SET.
 *
 * They did not. The receipt's hash is computed from the manifest's recorded
 * file list (`computeStagingSetHash(expectedFiles)` in runInstall), while the
 * check hashed EVERY file found in the staging folder. Any file on disk that
 * the manifest does not list makes the two hashes differ by construction.
 *
 * That is not a rare shape. verifyModInstall documents extra files as normal
 * and expected — "they happen legitimately when the user picks different FOMOD
 * options than the curator did" — and Vortex drops its own bookkeeping into
 * staging folders. So the first update would have reported drift on a large
 * fraction of mods that nobody had touched.
 *
 * Which is exactly the failure mode I warned about for the escalation ladder:
 * a warning that fires constantly teaches people to ignore the one that
 * matters. Built it myself two commits later.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findDriftedMods } from "./detectStagingDrift";
import { computeStagingSetHash } from "../manifest/stagingSetHash";
import type { EhcollStagingFile } from "../../types/ehcoll";

let dir: string;
let staging: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "eh-drift-"));
  staging = path.join(dir, "mod");
  fs.mkdirSync(staging, { recursive: true });
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const sha = (s: string): string =>
  require("crypto").createHash("sha256").update(s).digest("hex");

/** Write a file into staging and return the manifest entry describing it. */
const put = (rel: string, body: string): EhcollStagingFile => {
  const p = path.join(staging, ...rel.split("/"));
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return { path: rel, size: Buffer.byteLength(body), sha256: sha(body) };
};

const run = async (recordedFiles: EhcollStagingFile[], expectedHash: string) =>
  await findDriftedMods({
    candidates: [
      {
        compareKey: "nexus:1:2",
        name: "A Mod",
        vortexModId: "vid",
        expectedHash,
      },
    ],
    stagingRootFor: () => staging,
    manifestFilesFor: () => recordedFiles,
  });

describe("the reference and the measurement cover the same files", () => {
  it("does NOT report drift when an untracked extra file sits alongside", async () => {
    // The bug. The manifest lists one file; the folder also holds a FOMOD
    // alternative the user selected and Vortex's own marker. Nothing the
    // collection installed has changed.
    const tracked = put("Data/thing.esp", "the bytes we installed");
    put("Data/optional-variant.esp", "user picked a different FOMOD option");
    put("__folder_managed_by_vortex", "");

    const recorded = computeStagingSetHash([tracked])!;
    expect(await run([tracked], recorded)).toEqual([]);
  });

  it("still reports drift when a TRACKED file's bytes change", async () => {
    // The other half: ignoring untracked files must not become ignoring
    // everything. This is the case the feature exists for.
    const tracked = put("Data/thing.esp", "original bytes");
    const recorded = computeStagingSetHash([tracked])!;

    fs.writeFileSync(
      path.join(staging, "Data", "thing.esp"),
      "somebody edited this",
    );

    const found = await run([tracked], recorded);
    expect(found.map((f) => f.name)).toEqual(["A Mod"]);
  });

  it("reports drift when a TRACKED file is deleted", async () => {
    const tracked = put("Data/thing.esp", "original bytes");
    const other = put("Data/keep.esp", "untouched");
    const recorded = computeStagingSetHash([tracked, other])!;

    fs.rmSync(path.join(staging, "Data", "thing.esp"));

    const found = await run([tracked, other], recorded);
    expect(found).toHaveLength(1);
  });

  it("does not report drift when nothing changed at all", async () => {
    const a = put("a.esp", "aaa");
    const b = put("b/c.dds", "bbb");
    const recorded = computeStagingSetHash([a, b])!;
    expect(await run([a, b], recorded)).toEqual([]);
  });

  it("says nothing when the folder is gone — we failed to look, not the files", async () => {
    const tracked = put("a.esp", "aaa");
    const recorded = computeStagingSetHash([tracked])!;
    fs.rmSync(staging, { recursive: true, force: true });
    expect(await run([tracked], recorded)).toEqual([]);
  });
});
