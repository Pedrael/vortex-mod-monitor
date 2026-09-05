/**
 * ──────────────────────────────────────────────────────────────────────
 * Filtering and sorting for a table, decided without a DOM.
 *
 * A curator's profile is nineteen hundred mods. Every list on the curator
 * page rendered as a flat column of rows, and the updates list did something
 * worse than that: `slice(0, 40)`. Forty of however many, with nothing on
 * screen saying so — the curator reads "Updates available (212)", counts
 * forty, and has no way to know which hundred and seventy-two were hidden.
 *
 * So the row cap survives here, because rendering two thousand rows is real,
 * but `matched` is always the true count and `capped` says the list is short.
 * A truncation the reader can see is a scrollbar; one they cannot is a lie.
 *
 * ─── SORTING IS PRESENTATION, AND NEVER A DECISION ─────────────────────
 * Text sorting is numeric-aware, so "1.9" lands before "1.10" instead of
 * after it. That is the right order to READ and the wrong basis to act on:
 * authors write "v2", "2.0.1a", "1.0-RC3" and dates, and no collation over
 * those settles which file is newer. Whether an update exists is decided in
 * `profileActions` by comparing Nexus file ids, which are integers. Nothing
 * here may be fed back into that.
 *
 * ─── AN UNKNOWN VALUE IS NOT A SMALL ONE ───────────────────────────────
 * A mod with no version is not below every version, and a mod whose size we
 * never measured is not zero bytes. Undefined sorts LAST in both directions
 * and matches no filter query, so a search never quietly includes rows whose
 * value nobody knows.
 * ──────────────────────────────────────────────────────────────────────
 */

/** What one cell holds. `undefined` means "not known", never "empty". */
export type CellValue = string | number | undefined;

/** One row, already projected down to the values the table shows. */
export type ViewRow = {
  /** Stable identity — Vortex's mod id, an archive id, a group key. */
  id: string;
  values: Readonly<Record<string, CellValue>>;
};

export type ColumnSpec = {
  key: string;
  header: string;
  /**
   * How this column's filter box matches.
   *
   * `substring` for free text; `exact` for a column whose filter is a
   * dropdown of the values actually present, where a substring would make
   * "no" match nothing and "enabled" match "not enabled".
   */
  match?: "substring" | "exact";
  /** Compare as a number rather than as text. */
  numeric?: boolean;
  align?: "left" | "right";
  /** Suppress the filter box for a column that is not worth searching. */
  filterable?: boolean;
  sortable?: boolean;
  /** Fixed width in px, when the content is a known shape. */
  width?: number;
};

export type SortState = { key: string; direction: "asc" | "desc" };

export type TableView = {
  /** The rows to render — already filtered, sorted and capped. */
  rows: ViewRow[];
  /** Every row that exists, before any filter. */
  total: number;
  /** Rows the filters kept. The honest denominator for "showing N of M". */
  matched: number;
  /** True when `rows.length < matched` because of the cap. */
  capped: boolean;
};

/** Lowercased text of a cell, or undefined when the cell holds nothing. */
function text(value: CellValue): string | undefined {
  if (value === undefined) return undefined;
  return String(value).toLowerCase();
}

/**
 * Does one cell satisfy one filter query?
 *
 * An empty or whitespace-only query filters nothing — a cleared box must
 * restore the full list, not match rows whose value happens to be blank.
 */
export function matchesFilter(
  value: CellValue,
  query: string,
  mode: "substring" | "exact" = "substring",
): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  const hay = text(value);
  // An unknown value matches nothing. Including it would make a search read
  // as "these are the matches" while listing rows that were never checked.
  if (hay === undefined) return false;
  return mode === "exact" ? hay === needle : hay.includes(needle);
}

/**
 * A cell reduced to something comparable, or `undefined` if it is not.
 *
 * A column declared numeric can still hold text Vortex never parsed, and that
 * is an unknown in exactly the same sense as a missing value.
 */
function comparable(
  value: CellValue,
  numeric: boolean,
): string | number | undefined {
  if (value === undefined) return undefined;
  if (!numeric) return String(value);
  const n = typeof value === "number" ? value : Number(value);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Compare two cells for display order in a given direction.
 *
 * The direction is an argument rather than a sign the caller applies
 * afterwards, and that is the whole point: unknowns must sort LAST in BOTH
 * directions, which is impossible if the caller multiplies the result. The
 * first version of this did exactly that, and clicking a column twice
 * promoted every row whose value nobody knew to the top of the list.
 */
export function compareForSort(
  a: CellValue,
  b: CellValue,
  numeric: boolean,
  direction: "asc" | "desc",
): number {
  const ka = comparable(a, numeric);
  const kb = comparable(b, numeric);
  if (ka === undefined || kb === undefined) {
    if (ka === undefined && kb === undefined) return 0;
    return ka === undefined ? 1 : -1;
  }
  const cmp =
    typeof ka === "number" && typeof kb === "number"
      ? ka - kb
      : String(ka).localeCompare(String(kb), undefined, {
          numeric: true,
          sensitivity: "base",
        });
  return cmp * (direction === "asc" ? 1 : -1);
}

/** Ascending comparison of two cells. Unknowns last. */
export function compareCells(
  a: CellValue,
  b: CellValue,
  numeric: boolean,
): number {
  return compareForSort(a, b, numeric, "asc");
}

/** The values actually present in one column, for a dropdown filter. */
export function distinctValues(
  rows: readonly ViewRow[],
  key: string,
): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const value = row.values[key];
    if (value === undefined) continue;
    seen.add(String(value));
  }
  return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/**
 * Filter, sort and cap — the whole view in one pure call.
 *
 * `limit` of 0 or undefined means no cap.
 */
