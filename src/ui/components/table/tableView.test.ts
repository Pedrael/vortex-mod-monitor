/**
 * The table's rules, where they are decided.
 *
 * Two of them carry weight beyond looking tidy: a capped list must always
 * report the true count (the list it replaced silently showed 40 of however
 * many), and an unknown value must never be treated as a small one or as a
 * match.
 */
import { describe, expect, it } from "vitest";

import {
  applyTableView,
  compareCells,
  compareForSort,
  describeTableView,
  describeTarget,
  distinctValues,
  effectiveTarget,
  matchesFilter,
  type ColumnSpec,
  type ViewRow,
} from "./tableView";

const columns: ColumnSpec[] = [
  { key: "name", header: "Mod" },
  { key: "version", header: "Version" },
  { key: "size", header: "Size", numeric: true },
  { key: "state", header: "State", match: "exact" },
];

const row = (id: string, values: ViewRow["values"]): ViewRow => ({ id, values });

const rows: ViewRow[] = [
  row("a", { name: "Apocalypse", version: "1.9", size: 300, state: "enabled" }),
  row("b", { name: "Better Dynamic Snow", version: "1.10", size: 20, state: "disabled" }),
  row("c", { name: "Cathedral Weathers", version: undefined, size: undefined, state: "enabled" }),
];

describe("filtering", () => {
  it("matches a substring, ignoring case", () => {
    expect(matchesFilter("Apocalypse", "apoc")).toBe(true);
    expect(matchesFilter("Apocalypse", "CALYPSE")).toBe(true);
  });

  it("treats a blank box as no filter at all", () => {
    // Clearing the box must restore the list, not select the rows whose
    // value is empty.
    expect(matchesFilter("anything", "")).toBe(true);
    expect(matchesFilter("anything", "   ")).toBe(true);
    expect(matchesFilter(undefined, "  ")).toBe(true);
  });

  it("never matches a value nobody knows", () => {
    // The dangerous direction: a search that silently includes unchecked
    // rows reads as "these are the matches".
    expect(matchesFilter(undefined, "1.0")).toBe(false);
  });

  it("compares the WHOLE value in exact mode", () => {
    // "1.1" is a substring of "1.10". A dropdown offering version 1.1 that
    // filtered by substring would list every 1.10 install under it.
    expect(matchesFilter("1.10", "1.1", "exact")).toBe(false);
    expect(matchesFilter("1.10", "1.1")).toBe(true);
    expect(matchesFilter("1.1", "1.1", "exact")).toBe(true);
  });

  it("narrows with each box, never widens", () => {
    const view = applyTableView({
      rows,
      columns,
      filters: { name: "a", state: "enabled" },
    });
    expect(view.rows.map((r) => r.id)).toEqual(["a", "c"]);
    expect(view.matched).toBe(2);
    expect(view.total).toBe(3);
  });
});

describe("sorting", () => {
  it("orders versions the way a reader expects, not the way strings do", () => {
    // "1.10" is BELOW "1.9" as plain text. This is presentation only — the
    // update decision is made on Nexus file ids, never here.
    const view = applyTableView({
      rows,
      columns,
      filters: {},
      sort: { key: "version", direction: "asc" },
    });
    expect(view.rows.map((r) => r.values.version)).toEqual([
      "1.9",
      "1.10",
      undefined,
    ]);
  });

  it("sorts a numeric column by magnitude", () => {
    const view = applyTableView({
      rows,
      columns,
      filters: {},
      sort: { key: "size", direction: "desc" },
    });
    expect(view.rows.map((r) => r.values.size)).toEqual([300, 20, undefined]);
  });

  it("keeps unknowns LAST when the sort is reversed", () => {
    // An unmeasured size is not zero bytes, and a missing version is not the
    // oldest one. Reversing must not promote them to the top.
    for (const direction of ["asc", "desc"] as const) {
      const view = applyTableView({
        rows,
        columns,
        filters: {},
        sort: { key: "size", direction },
      });
      expect(view.rows[2]!.id).toBe("c");
    }
  });

  it("leaves equal rows in the order they arrived", () => {
    const tied = [
      row("first", { state: "enabled" }),
      row("second", { state: "enabled" }),
      row("third", { state: "enabled" }),
    ];
    const view = applyTableView({
      rows: tied,
      columns,
      filters: {},
      sort: { key: "state", direction: "asc" },
    });
    expect(view.rows.map((r) => r.id)).toEqual(["first", "second", "third"]);
  });

  it("puts unparseable text last in a numeric column rather than first", () => {
    expect(compareCells("n/a", 5, true)).toBeGreaterThan(0);
  });

  it("keeps unparseable text last when reversed too", () => {
    // Same rule as a missing value: "n/a" in a size column is an unknown,
    // and reversing the sort must not float it to the top.
    expect(compareForSort("n/a", 5, true, "desc")).toBeGreaterThan(0);
    expect(compareForSort("n/a", 5, true, "asc")).toBeGreaterThan(0);
  });
});

