/**
 * The decision a curator makes about their own edits, and the guard rails on it.
 *
 * The dangerous answer here is not the wrong one, it is the FAST one. "These
 * are all mine" is true for most of the list, one click away, and when wrong
 * it produces a collection that installs cleanly for every user while silently
 * leaving out the files the curator added. Nothing errors. Nothing warns. It
 * reproduces the curator's game except for the parts that made it theirs.
 *
 * So two things get tested: that each answer writes the override that actually
 * makes it true, and that the wording tells the curator what they are doing to
 * somebody else rather than which flag they are setting.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  describeChoice,
  describeDecisionIntro,
  overrideForChoice,
} from "./postProcessingDecision";

describe("what each answer actually writes", () => {
  it("declaring records only the declaration", () => {
    expect(overrideForChoice("declare", { isNexusMod: true })).toEqual({
      postProcessed: true,
    });
  });

  it("bundling a Nexus mod also marks it external", () => {
    // Bundling is gated on `shipsAsExternal`, and a Nexus mod is not external
    // until `treatAsExternal` says so. Setting `bundled` alone would be a
    // decision the build silently ignores — which this area has already been
    // bitten by once, when treatAsExternal reached the manifest and neither of
    // the two bundling gates had heard of it.
    expect(overrideForChoice("bundle", { isNexusMod: true })).toEqual({
      bundled: true,
      treatAsExternal: true,
    });
  });

  it("bundling an already-external mod does not need the flag", () => {
    expect(overrideForChoice("bundle", { isNexusMod: false })).toEqual({
      bundled: true,
    });
  });

  it("never writes both answers at once", () => {
    // They are opposites: one withholds the files, the other ships them.
    for (const isNexusMod of [true, false]) {
      const declare = overrideForChoice("declare", { isNexusMod });
      const bundle = overrideForChoice("bundle", { isNexusMod });
      expect(declare.bundled).toBeUndefined();
      expect(bundle.postProcessed).toBeUndefined();
    }
  });
});

describe("the wording a curator decides from", () => {
  it("describes each answer by what users end up with", () => {
    // Not "mark as post-processed" — that describes a checkbox. A curator can
    // have an opinion about what a user receives; they cannot have one about a
    // field name.
    const declare = describeChoice("declare", 1608);
    expect(declare.consequence).toMatch(/users install/i);
    expect(declare.consequence).toContain("1608 files");

    const bundle = describeChoice("bundle", 1608);
    expect(bundle.consequence).toMatch(/users get/i);
  });

  it("gives concrete examples of when each is right", () => {
    // "Is this deliberate?" is answerable with yes by anyone. "Is this xLODGen
    // output, or a patch you dropped in?" is not.
    expect(describeChoice("declare", 3).consequence).toMatch(
      /xlodgen|dyndolod|repack|clean/i,
    );
    expect(describeChoice("bundle", 3).consequence).toMatch(/patch|needs/i);
  });

  it("says bundling costs download size, so the choice is informed", () => {
    expect(describeChoice("bundle", 3).consequence).toMatch(/bigger|size/i);
  });

  it("singularises, because a report that says '1 files' gets trusted less", () => {
    expect(describeChoice("declare", 1).consequence).toContain("your 1 file.");
  });
});

describe("the intro that frames the question", () => {
  it("asks about users, not about intent", () => {
    // The first framing was "was this deliberate?", which is answerable with
    // yes for nearly every mod on the list and changes nothing.
    const intro = describeDecisionIntro(3);
    expect(intro.question).toMatch(/installing this collection need them/i);
    expect(intro.question).not.toMatch(/deliberate|intend/i);
  });

  it("states the cost of leaving one unanswered", () => {
    expect(describeDecisionIntro(3).ifIgnored).toMatch(/recorded as broken/i);
  });

  it("warns specifically against answering them all the same way", () => {
    // The load-bearing sentence. Without it the panel is a list of buttons
    // whose fastest path is also its worst outcome.
    const c = describeDecisionIntro(9).caution;
    expect(c).toMatch(/one at a time|look at the file/i);
    expect(c).toMatch(/silently/i);
  });

  it("counts mods correctly in the singular", () => {
    expect(describeDecisionIntro(1).title).toBe("1 mod needs a decision");
    expect(describeDecisionIntro(4).title).toBe("4 mods need a decision");
  });
});

describe("the panel offers no way to answer without looking", () => {
  // A unit test cannot see a rendered page, so this reads the source for the
  // affordances that would undo the design.
  const panel = readFileSync(join(__dirname, "BuildPage.tsx"), "utf8");
  const start = panel.indexOf("function PostProcessingDecisions");
  const end = panel.indexOf("function BuildingPanel");
  const body = panel.slice(start, end);

  it("finds the component it claims to check", () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
  });

  it("has no bulk action", () => {
    // "Mark all as mine" is one line of code and it removes the only thing
    // making this decision real.
    expect(body).not.toMatch(/select all|mark all|applyToAll|apply all/i);
  });

  it("shows the offending paths rather than only a count", () => {
    expect(body).toContain("c.examples.map");
  });

  it("preselects nothing", () => {
    expect(body).not.toMatch(/defaultChecked|defaultValue/);
  });
});
