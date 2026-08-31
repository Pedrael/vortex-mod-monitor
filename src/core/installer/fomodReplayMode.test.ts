/**
 * The question asked before an install, and the promise its wording makes.
 *
 * These are copy tests, which is unusual and deliberate. The wording IS the
 * feature here: the whole reason this question exists rather than a constant is
 * that one of the answers has a consequence the user cannot deduce — a later
 * heal restores the curator's answer over theirs. Copy that quietly loses that
 * sentence turns an informed choice back into a trap, and nothing else in the
 * suite would notice.
 */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_FOMOD_REPLAY_MODE,
  describeChosenMode,
  describeFomodModes,
  isUnattended,
} from "./fomodReplayMode";

describe("isUnattended", () => {
  it("maps the two modes onto Vortex's flag", () => {
    // Vortex bypasses its FOMOD dialog only on `unattended === true`, so this
    // mapping is the entire mechanism. Inverting it would show every dialog to
    // someone who asked for none, and vice versa.
    expect(isUnattended("silent")).toBe(true);
    expect(isUnattended("supervised")).toBe(false);
  });
});

describe("describeFomodModes", () => {
  it("offers exactly the two modes, silent recommended", () => {
    const opts = describeFomodModes(114);
    expect(opts.map((o) => o.mode)).toEqual(["silent", "supervised"]);
    expect(opts.filter((o) => o.recommended)).toHaveLength(1);
    expect(opts[0]!.recommended).toBe(true);
  });

  it("warns that a changed answer breaks the curator's guarantee", () => {
    const supervised = describeFomodModes(114).find(
      (o) => o.mode === "supervised",
    );
    expect(supervised?.caution).toBeDefined();
    expect(supervised!.caution!.toLowerCase()).toContain("curator");
  });

  it("warns that healing will restore the curator's answer", () => {
    // The non-obvious half, and the reason the question is worth asking.
    // The Doctor diagnoses against the receipt but repairs from the
    // collection, so a deviation survives until the first heal and then
    // silently does not. Dropping this sentence is the regression.
    const supervised = describeFomodModes(114).find(
      (o) => o.mode === "supervised",
    );
    const caution = supervised!.caution!.toLowerCase();
    expect(caution).toContain("healing");
    expect(caution).toMatch(/restore|undo/);
  });

  it("never puts a caution on the silent option", () => {
    // Silent reproduces the curator exactly. A warning there would be noise
    // on the option that has nothing to warn about.
    const silent = describeFomodModes(114).find((o) => o.mode === "silent");
    expect(silent?.caution).toBeUndefined();
  });

  it("tells the user how many dialogs they are signing up for", () => {
    const opts = describeFomodModes(114);
    expect(JSON.stringify(opts)).toContain("114");
  });

  it("stays grammatical for a single installer", () => {
    const opts = describeFomodModes(1);
    const text = JSON.stringify(opts);
    expect(text).toContain("1 mod");
    expect(text).not.toContain("1 mods");
    expect(text).not.toContain("1 dialogs");
  });

  it("says something sane when nothing has choices", () => {
    // The UI hides the question entirely at zero, but the copy must not read
    // as "0 mods have installers" if that ever changes.
    const opts = describeFomodModes(0);
    expect(JSON.stringify(opts)).not.toContain("0 mod");
    expect(opts).toHaveLength(2);
  });
});

describe("describeChosenMode", () => {
  it("records that a supervised install may differ, and why", () => {
    const line = describeChosenMode("supervised", 114).toLowerCase();
    expect(line).toContain("curator");
    expect(line).toMatch(/restore|not part of the collection/);
  });

  it("makes no such claim for a silent install", () => {
    const line = describeChosenMode("silent", 114).toLowerCase();
    expect(line).toContain("automatically");
    expect(line).not.toContain("restore");
  });
});

describe("the default", () => {
  it("is silent", () => {
    // Only reached when nobody was asked. Automation is right for the caller
    // that predates the question — a 900-mod install that stops 114 times
    // without warning is the worse failure.
    expect(DEFAULT_FOMOD_REPLAY_MODE).toBe("silent");
  });
});

describe("the installers silent replay cannot silence", () => {
  // The correction. A mod whose recorded steps have NOTHING selected in any
  // group gets no choices passed — deliberately, so we never claim an answer
  // the curator did not make. But passing no choices means Vortex's ORDINARY
  // install path, and that is the path that opens the dialog. So these mods
  // ask the user in BOTH modes, and the silent copy must not promise silence.
  //
  // Measured 112 answerable / 3 unanswered on the real 963-mod collection.

  it("does not promise an uninterrupted run when some installers will still ask", () => {
    const silent = describeFomodModes(112, 3).find((o) => o.mode === "silent")!;
    const text = silent.points.join(" ");
    expect(text).not.toContain("start to finish");
    expect(text).toContain("3 other mods");
    expect(text.toLowerCase()).toContain("still ask");
  });

  it("still promises an uninterrupted run when nothing will ask", () => {
    const silent = describeFomodModes(112, 0).find((o) => o.mode === "silent")!;
    expect(silent.points.join(" ")).toContain("start to finish");
    expect(silent.points.join(" ")).not.toContain("still ask");
  });

  it("counts the unanswered ones in the supervised dialog total", () => {
    // 112 answerable + 3 unanswered = 115 dialogs to click through. Counting
    // only the replayable ones understates the evening the user is agreeing to.
    const sup = describeFomodModes(112, 3).find((o) => o.mode === "supervised")!;
    expect(sup.points.join(" ")).toContain("115 dialogs");
  });

  it("warns that the unanswered ones open with nothing preselected", () => {
    const sup = describeFomodModes(112, 3).find((o) => o.mode === "supervised")!;
    expect(sup.points.join(" ")).toContain("nothing preselected");
  });

  it("stays grammatical for exactly one unanswered mod", () => {
    const text = JSON.stringify(describeFomodModes(112, 1));
    expect(text).toContain("1 other mod ");
    expect(text).not.toContain("1 other mods");
    expect(text).toContain("ask you about it");
  });

  it("keeps the silent blurb about what IS replayed", () => {
    // The residue is a caveat, not the headline. 112 answered automatically is
    // still the main fact about this option.
    const silent = describeFomodModes(112, 3).find((o) => o.mode === "silent")!;
    expect(silent.blurb).toContain("112 mods");
  });
});