describe("the row cap, which must never be silent", () => {
  it("caps what it renders but reports the real count", () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      row(String(i), { name: `Mod ${i}` }),
    );
    const view = applyTableView({ rows: many, columns, filters: {}, limit: 10 });
    expect(view.rows).toHaveLength(10);
    expect(view.matched).toBe(50);
    expect(view.capped).toBe(true);
  });

  it("says so in the banner", () => {
    const many = Array.from({ length: 50 }, (_, i) => row(String(i), {}));
    const view = applyTableView({ rows: many, columns, filters: {}, limit: 10 });
    expect(describeTableView(view, "mod")).toContain("showing the first 10");
  });

  it("is not capped when everything fits", () => {
    const view = applyTableView({ rows, columns, filters: {}, limit: 10 });
    expect(view.capped).toBe(false);
    expect(describeTableView(view, "mod")).toBe("3 mods");
  });

  it("treats no limit as no cap", () => {
    const many = Array.from({ length: 2000 }, (_, i) => row(String(i), {}));
    expect(applyTableView({ rows: many, columns, filters: {} }).rows).toHaveLength(
      2000,
    );
  });

  it("shows both numbers once a filter is on", () => {
    const view = applyTableView({ rows, columns, filters: { name: "apoc" } });
    expect(describeTableView(view, "mod")).toBe("Filtered: 1 of 3 mods");
  });
});

describe("dropdown values", () => {
  it("lists what is actually present, once each", () => {
    expect(distinctValues(rows, "state")).toEqual(["disabled", "enabled"]);
  });

  it("offers no option for a value nobody knows", () => {
    // A "(unknown)" entry in a dropdown would filter to rows the exact match
    // can never select.
    expect(distinctValues(rows, "version")).toEqual(["1.9", "1.10"]);
  });
});

describe("what a button above the table acts on", () => {
  const matched = ["a", "b", "c"];

  it("acts on the filtered rows when nothing is ticked", () => {
    // The bug this fixes: "Update 126 mod(s)" over a table filtered to 80.
    const t = effectiveTarget({ matched, total: 10, selected: new Set() });
    expect(t).toEqual({ ids: ["a", "b", "c"], from: "filtered" });
  });

  it("says 'all' only when nothing was filtered out", () => {
    const t = effectiveTarget({ matched, total: 3, selected: new Set() });
    expect(t.from).toBe("all");
  });

  it("lets ticks win outright once any row is ticked", () => {
    const t = effectiveTarget({ matched, total: 10, selected: new Set(["b"]) });
    expect(t).toEqual({ ids: ["b"], from: "ticked" });
  });

  it("keeps ticks the filter no longer shows", () => {
    // Selection deliberately survives a filter change — search SKSE, tick
    // three, search ENB, tick two, act on five. Intersecting with the current
    // filter would silently drop the first three.
    const t = effectiveTarget({
      matched: ["a"],
      total: 10,
      selected: new Set(["a", "off-screen"]),
    });
    expect(t.ids).toHaveLength(2);
    expect(t.ids).toContain("off-screen");
  });

  it("lists visible ticks first, so acting matches reading", () => {
    const t = effectiveTarget({
      matched: ["a", "b"],
      total: 10,
      selected: new Set(["gone", "b", "a"]),
    });
    expect(t.ids).toEqual(["a", "b", "gone"]);
  });

  it("acts on nothing when nothing matched and nothing is ticked", () => {
    const t = effectiveTarget({ matched: [], total: 10, selected: new Set() });
    expect(t).toEqual({ ids: [], from: "filtered" });
  });
});

describe("how the button words it", () => {
  it("names the basis, not just the count", () => {
    expect(
      describeTarget({ ids: ["a", "b"], from: "ticked" }, "mod"),
    ).toBe("2 ticked mods");
    expect(
      describeTarget({ ids: ["a", "b"], from: "filtered" }, "mod"),
    ).toBe("2 filtered mods");
    expect(describeTarget({ ids: ["a", "b"], from: "all" }, "mod")).toBe("2 mods");
  });

  it("does not say '1 mods'", () => {
    expect(describeTarget({ ids: ["a"], from: "all" }, "mod")).toBe("1 mod");
  });
});