export function applyTableView(args: {
  rows: readonly ViewRow[];
  columns: readonly ColumnSpec[];
  /** Column key → what the curator typed. Absent or blank means no filter. */
  filters: Readonly<Record<string, string>>;
  sort?: SortState | undefined;
  limit?: number | undefined;
}): TableView {
  const { rows, columns, filters, sort, limit } = args;
  const byKey = new Map(columns.map((c) => [c.key, c] as const));

  const active = Object.entries(filters).filter(([, q]) => q.trim() !== "");

  const matched = rows.filter((row) =>
    // Every filter must hold: two boxes narrow, they do not widen.
    active.every(([key, query]) =>
      matchesFilter(row.values[key], query, byKey.get(key)?.match ?? "substring"),
    ),
  );

  // Decorate-sort-undecorate: ties fall back to the original index, so equal
  // rows keep the order they arrived in rather than an arbitrary one.
  const ordered =
    sort === undefined
      ? matched
      : matched
          .map((row, index) => ({ row, index }))
          .sort((x, y) => {
            const cmp = compareForSort(
              x.row.values[sort.key],
              y.row.values[sort.key],
              byKey.get(sort.key)?.numeric === true,
              sort.direction,
            );
            return cmp !== 0 ? cmp : x.index - y.index;
          })
          .map((d) => d.row);

  const capped = limit !== undefined && limit > 0 && ordered.length > limit;
  return {
    rows: capped ? ordered.slice(0, limit) : ordered,
    total: rows.length,
    matched: ordered.length,
    capped,
  };
}

/**
 * The line above the table.
 *
 * Always says both numbers when they differ, so a filtered or capped list
 * can never be mistaken for the whole one.
 */
export function describeTableView(view: TableView, noun = "item"): string {
  const plural = `${noun}${view.total === 1 ? "" : "s"}`;
  if (view.matched === view.total && !view.capped) {
    return `${view.total.toLocaleString()} ${plural}`;
  }
  const head =
    view.matched === view.total
      ? `${view.total.toLocaleString()} ${plural}`
      : `Filtered: ${view.matched.toLocaleString()} of ${view.total.toLocaleString()} ${plural}`;
  return view.capped
    ? `${head} — showing the first ${view.rows.length.toLocaleString()}`
    : head;
}

/**
 * ──────────────────────────────────────────────────────────────────────
 * What a button above a table actually acts on.
 *
 * "Update 126 mod(s)" over a table filtered down to 80 is a lie, and it is
 * the dangerous kind: the curator narrowed the list precisely because they
 * did not want the other 46, and the button ignored them.
 *
 * ─── TICKS WIN, EVEN THE ONES OFF SCREEN ───────────────────────────────
 * Selection deliberately survives a filter change — search SKSE, tick three,
 * search ENB, tick two, act on five — so a target derived from "ticked AND
 * currently visible" would silently drop the first three. If anything is
 * ticked, the ticks ARE the target, whole.
 *
 * With nothing ticked the target is what the filters matched, which is what
 * the curator is looking at. `from` distinguishes the three cases so the
 * button can name which one it is; a button that says "80" without saying
 * why is the same ambiguity one number further along.
 * ──────────────────────────────────────────────────────────────────────
 */
export type TargetSet = {
  ids: string[];
  /** `ticked` — explicit picks. `filtered` — the narrowed list. `all` — everything. */
  from: "ticked" | "filtered" | "all";
};

export function effectiveTarget(args: {
  /** Ids the filters kept, in display order. */
  matched: readonly string[];
  /** How many rows exist before filtering. */
  total: number;
  selected: ReadonlySet<string>;
}): TargetSet {
  const { matched, total, selected } = args;
  if (selected.size > 0) {
    // Display order where we have it, so acting matches reading; ticks that
    // no longer match the filter still count, and follow after.
    const inOrder = matched.filter((id) => selected.has(id));
    const offScreen = [...selected].filter((id) => !inOrder.includes(id));
    return { ids: [...inOrder, ...offScreen], from: "ticked" };
  }
  return {
    ids: [...matched],
    from: matched.length < total ? "filtered" : "all",
  };
}

/**
 * The target as a button says it.
 *
 * Names the basis, not just the count — "80 filtered mods" and "80 mods" are
 * different claims about what happens next.
 */
export function describeTarget(target: TargetSet, noun = "item"): string {
  const n = target.ids.length.toLocaleString();
  const word = `${noun}${target.ids.length === 1 ? "" : "s"}`;
  if (target.from === "ticked") return `${n} ticked ${word}`;
  if (target.from === "filtered") return `${n} filtered ${word}`;
  return `${n} ${word}`;
}
