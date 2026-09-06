/**
 * Whether the profile moved, and what the answer is allowed to claim.
 *
 * The load-bearing one is the wording: this sees only what Vortex records,
 * so "no changes" would be a promise it cannot keep about a file edited by
 * hand inside a staging folder.
 */
import { describe, expect, it } from "vitest";

import {
  describeProfileDrift,
  isProfileUnmoved,
  profileDriftSince,
  type DriftMod,
} from "./profileDrift";

const mod = (id: string, over: Partial<DriftMod> = {}): DriftMod => ({
  id,
  name: id,
  enabled: true,
  version: "1.0",
  modType: "",
  ...over,
});

describe("an untouched profile", () => {
  it("reports nothing moved", () => {
    const before = [mod("a"), mod("b")];
    const after = [mod("a"), mod("b")];
    expect(isProfileUnmoved(profileDriftSince(before, after))).toBe(true);
  });

  it("is unmoved even when the order changed", () => {
    // Vortex hands these back in whatever order it likes; order is not a
    // change and reporting it as one would make every resume look stale.
    const drift = profileDriftSince([mod("a"), mod("b")], [mod("b"), mod("a")]);
    expect(isProfileUnmoved(drift)).toBe(true);
  });

  it("says so without promising more than it checked", () => {
    const drift = profileDriftSince([mod("a")], [mod("a")]);
    expect(describeProfileDrift(drift)).toBe(
      "Vortex reports no changes to your profile since this build.",
    );
  });
});

describe("what counts as movement", () => {
  it("notices a mod that appeared", () => {
    const drift = profileDriftSince([mod("a")], [mod("a"), mod("b", { name: "New" })]);
    expect(drift.added).toEqual(["New"]);
  });

  it("notices a mod that went away", () => {
    const drift = profileDriftSince([mod("a", { name: "Gone" })], []);
    expect(drift.removed).toEqual(["Gone"]);
  });

  it("notices a toggle", () => {
    const drift = profileDriftSince(
      [mod("a", { enabled: true })],
      [mod("a", { enabled: false })],
    );
    expect(drift.toggled).toEqual(["a"]);
  });

  it("notices a version change", () => {
    const drift = profileDriftSince(
      [mod("a", { version: "1.0" })],
      [mod("a", { version: "2.0" })],
    );
    expect(drift.changed).toEqual(["a"]);
  });

  it("notices a mod kind change", () => {
    // The engine-injector case: a hand-set modType is a real change to what
    // a build would produce, and it moves no version.
    const drift = profileDriftSince(
      [mod("a", { modType: "" })],
      [mod("a", { modType: "dinput" })],
    );
    expect(drift.changed).toEqual(["a"]);
  });

  it("counts one mod once, even when two things about it moved", () => {
    const drift = profileDriftSince(
      [mod("a", { enabled: true, version: "1.0" })],
      [mod("a", { enabled: false, version: "2.0" })],
    );
    expect(drift.toggled).toEqual(["a"]);
    expect(drift.changed).toEqual([]);
  });

  it("reads a reinstall as a removal and an addition", () => {
    // Vortex mints a new mod id on reinstall. That IS a change to the
    // profile and claiming otherwise would be the wrong direction to err.
    const drift = profileDriftSince(
      [mod("old-id", { name: "Apocalypse" })],
      [mod("new-id", { name: "Apocalypse" })],
    );
    expect(drift.removed).toEqual(["Apocalypse"]);
    expect(drift.added).toEqual(["Apocalypse"]);
  });
});

describe("how it is said", () => {
  it("names each kind of movement, once", () => {
    const drift = profileDriftSince(
      [mod("gone"), mod("t", { enabled: true }), mod("v", { version: "1" })],
      [mod("t", { enabled: false }), mod("v", { version: "2" }), mod("new")],
    );
    expect(describeProfileDrift(drift)).toBe(
      "Your profile has moved since this build — 1 added, 1 removed, 1 toggled, 1 changed.",
    );
  });

  it("handles both sides being empty", () => {
    expect(isProfileUnmoved(profileDriftSince([], []))).toBe(true);
  });
});
