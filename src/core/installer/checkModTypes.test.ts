/**
 * Exactly one mod in the real 954-mod collection has a non-default modType:
 * F4SE, as `dinput`. That type is what puts its DLL next to the game
 * executable instead of in Data. Install it as a normal mod and the files are
 * all present, all correct, and in a folder the loader never looks at — so the
 * game launches without the script extender and every mod depending on it
 * quietly does nothing. File verification passes throughout.
 */
import { describe, expect, it } from "vitest";

import { describeModTypeMismatches, findModTypeMismatches } from "./checkModTypes";
import type { EhcollMod } from "../../types/ehcoll";

const mod = (name: string, compareKey: string, modType: string): EhcollMod =>
  ({ name, compareKey, state: { modType } }) as EhcollMod;

const api = (mods: Record<string, { type?: string }>) =>
  ({
    getState: () => ({ persistent: { mods: { fallout4: mods } } }),
  }) as never;

describe("findModTypeMismatches", () => {
  it("catches a script extender that installed as a normal mod", () => {
    const out = findModTypeMismatches({
      api: api({ "installed-1": { type: "" } }),
      gameId: "fallout4",
      installed: new Map([["nexus:42147:1", "installed-1"]]),
      manifestMods: [mod("F4SE", "nexus:42147:1", "dinput")],
    });
    expect(out).toEqual([{ name: "F4SE", expected: "dinput", actual: "" }]);
  });

  it("says nothing when the type came out right", () => {
    const out = findModTypeMismatches({
      api: api({ "installed-1": { type: "dinput" } }),
      gameId: "fallout4",
      installed: new Map([["nexus:42147:1", "installed-1"]]),
      manifestMods: [mod("F4SE", "nexus:42147:1", "dinput")],
    });
    expect(out).toEqual([]);
  });

  it("treats a missing type and an empty type as the same default", () => {
    // Vortex omits the field for default mods rather than storing "".
    const out = findModTypeMismatches({
      api: api({ "installed-1": {} }),
      gameId: "fallout4",
      installed: new Map([["nexus:1:1", "installed-1"]]),
      manifestMods: [mod("Ordinary", "nexus:1:1", "")],
    });
    expect(out).toEqual([]);
  });

  it("ignores a mod this install did not produce", () => {
    // Skipped or carried mods have no new id; comparing them would report a
    // mismatch for something this run never touched.
    const out = findModTypeMismatches({
      api: api({}),
      gameId: "fallout4",
      installed: new Map(),
      manifestMods: [mod("F4SE", "nexus:42147:1", "dinput")],
    });
    expect(out).toEqual([]);
  });

  it("reports nothing rather than everything when state cannot be read", () => {
    // Inventing 954 mismatches from an unreadable state would be worse than
    // missing one.
    const broken = {
      getState: () => {
        throw new Error("no state");
      },
    } as never;
    expect(
      findModTypeMismatches({
        api: broken,
        gameId: "fallout4",
        installed: new Map([["k", "id"]]),
        manifestMods: [mod("X", "k", "dinput")],
      }),
    ).toEqual([]);
  });
});

describe("describeModTypeMismatches", () => {
  it("leads with the consequence, not the jargon", () => {
    const said = describeModTypeMismatches([
      { name: "F4SE", expected: "dinput", actual: "" },
    ]).join(" ");
    expect(said).toMatch(/deploy their files to a different folder/);
    expect(said).toMatch(/in the wrong place/);
    expect(said).toMatch(/"F4SE"/);
    // And the fix, plus why this particular mod matters.
    expect(said).toMatch(/Reinstalling/);
    expect(said).toMatch(/next to the game executable/);
  });

  it("describes the default type in words, not as an empty string", () => {
    const said = describeModTypeMismatches([
      { name: "X", expected: "", actual: "dinput" },
    ]).join(" ");
    expect(said).toMatch(/the curator had a normal mod/);
    expect(said).not.toMatch(/""\s*,/);
  });

  it("says nothing at all when everything matched", () => {
    expect(describeModTypeMismatches([])).toEqual([]);
  });
});
