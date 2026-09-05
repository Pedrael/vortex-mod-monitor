/**
 * The check the curator asked for, on the mods that actually have it.
 *
 * Only ~17% of archives carry a FOMOD script. An earlier version of this
 * returned "cannot-check" for everything else — the verification pointed at
 * five mods in six and shrugging at all of them.
 *
 * These tests drive the decision layer directly, with a self-check report
 * standing in for the archive work, because the branch that matters is which
 * evidence gets believed.
 */
import { describe, expect, it } from "vitest";

import { verdictFromReport } from "./verifyAfterUpdate";
import type { SelfCheckReport } from "../manifest/selfCheckMod";

const report = (over: Partial<SelfCheckReport> = {}): SelfCheckReport =>
  ({
    modId: "m",
    modName: "A Mod",
    depth: "containment",
    notes: [],
    missing: [],
    unexplained: 0,
    unexplainedExamples: [],
    omissionLeads: [],
    stagedCount: 10,
    expectedCount: 0,
    ...over,
  }) as unknown as SelfCheckReport;

const lead = (path: string, confidence: "high" | "medium") => ({
  path,
  dir: "Data",
  dirTotal: 10,
  dirMissing: 1,
  confidence,
  reason: "hole in an otherwise-present folder",
});

describe("with a FOMOD script to replay", () => {
  it("reports the files the expected set says are absent", () => {
    expect(
      verdictFromReport(report({ depth: "replayed", missing: ["Data/x.esp"] })),
    ).toEqual({ kind: "missing", missing: ["Data/x.esp"] });
  });

  it("passes a replay with nothing missing", () => {
    expect(verdictFromReport(report({ depth: "replayed" }))).toEqual({ kind: "ok" });
  });
});

describe("without one, which is five mods in six", () => {
  it("treats a HIGH-confidence omission lead as dropped files", () => {
    // A hole in an otherwise-present directory is the lost-write signature.
    expect(
      verdictFromReport(
        report({ omissionLeads: [lead("Data/textures/a.dds", "high")] as never }),
      ),
    ).toEqual({ kind: "missing", missing: ["Data/textures/a.dds"] });
  });

  it("does NOT fail a mod on a medium lead alone", () => {
    // Medium is a wholly-absent folder — an unselected option or docs, not a
    // lost write. Failing on it would cry wolf on nearly every FOMOD mod.
    expect(
      verdictFromReport(report({ omissionLeads: [lead("docs/readme.txt", "medium")] as never })),
    ).toEqual({ kind: "ok" });
  });

  it("passes a clean containment check instead of shrugging at it", () => {
    // The regression this guards: returning cannot-check here made the whole
    // feature inert for ~83% of mods.
    expect(verdictFromReport(report())).toEqual({ kind: "ok" });
  });
});

describe("when there is genuinely nothing to compare", () => {
  it("says so rather than passing the mod", () => {
    const v = verdictFromReport(
      report({ depth: "skipped", notes: ["archive missing from disk"] }),
    );
    expect(v).toEqual({ kind: "cannot-check", why: "archive missing from disk" });
  });

  it("never reports an unchecked mod as ok", () => {
    expect(verdictFromReport(report({ depth: "skipped" })).kind).toBe("cannot-check");
  });
});
