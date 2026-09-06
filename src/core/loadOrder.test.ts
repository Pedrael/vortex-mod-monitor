/**
 * ──────────────────────────────────────────────────────────────────────
 * Capture and apply have to be inverses, or the tool does not do its job.
 *
 * This module had no tests at all, and two independent defects that each made
 * it return `[]` unconditionally:
 *
 *   - it read `persistent.loadOrder[gameId]`, but Vortex keys that hive by
 *     PROFILE id — verified against a live store, where every key present was
 *     a profile id and no game id appeared at all;
 *   - it required `entry.pos`, which the modern file-based (FBLO) array shape
 *     does not have. `Object.entries` on an array yields "0", "1", "2" as
 *     modIds with `pos === undefined`, so every entry was dropped.
 *
 * Neither was visible, because `[]` is ALSO the legitimate answer for a game
 * with no load order. A failure that is indistinguishable from a success is
 * the thing this file exists to make impossible.
 * ──────────────────────────────────────────────────────────────────────
 */
import { describe, expect, it } from "vitest";

import { captureLoadOrder } from "./loadOrder";

const stateWith = (hive: unknown): never =>
  ({ persistent: { loadOrder: hive } }) as never;

const PROFILE = "5Se3KaxbZ";

describe("the hive is keyed by profile, not by game", () => {
  it("reads the profile's entries", () => {
    const captured = captureLoadOrder(
      stateWith({
        [PROFILE]: { modA: { pos: 0, enabled: true } },
      }),
      PROFILE,
    );
    expect(captured).toEqual([{ modId: "modA", pos: 0, enabled: true }]);
  });

  it("finds nothing under a game id, which is what it used to look up", () => {
    // The old key. Kept as a test so the claim stays checkable rather than
    // living only in a commit message.
    const hive = { [PROFILE]: { modA: { pos: 0, enabled: true } } };
    expect(captureLoadOrder(stateWith(hive), "skyrimse")).toEqual([]);
    expect(captureLoadOrder(stateWith(hive), PROFILE)).toHaveLength(1);
  });
});

describe("both of Vortex's load-order shapes are read", () => {
  it("reads the legacy dictionary, where position is `pos`", () => {
    // Deliberately inserted out of order: a dictionary has no inherent
    // sequence, so `pos` is the only thing that says what the order IS, and
    // the result must come back ordered by it rather than by key insertion.
    const captured = captureLoadOrder(
      stateWith({
        [PROFILE]: {
          second: { pos: 1, enabled: true },
          first: { pos: 0, enabled: false },
        },
      }),
      PROFILE,
    );
    expect(captured).toEqual([
      { modId: "first", pos: 0, enabled: false },
      { modId: "second", pos: 1, enabled: true },
    ]);
  });

  it("reads the modern FBLO array, where position is the INDEX", () => {
    /**
     * The shape `applyLoadOrder` writes. Reading it as a dictionary produced
     * "0"/"1" as mod ids and no `pos`, so the whole thing was discarded —
     * which meant applying a load order and re-capturing it gave back
     * nothing.
     */
    const captured = captureLoadOrder(
      stateWith({
        [PROFILE]: [
          { id: "a", modId: "modA", name: "A", enabled: true },
          { id: "b", modId: "modB", name: "B", enabled: false },
        ],
      }),
      PROFILE,
    );
    expect(captured).toEqual([
      { modId: "modA", pos: 0, enabled: true },
      { modId: "modB", pos: 1, enabled: false },
    ]);
  });

  it("round-trips what applyLoadOrder writes", () => {
    /**
     * The property that makes this a capture-and-reproduce tool rather than
     * two unrelated halves. `applyLoadOrder` builds exactly this payload
     * shape, so capture must read its own output back.
     */
    const applied = [
      { id: "modA", modId: "modA", name: "A", enabled: true },
      { id: "modB", modId: "modB", name: "B", enabled: true },
      { id: "modC", modId: "modC", name: "C", enabled: false },
    ];
    const captured = captureLoadOrder(stateWith({ [PROFILE]: applied }), PROFILE);

    expect(captured.map((e) => e.modId)).toEqual(["modA", "modB", "modC"]);
    expect(captured.map((e) => e.pos)).toEqual([0, 1, 2]);
    expect(captured.map((e) => e.enabled)).toEqual([true, true, false]);
  });
});

describe("what it refuses rather than invents", () => {
  it("returns empty when the profile has no hive", () => {
    expect(captureLoadOrder(stateWith({}), PROFILE)).toEqual([]);
    expect(captureLoadOrder(stateWith(undefined), PROFILE)).toEqual([]);
  });

  it("drops an array entry with no mod behind it", () => {
    // An FBLO row can be a placeholder. A load-order entry naming no mod is
    // not something to reproduce.
    const captured = captureLoadOrder(
      stateWith({
        [PROFILE]: [
          { id: "a", modId: "modA", enabled: true },
          { id: "orphan", enabled: true },
        ],
      }),
      PROFILE,
    );
    expect(captured).toEqual([{ modId: "modA", pos: 0, enabled: true }]);
  });

  it("drops a dictionary entry with no position", () => {
    const captured = captureLoadOrder(
      stateWith({
        [PROFILE]: { good: { pos: 0, enabled: true }, bad: { enabled: true } },
      }),
      PROFILE,
    );
    expect(captured).toEqual([{ modId: "good", pos: 0, enabled: true }]);
  });

  it("carries locked and external only when set", () => {
    const captured = captureLoadOrder(
      stateWith({
        [PROFILE]: [
          { modId: "plain", enabled: true },
          { modId: "pinned", enabled: true, locked: true, external: true },
        ],
      }),
      PROFILE,
    );
    expect(captured[0]).toEqual({ modId: "plain", pos: 0, enabled: true });
    expect(captured[1]).toEqual({
      modId: "pinned",
      pos: 1,
      enabled: true,
      locked: true,
      external: true,
    });
  });
});
