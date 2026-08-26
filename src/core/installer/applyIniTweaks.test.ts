/**
 * An INI tweak is the most invisible thing a collection ships. It adds no
 * file to the mod list, changes no plugin count, and its absence looks exactly
 * like its presence — right up until the game runs differently and nothing on
 * screen explains why.
 *
 * So the two things that matter: it ticks against the mod THIS install
 * produced (never the curator's id), and when it cannot, it says so.
 */
import { describe, expect, it } from "vitest";

import { applyIniTweaks, describeIniTweaks } from "./applyIniTweaks";
import type { EhcollMod } from "../../types/ehcoll";

const mod = (
  name: string,
  compareKey: string,
  enabledINITweaks: string[],
): EhcollMod => ({ name, compareKey, state: { enabledINITweaks } }) as EhcollMod;

const fakeApi = () => {
  const dispatched: { tweak: string; modId: string; enabled: boolean }[] = [];
  return {
    api: {
      store: {
        dispatch: (action: unknown) => {
          const p = (action as { payload?: Record<string, unknown> }).payload;
          if (p !== undefined) {
            dispatched.push({
              tweak: String(p["tweak"]),
              modId: String(p["modId"]),
              enabled: Boolean(p["enabled"]),
            });
          }
        },
      },
    } as never,
    dispatched,
  };
};

describe("applyIniTweaks", () => {
  it("ticks the curator's tweaks on the mod THIS install produced", () => {
    // The manifest's own id is the CURATOR's. Ticking against it would either
    // do nothing or land on an unrelated mod that shares the id here.
    const { api, dispatched } = fakeApi();
    const out = applyIniTweaks({
      api,
      gameId: "fallout4",
      installed: new Map([["external:aaa", "local-mod-77"]]),
      manifestMods: [mod("Perf Preset", "external:aaa", ["Low Shadows.ini"])],
    });

    expect(dispatched).toEqual([
      { tweak: "Low Shadows.ini", modId: "local-mod-77", enabled: true },
    ]);
    expect(out.enabled).toEqual(["Perf Preset :: Low Shadows.ini"]);
    expect(out.skipped).toEqual([]);
  });

  it("enables every tweak on a mod, not just the first", () => {
    const { api, dispatched } = fakeApi();
    applyIniTweaks({
      api,
      gameId: "fallout4",
      installed: new Map([["k", "m1"]]),
      manifestMods: [mod("Multi", "k", ["a.ini", "b.ini", "c.ini"])],
    });
    expect(dispatched.map((d) => d.tweak)).toEqual(["a.ini", "b.ini", "c.ini"]);
  });

  it("never disables anything", () => {
    // The user may have ticked tweaks on their own mods. A collection that
    // unticked what it did not tick would be reaching outside what it
    // installed.
    const { api, dispatched } = fakeApi();
    applyIniTweaks({
      api,
      gameId: "fallout4",
      installed: new Map([["k", "m1"]]),
      manifestMods: [mod("M", "k", ["x.ini"])],
    });
    expect(dispatched.every((d) => d.enabled)).toBe(true);
  });

  it("records a tweak it could not place instead of dropping it", () => {
    // A skipped or carried mod has no new id. That is not an error, but a
    // silently missing tweak is unexplainable later.
    const { api, dispatched } = fakeApi();
    const out = applyIniTweaks({
      api,
      gameId: "fallout4",
      installed: new Map(),
      manifestMods: [mod("Skipped Mod", "k", ["gone.ini"])],
    });
    expect(dispatched).toEqual([]);
    expect(out.skipped).toEqual(["Skipped Mod :: gone.ini"]);
  });

  it("does nothing for mods with no tweaks", () => {
    const { api, dispatched } = fakeApi();
    const out = applyIniTweaks({
      api,
      gameId: "fallout4",
      installed: new Map([["k", "m1"]]),
      manifestMods: [mod("Plain", "k", [])],
    });
    expect(dispatched).toEqual([]);
    expect(out).toEqual({ enabled: [], skipped: [] });
  });

  it("keeps going when one tweak throws", () => {
    let calls = 0;
    const api = {
      store: {
        dispatch: () => {
          calls += 1;
          if (calls === 1) throw new Error("nope");
        },
      },
    } as never;
    const out = applyIniTweaks({
      api,
      gameId: "fallout4",
      installed: new Map([["k", "m1"]]),
      manifestMods: [mod("M", "k", ["bad.ini", "good.ini"])],
    });
    expect(out.skipped).toEqual(["M :: bad.ini"]);
    expect(out.enabled).toEqual(["M :: good.ini"]);
  });
});

describe("describeIniTweaks", () => {
  it("says nothing when everything landed", () => {
    // A tweak that worked is indistinguishable from a collection with none.
    expect(describeIniTweaks({ enabled: ["A :: a.ini"], skipped: [] })).toEqual([]);
  });

  it("names what did not land, and why it matters", () => {
    const said = describeIniTweaks({
      enabled: [],
      skipped: ["Perf :: Low Shadows.ini"],
    }).join(" ");
    expect(said).toMatch(/Perf :: Low Shadows\.ini/);
    // The point a user cannot infer: this changes nothing visible.
    expect(said).toMatch(/without changing anything you can see/);
    expect(said).toMatch(/INI Tweaks tab/);
  });

  it("truncates a long list rather than printing forty lines", () => {
    const many = Array.from({ length: 12 }, (_, i) => `M :: ${String(i)}.ini`);
    const said = describeIniTweaks({ enabled: [], skipped: many });
    expect(said.join(" ")).toMatch(/and 7 more/);
    expect(said.length).toBeLessThan(10);
  });
});
