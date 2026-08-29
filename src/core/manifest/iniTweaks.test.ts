/**
 * Vortex INI tweaks are recorded per mod and applied by nothing on the install
 * side: `manifest.iniTweaks` is a v1 placeholder and no installer code reads
 * `state.enabledINITweaks`. The .ini file itself ships like any other staged
 * file, so a collection with an enabled tweak looks complete while the setting
 * silently never switches on.
 *
 * Latent on the profile that prompted this — three mods carry an `INI Tweaks`
 * folder and none are enabled — which is exactly why it needs a test rather
 * than a note.
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
    archiveSha256: "a".repeat(64),
    ...over,
  }) as AuditorMod;

function build(mods: AuditorMod[]): { warnings: string[]; manifest: unknown } {
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
  } as never) as never;
}

const iniWarnings = (warnings: string[]): string[] =>
  warnings.filter((w) => w.includes("INI tweak"));

const fomodWarnings = (warnings: string[]): string[] =>
  warnings.filter((w) => w.includes("FOMOD"));

describe("enabled INI tweaks", () => {
  it("warns that they are recorded but will not be applied", () => {
    const { warnings } = build([
      mod({
        id: "settings",
        name: "Ivy'sPantiesSettings",
        nexusModId: undefined,
        nexusFileId: undefined,
        enabledINITweaks: ["Fallout4Custom-Ivy-PC-Tuning.ini"],
      }),
    ]);
    const line = iniWarnings(warnings).join(" ");
    expect(line).toMatch(/1 INI tweak/);
    expect(line).toMatch(/Ivy'sPantiesSettings/);
    expect(line).toMatch(/does not apply INI tweaks yet/);
    // The curator needs the workaround, not just the bad news.
    expect(line).toMatch(/by hand in Vortex/);
  });

  it("counts tweaks across mods, not just the mods", () => {
    const { warnings } = build([
      // Distinct bytes, or the two collide on identity and the build refuses
      // them before it ever reaches the tweak check.
      mod({ id: "a", archiveSha256: "a".repeat(64), enabledINITweaks: ["one.ini", "two.ini"] }),
      mod({ id: "b", archiveSha256: "b".repeat(64), enabledINITweaks: ["three.ini"] }),
    ]);
    const line = iniWarnings(warnings).join(" ");
    expect(line).toMatch(/3 INI tweak\(s\) are enabled across 2 mod\(s\)/);
  });

  it("says nothing when no tweak is enabled", () => {
    // The common case, and the one that must stay quiet: a mod can carry an
    // INI Tweaks folder without any of it being switched on.
    const { warnings } = build([mod({ id: "a", enabledINITweaks: [] })]);
    expect(iniWarnings(warnings)).toEqual([]);
  });
});

describe("recorded FOMOD choices", () => {
  // REPLAY EXISTS. `choicesFor` reads `install.fomodSelections` and
  // `runInstall` passes the result to both install paths, so the curator's
  // answers are sent to Vortex instead of the user being asked.
  //
  // These tests previously asserted the opposite — that the options "will not
  // be replayed" — and stayed green for the whole life of the replay feature,
  // because they pinned the MESSAGE rather than the behaviour. Measured on the
  // real 963-mod build: 112 of 115 replay, and the warning told the curator
  // that none did, sending them to write instructions for 115 mods that need
  // none.
  //
  // A step whose groups are all empty is the one genuine exception:
  // `choicesFor` returns undefined there rather than claim a choice the
  // curator never made, so those mods really do fall back to asking.
  const unanswered = (id: string, count: number): AuditorMod =>
    mod({
      id,
      archiveSha256: id.padEnd(64, "0"),
      fomodSelections: Array.from({ length: count }, (_, i) => ({
        name: `step${i}`,
        groups: [],
      })) as never,
    });

  const answered = (id: string): AuditorMod =>
    mod({
      id,
      archiveSha256: id.padEnd(64, "0"),
      fomodSelections: [
        {
          name: "Choose Options",
          groups: [
            { name: "Patches", choices: [{ name: "AFT Plus Ivy Patch", idx: 2 }] },
          ],
        },
      ] as never,
    });

  it("says NOTHING about mods whose choices will be replayed", () => {
    // The case that matters most, and the one the old tests could not express.
    // A curator told to write instructions for a mod that already replays
    // correctly is being sent to do pointless work.
    const { warnings } = build([answered("aft")]);
    expect(fomodWarnings(warnings)).toEqual([]);
  });

  it("warns only about steps with no option selected", () => {
    const { warnings } = build([unanswered("aft", 2)]);
    const line = fomodWarnings(warnings).join(" ");
    expect(line).toMatch(/1 mod\(s\) recorded FOMOD steps with no option selected/);
    expect(line).toMatch(/say so in their instructions/);
    // And it must NOT resurrect the old claim.
    expect(line).not.toMatch(/cannot replay/i);
  });

  it("tells the curator how many DID replay, so the warning is not alarming", () => {
    // "3 mods need attention" reads very differently from "your FOMOD answers
    // are lost", and only one of them is true.
    const { warnings } = build([unanswered("a", 1), answered("b"), answered("c")]);
    const line = fomodWarnings(warnings).join(" ");
    expect(line).toMatch(/1 mod\(s\) recorded FOMOD steps/);
    expect(line).toMatch(/other 2 mod\(s\).*replayed automatically/);
  });

  it("counts mods, not selections — one dialog per mod is what a user faces", () => {
    const { warnings } = build([unanswered("a", 8), unanswered("b", 1)]);
    expect(fomodWarnings(warnings).join(" ")).toMatch(/2 mod\(s\)/);
  });

  it("stays quiet for a collection with no recorded choices", () => {
    // Most mods report installerType "fomod" without a script or a choice.
    const { warnings } = build([mod({ id: "plain", fomodSelections: [] })]);
    expect(fomodWarnings(warnings)).toEqual([]);
  });
});
