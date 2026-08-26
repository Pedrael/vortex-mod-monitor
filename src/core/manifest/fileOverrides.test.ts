/**
 * `fileOverrides` recorded the deployment winner for every deployed file.
 * Measured on the curator's real 954-mod collection: 50,444 entries, 6.6MB,
 * 31% of a 21MB manifest — and 46,062 of them named the winner of a file only
 * ONE mod ships, which the manifest already says in that mod's `stagingFiles`.
 *
 * A conflict is worth recording. Restating the manifest to itself is not.
 */
import { describe, expect, it } from "vitest";

import { buildManifest } from "./buildManifest";
import type { AuditorMod } from "../getModsListForProfile";

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
    nexusModId: 1,
    nexusFileId: 1,
    archiveSha256: over.id.padEnd(64, "0"),
    ...over,
  }) as AuditorMod;

const staged = (...paths: string[]) => paths.map((p) => ({ path: p, size: 1 }));

/** One deployment manifest: which mod folder won each path. */
const deployed = (files: Array<[string, string]>) => [
  {
    modType: "",
    files: files.map(([relPath, source]) => ({ relPath, source })),
  },
];

function build(mods: AuditorMod[], files: Array<[string, string]>) {
  return buildManifest({
    snapshot: {
      gameId: "fallout4",
      mods,
      deploymentManifests: deployed(files),
    } as never,
    package: {
      id: "00000000-0000-4000-8000-000000000000",
      name: "t",
      version: "1.0.0",
      author: "a",
      verificationLevel: "thorough",
    },
    game: { version: "1.10.163" },
    vortex: { version: "2.6.0", deploymentMethod: "hardlink" },
  } as never);
}

describe("fileOverrides", () => {
  it("records a file two mods both ship — the winner is not derivable", () => {
    const { manifest } = build(
      [
        mod({ id: "winner", stagingFiles: staged("Data/shared.dds") as never }),
        mod({ id: "loser", nexusFileId: 2, stagingFiles: staged("Data/shared.dds") as never }),
      ],
      [["Data/shared.dds", "winner"]],
    );
    expect(manifest.fileOverrides).toHaveLength(1);
    expect(manifest.fileOverrides[0]!.filePath).toBe("Data/shared.dds");
    expect(manifest.fileOverrides[0]!.winningMod).toBe(
      manifest.mods.find((m) => m.name === "winner")!.compareKey,
    );
  });

  it("does NOT record a file only one mod ships", () => {
    const { manifest } = build(
      [mod({ id: "only", stagingFiles: staged("Data/solo.esp") as never })],
      [["Data/solo.esp", "only"]],
    );
    expect(manifest.fileOverrides).toEqual([]);
  });

  it("keeps an override when nothing captured who ships the path", () => {
    // Verification level `none` leaves mods with no stagingFiles. Then the
    // winner is not derivable, and dropping the record would lose the only
    // evidence of who won. Unknown is a reason to keep, not to elide.
    const { manifest } = build(
      [mod({ id: "opaque" })],
      [["Data/mystery.esp", "opaque"]],
    );
    expect(manifest.fileOverrides).toHaveLength(1);
  });

  it("says how many it left out, and why nothing was lost", () => {
    const { warnings } = build(
      [
        mod({ id: "a", stagingFiles: staged("Data/a.esp", "Data/b.esp") as never }),
        mod({ id: "b", nexusFileId: 2, stagingFiles: staged("Data/c.esp") as never }),
      ],
      [
        ["Data/a.esp", "a"],
        ["Data/b.esp", "a"],
        ["Data/c.esp", "b"],
      ],
    );
    const line = warnings.find((w) => w.includes("shipped")) ?? "";
    expect(line).toMatch(/3 file\(s\) are shipped by exactly one mod/);
    expect(line).toMatch(/Nothing is lost/);
  });

  it("counts a mod once for a path, so it cannot contest itself", () => {
    // A duplicate entry within one mod's file list must not read as a
    // conflict between two mods.
    const { manifest } = build(
      [
        mod({
          id: "dup",
          stagingFiles: [
            { path: "Data/x.esp", size: 1 },
            { path: "Data/x.esp", size: 1 },
          ] as never,
        }),
      ],
      [["Data/x.esp", "dup"]],
    );
    expect(manifest.fileOverrides).toEqual([]);
  });
});
