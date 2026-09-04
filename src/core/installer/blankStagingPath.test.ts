/**
 * A blank `installationPath` is not a folder.
 *
 * Vortex stores a mod at `<installRoot>/<mod.installationPath>`, and six places
 * in this codebase build that path by hand. Three guarded the string's LENGTH;
 * three checked only `typeof === "string"`.
 *
 * `path.join(installRoot, "")` returns installRoot itself. So on the permissive
 * three, a mod whose installationPath is blank pointed at the whole staging
 * folder — every mod in the collection — and the verifier would then compare
 * that entire tree against one mod's expected file list. Nothing would throw:
 * it would read hundreds of thousands of files, find every expected one
 * present, and report a mountain of `extraFiles`.
 *
 * The guard is one `.length` check. It is here as a test because removing it
 * from `verifyModInstall` broke none of the 432 installer tests — the hardening
 * was real and completely unprotected.
 */
import { describe, expect, it } from "vitest";

import { verifyModInstall } from "./verifyModInstall";
import { __testPaths } from "../../../test/stubs/vortex-api";

const api = (installationPath: unknown): never =>
  ({
    getState: () => ({
      persistent: { mods: { skyrimse: { "mod-1": { installationPath } } } },
    }),
  }) as never;

const run = async (installationPath: unknown): Promise<{ kind: string }> => {
  __testPaths.installPath = "/staging";
  return (await verifyModInstall({
    api: api(installationPath),
    gameId: "skyrimse",
    vortexModId: "mod-1",
    expectedFiles: [{ path: "meshes/a.nif", size: 1 }],
    level: "fast",
  } as never)) as { kind: string };
};

describe("a mod whose staging folder is unnamed", () => {
  it("skips on a blank installationPath rather than walking the whole root", async () => {
    expect((await run("")).kind).toBe("skip");
  });

  it("skips when the field is missing entirely", async () => {
    expect((await run(undefined)).kind).toBe("skip");
  });

  it("skips when it is not a string", async () => {
    expect((await run(42)).kind).toBe("skip");
  });
});

describe("no site turns installationPath into a path on a typeof check alone", () => {
  // Six hand-rolled joins, no shared resolver. Rather than guess at each
  // site's guard shape — bundleFromStaging copies it to a local first, so a
  // naive scan for "installationPath.length" reports it as an offender — this
  // looks for the BAD pattern: a typeof test with no length check anywhere
  // near it, which is exactly what the three permissive sites had.
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");

  const SITES = [
    "installer/verifyModInstall.ts",
    "installer/runInstall.ts",
    "manifest/bundleFromStaging.ts",
    "manifest/captureStagingFiles.ts",
    "resolver/enrichStagingSetHashes.ts",
  ];

  it("pairs every typeof guard with a length guard", () => {
    const offenders: string[] = [];
    for (const rel of SITES) {
      const src = readFileSync(join(__dirname, "..", rel), "utf8");
      const rx = /typeof\s+\w+[?]?\.installationPath\s*[!=]==\s*"string"/g;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(src)) !== null) {
        // 200 chars is enough to cover the rest of the condition and the
        // join that follows it.
        const window = src.slice(m.index, m.index + 200);
        if (!window.includes(".length")) offenders.push(`${rel}:${m.index}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
