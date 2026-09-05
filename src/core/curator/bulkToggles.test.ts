/**
 * Writing only what changes.
 *
 * Vortex re-deploys on a profile change, so dispatching "enabled: true" for
 * nine hundred already-enabled mods is nine hundred writes and the deploy
 * behind them.
 */
import { describe, expect, it } from "vitest";

import {
  describeEnableChanges,
  describeTypeChanges,
  planEnableChanges,
  planTypeChanges,
} from "./bulkToggles";
import type { CuratorMod } from "./profileActions";

const mod = (id: string, over: Partial<CuratorMod> = {}): CuratorMod => ({
  id,
  name: id,
  enabled: true,
  modType: "",
  ...over,
});

describe("enabling and disabling", () => {
  it("skips mods already in the wanted state", () => {
    const changes = planEnableChanges(
      [mod("on"), mod("off", { enabled: false })],
      true,
    );
    expect(changes.map((c) => c.mod.id)).toEqual(["off"]);
  });

  it("plans nothing when everything already matches", () => {
    expect(planEnableChanges([mod("a"), mod("b")], true)).toEqual([]);
  });

  it("works in the disabling direction too", () => {
    const changes = planEnableChanges([mod("a"), mod("b", { enabled: false })], false);
    expect(changes.map((c) => c.mod.id)).toEqual(["a"]);
  });

  it("says plainly when there is nothing to do", () => {
    expect(describeEnableChanges([])).toContain("nothing to write");
  });

  it("mentions the single deploy, which is the reason to use it", () => {
    expect(describeEnableChanges(planEnableChanges([mod("a", { enabled: false })], true)))
      .toContain("one deploy rather than one per mod");
  });
});

describe("setting a mod's kind", () => {
  it("skips mods already that kind", () => {
    const changes = planTypeChanges(
      [mod("plain"), mod("injector", { modType: "dinput" })],
      "dinput",
    );
    expect(changes.map((c) => c.mod.id)).toEqual(["plain"]);
  });

  it("treats spacing and case as the same type, not a change", () => {
    // Otherwise " dinput" writes a second, differently-spelled type that
    // Vortex will not recognise as the one that deploys to the game root.
    expect(planTypeChanges([mod("a", { modType: "dinput" })], " DInput ")).toEqual(
      [],
    );
  });

  it("normalises what it writes, so a typed value cannot introduce a variant", () => {
    const [change] = planTypeChanges([mod("a")], " DInput ");
    expect(change!.to).toBe("dinput");
  });

  it("can set mods back to the default type", () => {
    const [change] = planTypeChanges([mod("a", { modType: "dinput" })], "");
    expect(change).toMatchObject({ from: "dinput", to: "" });
  });

  it("explains what a kind decides, since the word means nothing alone", () => {
    const text = describeTypeChanges(planTypeChanges([mod("a")], "dinput"));
    expect(text).toContain("WHERE its files deploy");
    expect(text).toContain("Deploy afterwards");
  });

  it("writes only the type it was handed, never one of its own", () => {
    // The anti-hardcode rule, checked where it is actually enforceable: the
    // planner has no table mapping a mod to a type, so every value it writes
    // came from the caller. (The module's DOC names a mod, as the reason the
    // feature exists — that is motivation, not behaviour, and a test claiming
    // "names no mod" would have been asserting something untrue while
    // passing.)
    const written = new Set(
      [
        ...planTypeChanges([mod("a"), mod("b", { modType: "x" })], "dinput"),
        ...planTypeChanges([mod("c")], "custom-type"),
      ].map((c) => c.to),
    );
    expect([...written].sort()).toEqual(["custom-type", "dinput"]);
  });
});
