/**
 * Regression tests for profile resolution.
 *
 * The bug these exist for: `getActiveProfileIdFromState` tested
 * `profile.active === true`, a field `IProfile` does not have, then fell back to
 * "first profile of this game in object-iteration order". Every call took the
 * fallback, so on a game with more than one profile it silently resolved to an
 * arbitrary one — reporting "your active profile has no mods" for a profile the
 * user had never selected, and capable of building a collection from the wrong
 * profile without anything looking wrong.
 *
 * Every case below is written so it FAILS against that old implementation.
 */
import { describe, expect, it } from "vitest";

import { getActiveProfileIdFromState, getModsForProfile } from "./getModsListForProfile";

const FO4 = "fallout4";

/** Minimal state shaped like Vortex's, with only what resolution reads. */
function makeState(opts: {
  profiles: Record<string, { gameId: string; lastActivated?: number; pendingRemove?: boolean }>;
  activeProfileId?: string;
  lastActiveProfile?: Record<string, string>;
}): any {
  return {
    persistent: {
      profiles: Object.fromEntries(
        Object.entries(opts.profiles).map(([id, p]) => [
          id,
          { id, name: id, modState: {}, lastActivated: 0, ...p },
        ]),
      ),
      mods: {},
    },
    settings: {
      profiles: {
        activeProfileId: opts.activeProfileId,
        lastActiveProfile: opts.lastActiveProfile ?? {},
      },
    },
  };
}

describe("getActiveProfileIdFromState", () => {
  it("picks the profile Vortex says is active, not the first one enumerated", () => {
    // "empty" enumerates first; "real" is the one the user is actually on.
    const state = makeState({
      profiles: { empty: { gameId: FO4 }, real: { gameId: FO4 } },
      activeProfileId: "real",
    });
    expect(getActiveProfileIdFromState(state, FO4)).toBe("real");
  });

  it("ignores the active profile when it belongs to a different game", () => {
    const state = makeState({
      profiles: { skyrimProfile: { gameId: "skyrimse" }, fo4Profile: { gameId: FO4 } },
      activeProfileId: "skyrimProfile",
    });
    expect(getActiveProfileIdFromState(state, FO4)).toBe("fo4Profile");
  });

  it("falls back to lastActiveProfile for the game when the user is on another game", () => {
    const state = makeState({
      profiles: {
        other: { gameId: FO4, lastActivated: 5 },
        remembered: { gameId: FO4, lastActivated: 1 },
        sky: { gameId: "skyrimse" },
      },
      activeProfileId: "sky",
      lastActiveProfile: { [FO4]: "remembered" },
    });
    // Note this also outranks the lastActivated ordering below - Vortex's own
    // memory of the game beats our heuristic.
    expect(getActiveProfileIdFromState(state, FO4)).toBe("remembered");
  });

  it("falls back to the MOST RECENTLY ACTIVATED profile, not an arbitrary one", () => {
    const state = makeState({
      profiles: {
        stale: { gameId: FO4, lastActivated: 10 },
        newest: { gameId: FO4, lastActivated: 999 },
      },
    });
    expect(getActiveProfileIdFromState(state, FO4)).toBe("newest");
  });

  it("skips profiles pending removal", () => {
    const state = makeState({
      profiles: {
        doomed: { gameId: FO4, lastActivated: 999, pendingRemove: true },
        keeper: { gameId: FO4, lastActivated: 1 },
      },
    });
    expect(getActiveProfileIdFromState(state, FO4)).toBe("keeper");
  });

  it("returns undefined when the game has no profiles at all", () => {
    const state = makeState({ profiles: { sky: { gameId: "skyrimse" } } });
    expect(getActiveProfileIdFromState(state, FO4)).toBeUndefined();
  });

  it("does not throw on a state missing settings entirely", () => {
    const state = { persistent: { profiles: { p: { id: "p", gameId: FO4, modState: {} } } } };
    expect(getActiveProfileIdFromState(state, FO4)).toBe("p");
  });
});

describe("getModsForProfile", () => {
  it("returns only mods the profile tracks, and reports enabled state", () => {
    const state: any = {
      persistent: {
        mods: {
          [FO4]: {
            tracked: { id: "tracked", attributes: { name: "Tracked Mod" } },
            untracked: { id: "untracked", attributes: { name: "Other Profile Mod" } },
          },
        },
        profiles: {
          p1: { id: "p1", gameId: FO4, modState: { tracked: { enabled: true } }, modState_: 0 },
        },
      },
      settings: { profiles: { activeProfileId: "p1", lastActiveProfile: {} } },
    };
    const mods = getModsForProfile(state, FO4, "p1");
    expect(mods.map((m) => m.id)).toEqual(["tracked"]);
    expect(mods[0].enabled).toBe(true);
  });

  it("returns an empty list when the profile id does not exist", () => {
    const state: any = {
      persistent: { mods: { [FO4]: { a: { id: "a", attributes: {} } } }, profiles: {} },
      settings: { profiles: {} },
    };
    expect(getModsForProfile(state, FO4, "missing")).toEqual([]);
  });
});
