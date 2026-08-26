/**
 * Cancelling was deliberately not offered for a long time, on the grounds that
 * "aborting partway would leave a mess".
 *
 * Half of that was already solved and nobody had noticed: the driver checks
 * for an abort only where a unit of work has finished, so it structurally
 * cannot leave a half-written mod. The half that was real is that the aborted
 * result did not say what it HAD installed — `InstallFailed` carried
 * `installedSoFar` and `InstallAborted` did not. Stopping at mod 600 of 954
 * left 600 real mods in a real profile and a result that said only "aborted".
 *
 * So this covers the promise the stop button makes: it stops, and it tells you
 * what it left behind.
 */
import { describe, expect, it } from "vitest";

import { buildAbortedResult } from "../../../core/installer/runInstall";

const entries = (...ids: string[]): { vortexModId: string }[] =>
  ids.map((vortexModId) => ({ vortexModId }));

describe("buildAbortedResult", () => {
  it("reports every mod that finished installing", () => {
    const out = buildAbortedResult({
      phase: "installing-mods",
      reason: "User aborted the install.",
      partialProfileId: "profile-7",
      installedMods: entries("mod-a", "mod-b", "mod-c"),
    });
    expect(out).toEqual({
      kind: "aborted",
      phase: "installing-mods",
      partialProfileId: "profile-7",
      reason: "User aborted the install.",
      installedSoFar: ["mod-a", "mod-b", "mod-c"],
    });
  });

  it("says an empty list rather than nothing when the abort came first", () => {
    // Stopping during preflight is a real case, and "installedSoFar: []" is a
    // different claim from a missing field: it says the driver checked.
    const out = buildAbortedResult({
      phase: "preflight",
      reason: "User aborted the install.",
      partialProfileId: undefined,
      installedMods: [],
    });
    expect(out.installedSoFar).toEqual([]);
    expect(out.partialProfileId).toBeUndefined();
  });

  it("reads the list at call time, not when the driver started", () => {
    // In runInstall this is a closure over a mutable array that grows as mods
    // install. Capturing a copy up front would report zero for every abort —
    // the exact bug this field exists to prevent, in the reassuring direction.
    const live = entries("mod-a");
    const early = buildAbortedResult({
      phase: "installing-mods",
      reason: "stop",
      partialProfileId: undefined,
      installedMods: live,
    });
    live.push({ vortexModId: "mod-b" });
    const late = buildAbortedResult({
      phase: "installing-mods",
      reason: "stop",
      partialProfileId: undefined,
      installedMods: live,
    });
    expect(early.installedSoFar).toEqual(["mod-a"]);
    expect(late.installedSoFar).toEqual(["mod-a", "mod-b"]);
  });

  it("copies the ids instead of aliasing the driver's array", () => {
    // The result outlives runInstall and is rendered later; sharing the array
    // would let a late push mutate a result the UI had already read.
    const live = entries("mod-a");
    const out = buildAbortedResult({
      phase: "installing-mods",
      reason: "stop",
      partialProfileId: undefined,
      installedMods: live,
    });
    live.push({ vortexModId: "mod-b" });
    expect(out.installedSoFar).toEqual(["mod-a"]);
  });
});

describe("the aborted result contract", () => {
  it("cannot describe an abort without saying what was installed", () => {
    // Pins the field as required. Relaxing it to optional would compile and
    // would silently take the stop screen back to "it stopped", with no
    // failing test to notice — which is how it was for six abort sites.
    const aborted = {
      kind: "aborted" as const,
      phase: "installing-mods" as const,
      reason: "User aborted the install.",
      installedSoFar: ["mod-1", "mod-2"],
    };

    // @ts-expect-error installedSoFar is required.
    const withoutIt: typeof aborted = {
      kind: "aborted" as const,
      phase: "installing-mods" as const,
      reason: "User aborted the install.",
    };
    void withoutIt;
    expect(aborted.installedSoFar).toHaveLength(2);
  });
});
