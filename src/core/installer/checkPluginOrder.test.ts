/**
 * "The rules were applied" and "the load order matches" are different claims,
 * and only the first was ever established. Many orders satisfy the same LOOT
 * rules; which one the user gets depends on their masterlist version, which
 * plugins they have, and rules they already had.
 *
 * For a Bethesda game that difference decides which mod's records win — so two
 * orders that both satisfy the rules can still play differently, or crash if a
 * patch loads before what it patches.
 */
import { describe, expect, it } from "vitest";

import {
  comparePluginOrder,
  describePluginOrderDrift,
} from "./checkPluginOrder";
import type { PluginOrderEntry } from "./checkPluginOrder";

const order = (...names: string[]): PluginOrderEntry[] =>
  names.map((name) => ({ name, enabled: true }));

describe("comparePluginOrder", () => {
  it("reports nothing when the order matches", () => {
    const d = comparePluginOrder(
      order("Fallout4.esm", "A.esp", "B.esp"),
      order("Fallout4.esm", "A.esp", "B.esp"),
    );
    expect(d.misordered).toEqual([]);
    expect(d.missing).toEqual([]);
    expect(describePluginOrderDrift(d)).toEqual([]);
  });

  it("does NOT report drift just because the user has extra mods", () => {
    // The single most important non-finding. Every real profile has the
    // user's own plugins in it; calling that drift would make this notice
    // fire on every healthy install and train them to ignore it.
    const d = comparePluginOrder(
      order("Fallout4.esm", "A.esp", "B.esp"),
      order("Fallout4.esm", "MyOwn.esp", "A.esp", "Another.esp", "B.esp"),
    );
    expect(d.misordered).toEqual([]);
    expect(d.extra).toEqual(["MyOwn.esp", "Another.esp"]);
    expect(describePluginOrderDrift(d)).toEqual([]);
  });

  it("catches a genuinely swapped pair", () => {
    const d = comparePluginOrder(
      order("Fallout4.esm", "Base.esp", "Patch.esp"),
      order("Fallout4.esm", "Patch.esp", "Base.esp"),
    );
    expect(d.misordered).toEqual([
      { name: "Patch.esp", expectedAfter: "Base.esp" },
    ]);
  });

  it("names what the plugin should follow, not just that it moved", () => {
    // "X must come after Y" is a rule someone can act on. "The order differs"
    // is not.
    const said = describePluginOrderDrift(
      comparePluginOrder(
        order("Base.esp", "Patch.esp"),
        order("Patch.esp", "Base.esp"),
      ),
    ).join(" ");
    expect(said).toMatch(/"Patch\.esp" should load after "Base\.esp"/);
  });

  it("reports a missing plugin separately from a misordered one", () => {
    // Different causes, different fixes: missing usually means a mod failed
    // to install, and chasing the load order for it wastes the user's time.
    const d = comparePluginOrder(
      order("Fallout4.esm", "Gone.esp", "B.esp"),
      order("Fallout4.esm", "B.esp"),
    );
    expect(d.missing).toEqual(["Gone.esp"]);
    expect(d.misordered).toEqual([]);
    const said = describePluginOrderDrift(d).join(" ");
    expect(said).toMatch(/not present here/);
    expect(said).toMatch(/did not install/);
  });

  it("ignores disabled plugins on both sides", () => {
    // A disabled plugin is not loaded, so its position changes nothing.
    const d = comparePluginOrder(
      [
        { name: "A.esp", enabled: true },
        { name: "Off.esp", enabled: false },
        { name: "B.esp", enabled: true },
      ],
      [
        { name: "A.esp", enabled: true },
        { name: "B.esp", enabled: true },
        { name: "Off.esp", enabled: false },
      ],
    );
    expect(d.misordered).toEqual([]);
    expect(d.missing).toEqual([]);
  });

  it("matches plugin names case-insensitively", () => {
    // plugins.txt casing is not stable across machines or Vortex versions.
    const d = comparePluginOrder(
      order("Fallout4.esm", "MyMod.esp"),
      order("fallout4.esm", "mymod.esp"),
    );
    expect(d.missing).toEqual([]);
    expect(d.extra).toEqual([]);
    expect(d.misordered).toEqual([]);
  });

  it("counts only the plugins it actually compared", () => {
    const d = comparePluginOrder(
      order("A.esp", "B.esp", "OnlyCurator.esp"),
      order("A.esp", "B.esp", "OnlyUser.esp"),
    );
    expect(d.compared).toBe(2);
  });

  it("truncates a large drift rather than printing hundreds of lines", () => {
    const curator = order(...Array.from({ length: 20 }, (_, i) => `P${i}.esp`));
    const user = order(...[...curator].reverse().map((p) => p.name));
    const said = describePluginOrderDrift(comparePluginOrder(curator, user));
    expect(said.join(" ")).toMatch(/and \d+ more/);
    expect(said.length).toBeLessThan(12);
  });
});
