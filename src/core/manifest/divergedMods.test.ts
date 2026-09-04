/**
 * The build already computed which mods have staged files that diverge from
 * their archives — `SelfCheckReport.unexplained` — and never told the curator.
 *
 * That number is the other half of the install-side fix. The installer now
 * declines to reinstall those mods, because a reinstall reproduces the
 * archive's bytes and the curator's copy is the one that moved. The curator
 * should know which mods that applies to, at the moment they can still do
 * something about it.
 */
import { describe, expect, it } from "vitest";

import { describeDivergedMods } from "./runSelfChecks";
import type { SelfCheckReport } from "./selfCheckMod";

const report = (
  modName: string,
  unexplained: number,
): SelfCheckReport =>
  ({
    modId: modName,
    modName,
    depth: "containment",
    notes: [],
    missing: [],
    unexplained,
    omissionLeads: [],
    stagedCount: 10,
    expectedCount: 10,
  }) as unknown as SelfCheckReport;

describe("telling the curator what diverged", () => {
  it("says nothing when nothing diverged", () => {
    // A build that reports a finding on every run teaches the curator to skim
    // past the run where it matters.
    expect(describeDivergedMods([])).toBeUndefined();
    expect(describeDivergedMods([report("Clean", 0)])).toBeUndefined();
  });

  it("counts mods AND files, because they answer different questions", () => {
    // "3 mods" is scope; "40 files" is size. One without the other leaves the
    // curator unable to tell a trimmed plugin from a repacked texture pack.
    const text = describeDivergedMods([
      report("A", 20),
      report("B", 15),
      report("C", 5),
    ]);
    expect(text).toContain("3 mod(s)");
    expect(text).toContain("40 staged file(s)");
  });

  it("names the worst offenders first", () => {
    // With ~100 diverged mods on a real collection, the three worth opening
    // are the ones with the most files, not the first three alphabetically.
    const text = describeDivergedMods([
      report("Small", 1),
      report("Huge", 500),
      report("Medium", 50),
    ])!;
    expect(text.indexOf('"Huge"')).toBeLessThan(text.indexOf('"Medium"'));
    expect(text).toContain('"Huge" (500)');
  });

  it("is ONE line however many mods diverged", () => {
    // Measured at roughly a ninth of a real 993-mod profile. A hundred
    // separate warnings would bury the omission findings, which are the ones
    // the curator must act on.
    const many = Array.from({ length: 120 }, (_, i) => report(`Mod${i}`, 3));
    const text = describeDivergedMods(many)!;
    expect(text.split("\n")).toHaveLength(1);
    expect(text).toContain("120 mod(s)");
  });

  it("reads as information, not as a fault", () => {
    // These files are usually exactly what the curator intended. Calling them
    // broken would send someone to 'fix' a deliberately repacked BA2.
    const text = describeDivergedMods([report("Repacked", 9)])!;
    expect(text).toMatch(/this is normal/i);
    expect(text).toMatch(/repack|clean plugins/i);
    expect(text).not.toMatch(/\b(corrupt|broken|damaged|error)\b/i);
  });

  it("says what it MEANS for the people installing it", () => {
    // The consequence is the point, and it is not guessable from "N files
    // differ". A curator who wants their repack shipped needs to know the
    // installer will take the user's own copy where it matches the archive.
    const text = describeDivergedMods([report("Repacked", 9)])!;
    expect(text).toMatch(/matches the archive/i);
    expect(text).toMatch(/accepts it rather than trying to reproduce yours/i);
  });

  it("does not promise acceptance for files the archive cannot produce", () => {
    // This line used to end "Event Horizon will accept whatever a clean
    // install produces for them rather than trying to reproduce your copy" —
    // stated flatly, for every diverged file. It is only true of files that
    // EXIST on both sides with different bytes, which judgeReinstall settles
    // against the archive.
    //
    // A file the curator ADDED is the opposite case: no user's archive can
    // produce it, so it fails, is reinstalled, fails identically and the mod
    // is recorded broken. Reading a blanket reassurance here is how a curator
    // ships that without knowing.
    const text = describeDivergedMods([report("Repacked", 9)])!;
    expect(text).toMatch(/files you added/i);
    expect(text).toMatch(/cannot produce/i);
  });
});
