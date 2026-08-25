/**
 * A profile that has been curated for a while accumulates mod rules pointing at
 * mods it no longer has — a version upgraded past, a mod removed. On a real
 * 955-mod profile that produced 108 near-identical warnings, which is not a
 * report so much as a place for the five that mattered to hide.
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
    ...over,
  }) as AuditorMod;

const rule = (targetId: string) =>
  ({ type: "after", reference: { id: targetId } }) as never;

/** Minimal valid input; only the rule behaviour is under test here. */
function build(mods: AuditorMod[]): { warnings: string[] } {
  return buildManifest({
    snapshot: { gameId: "fallout4", mods } as never,
    package: {
      id: "00000000-0000-4000-8000-000000000000",
      name: "t",
      version: "1.0.0",
      author: "a",
    },
    game: { version: "1.10.163" },
    vortex: { version: "2.6.0", deploymentMethod: "hardlink" },
  } as never);
}

describe("mod rules referencing mods that are not here", () => {
  it("reports them ONCE, naming the missing targets", () => {
    const mods = [
      mod({
        id: "a", nexusModId: 1, nexusFileId: 1, archiveSha256: "a".repeat(64),
        rules: [rule("Gone v1.08"), rule("Gone v1.10"), rule("AlsoGone")],
      }),
      mod({
        id: "b", nexusModId: 2, nexusFileId: 2, archiveSha256: "b".repeat(64),
        rules: [rule("Gone v1.08")],
      }),
    ];
    const { warnings } = build(mods);

    const dropped = warnings.filter((w) => w.includes("mod rule(s) reference"));
    expect(dropped).toHaveLength(1);
    // Four rules across two owners, but only three distinct missing mods —
    // naming the TARGET is the actionable half.
    expect(dropped[0]).toContain("4 mod rule(s) reference 3 mod(s)");
    expect(dropped[0]).toContain('"Gone v1.08"');
    expect(dropped[0]).toContain("dropping it is correct");
  });

  it("says nothing when every rule resolves", () => {
    const mods = [
      mod({
        id: "a", nexusModId: 1, nexusFileId: 1, archiveSha256: "a".repeat(64),
        rules: [rule("b")],
      }),
      mod({ id: "b", nexusModId: 2, nexusFileId: 2, archiveSha256: "b".repeat(64) }),
    ];
    const { warnings } = build(mods);
    expect(warnings.filter((w) => w.includes("mod rule(s) reference"))).toEqual([]);
  });

  it("keeps the list readable when a great many mods are missing", () => {
    const rules = Array.from({ length: 40 }, (_, i) => rule(`Missing ${i}`));
    const { warnings } = build([
      mod({
        id: "a", nexusModId: 1, nexusFileId: 1, archiveSha256: "a".repeat(64),
        rules,
      }),
    ]);
    const dropped = warnings.find((w) => w.includes("mod rule(s) reference"))!;
    expect(dropped).toContain("40 mod rule(s) reference 40 mod(s)");
    expect(dropped).toContain("and 34 more");
  });
});
