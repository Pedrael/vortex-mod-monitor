/**
 * ──────────────────────────────────────────────────────────────────────
 * A sortable, filterable table — because a curator's profile is 1,900 mods.
 *
 * Every list on the curator page was a flat stack of rows: no sort, no
 * search, and in the updates list a silent `slice(0, 40)`. On a real profile
 * that is unreadable, and the truncation was worse than unreadable — the
 * heading said 212 and the list showed 40 with nothing admitting it.
 *
 * The decisions live in `tableView.ts` and are tested without a DOM. This is
 * the rendering, and the two things it is careful about are:
 *
 * ─── SELECT ALL MEANS ALL THAT MATCHED ─────────────────────────────────
 * Not the whole profile, and not the visible slice. A curator filters to
 * narrow down and then ticks the result; selecting the 100 rows that fit on
 * screen out of 340 matches would be a silent partial act, and selecting all
 * 1,900 would be the opposite kind of surprise. The button says the number.
 *
 * ─── UNTICKING A FILTER DOES NOT UNTICK A ROW ──────────────────────────
 * Selection is held by the caller, keyed on mod id, and survives the filter
 * changing. A curator can search "SKSE", tick three, search "ENB", tick two,
 * and act on five. The header count is what says how many are really held,
 * because they are not all on screen.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as React from "react";

import {
  applyTableView,
  describeTableView,
  distinctValues,
  type CellValue,
  type ColumnSpec,
  type SortState,
  type ViewRow,
} from "./tableView";

export type Column<T> = ColumnSpec & {
  /** The value that sorts and filters. Keep it plain — text or a number. */
  value: (row: T) => CellValue;
  /** Optional richer rendering. Falls back to the value itself. */
  render?: (row: T) => React.ReactNode;
};

const cellStyle: React.CSSProperties = {
  padding: "var(--eh-sp-1) var(--eh-sp-2)",
  borderTop: "1px solid var(--eh-border-subtle)",
  verticalAlign: "middle",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const headStyle: React.CSSProperties = {
  padding: "var(--eh-sp-1) var(--eh-sp-2)",
  textAlign: "left",
  fontSize: "var(--eh-text-xs)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--eh-text-muted)",
  background: "var(--eh-bg-raised)",
  position: "sticky",
  top: 0,
  zIndex: 1,
  whiteSpace: "nowrap",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--eh-bg-deep)",
  border: "1px solid var(--eh-border-default)",
  borderRadius: "var(--eh-radius-sm)",
  color: "var(--eh-text-primary)",
  padding: "2px var(--eh-sp-1)",
  fontSize: "var(--eh-text-xs)",
  fontFamily: "var(--eh-font-mono)",
};

/** Click a header: ascending, then descending, then back to no sort. */
function nextSort(current: SortState | undefined, key: string): SortState | undefined {
  if (current === undefined || current.key !== key) return { key, direction: "asc" };
  if (current.direction === "asc") return { key, direction: "desc" };
  return undefined;
}

export function DataTable<T>(props: {
  rows: readonly T[];
  idOf: (row: T) => string;
  columns: readonly Column<T>[];
  /** How many rows to render at once. The banner always says the real count. */
  limit?: number;
  /** What one row is called, for the banner. */
  noun?: string;
  /** Shown instead of the table when there is nothing at all. */
  empty?: React.ReactNode;
  /** Tick boxes. The set is the caller's; it survives filter changes. */
  selection?: {
    selected: ReadonlySet<string>;
    onChange: (next: ReadonlySet<string>) => void;
  };
  /** A trailing cell of buttons for one row. */
  actions?: (row: T) => React.ReactNode;
  maxHeight?: number;
}): JSX.Element {
  const { rows, idOf, columns, selection, actions } = props;
  const noun = props.noun ?? "item";

  const [filters, setFilters] = React.useState<Record<string, string>>({});
  const [sort, setSort] = React.useState<SortState | undefined>(undefined);
  const [showAll, setShowAll] = React.useState(false);

  // Project once per change of the data, not once per keystroke of a filter.
  const { viewRows, byId } = React.useMemo(() => {
    const byId = new Map<string, T>();
    const viewRows: ViewRow[] = rows.map((row) => {
      const id = idOf(row);
      byId.set(id, row);
      const values: Record<string, CellValue> = {};
      for (const col of columns) values[col.key] = col.value(row);
      return { id, values };
    });
    return { viewRows, byId };
  }, [rows, idOf, columns]);

  const view = React.useMemo(
    () =>
      applyTableView({
        rows: viewRows,
        columns,
        filters,
        sort,
        limit: showAll ? undefined : props.limit,
      }),
    [viewRows, columns, filters, sort, showAll, props.limit],
  );

  const matchedIds = React.useMemo(() => {
    // Everything the filter kept — including rows the cap left unrendered,
    // which is what "select all" has to mean for the number to be honest.
    const full = applyTableView({ rows: viewRows, columns, filters });
    return full.rows.map((r) => r.id);
  }, [viewRows, columns, filters]);

  const allMatchedSelected =
    selection !== undefined &&
    matchedIds.length > 0 &&
    matchedIds.every((id) => selection.selected.has(id));

  const filtersOn = Object.values(filters).some((v) => v.trim() !== "");

  /**
   * What the header checkbox actually does, said in full.
   *
   * It ticks everything the filter matched — which is more than is on screen
   * whenever the cap is in play, and less than the profile whenever a filter
   * is. Both numbers matter, so the label names the one that applies rather
   * than saying "this filter matched" over a table with no filter on it.
   */
  const selectAllLabel = `${
    allMatchedSelected ? "Untick" : "Tick"
  } all ${matchedIds.length.toLocaleString()} ${noun}(s)${
    filtersOn ? " matching these filters" : " in this list"
  }`;

  if (rows.length === 0 && props.empty !== undefined) {
    return <>{props.empty}</>;
  }

  const toggleRow = (id: string): void => {
    if (selection === undefined) return;
    const next = new Set(selection.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selection.onChange(next);
  };

  const toggleAllMatched = (): void => {
    if (selection === undefined) return;
    const next = new Set(selection.selected);
    if (allMatchedSelected) for (const id of matchedIds) next.delete(id);
    else for (const id of matchedIds) next.add(id);
    selection.onChange(next);
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--eh-sp-2)",
          marginBottom: "var(--eh-sp-1)",
          fontSize: "var(--eh-text-xs)",
          color: "var(--eh-text-secondary)",
          flexWrap: "wrap",
        }}
      >
        <span>{describeTableView(view, noun)}</span>
        {filtersOn && (
          <button
            type="button"
            onClick={(): void => setFilters({})}
            style={{
              background: "none",
              border: "none",
              color: "var(--eh-accent)",
              cursor: "pointer",
              padding: 0,
              font: "inherit",
            }}
          >
            Clear filters
          </button>
        )}
        {view.capped && (
          <button
            type="button"
            onClick={(): void => setShowAll(true)}
            style={{
              background: "none",
              border: "none",
              color: "var(--eh-accent)",
              cursor: "pointer",
              padding: 0,
              font: "inherit",
            }}
          >
            Show all {view.matched.toLocaleString()}
          </button>
        )}
        {selection !== undefined && selection.selected.size > 0 && (
          <span style={{ color: "var(--eh-text-muted)" }}>
            {selection.selected.size.toLocaleString()} ticked
            {filtersOn ? " (some may be outside this filter)" : ""}
          </span>
        )}
      </div>

      <div
        style={{
          maxHeight: props.maxHeight ?? 420,
          overflow: "auto",
          border: "1px solid var(--eh-border-default)",
          borderRadius: "var(--eh-radius-md)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            fontSize: "var(--eh-text-sm)",
          }}
        >
          <thead>
            <tr>
              {selection !== undefined && (
                <th style={{ ...headStyle, width: 32 }}>
                  <input
                    type="checkbox"
                    aria-label={selectAllLabel}
                    title={selectAllLabel}
                    checked={allMatchedSelected}
                    onChange={toggleAllMatched}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    ...headStyle,
                    ...(col.width !== undefined ? { width: col.width } : {}),
                    textAlign: col.align ?? "left",
                    cursor: col.sortable === false ? "default" : "pointer",
                  }}
                  onClick={
                    col.sortable === false
                      ? undefined
                      : (): void => setSort((s) => nextSort(s, col.key))
                  }
                >
                  {col.header}
                  {sort?.key === col.key && (sort.direction === "asc" ? " ▲" : " ▼")}
                </th>
              ))}
              {actions !== undefined && <th style={headStyle} />}
            </tr>
            <tr>
              {selection !== undefined && <th style={{ ...headStyle, top: 26 }} />}
              {columns.map((col) => (
                <th key={col.key} style={{ ...headStyle, top: 26 }}>
                  {col.filterable === false ? null : col.match === "exact" ? (
                    <select
                      aria-label={`Filter by ${col.header}`}
                      value={filters[col.key] ?? ""}
                      onChange={(e): void =>
                        setFilters((f) => ({ ...f, [col.key]: e.target.value }))
                      }
                      style={inputStyle}
                    >
                      <option value="">all</option>
                      {distinctValues(viewRows, col.key).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      aria-label={`Filter by ${col.header}`}
                      placeholder="filter"
                      value={filters[col.key] ?? ""}
                      onChange={(e): void =>
                        setFilters((f) => ({ ...f, [col.key]: e.target.value }))
                      }
                      style={inputStyle}
                    />
                  )}
                </th>
              ))}
              {actions !== undefined && <th style={{ ...headStyle, top: 26 }} />}
            </tr>
          </thead>
          <tbody>
            {view.rows.length === 0 && (
              <tr>
                <td
                  colSpan={
                    columns.length +
                    (selection !== undefined ? 1 : 0) +
                    (actions !== undefined ? 1 : 0)
                  }
                  style={{ ...cellStyle, color: "var(--eh-text-secondary)" }}
                >
                  {`No ${noun} matches these filters.`}
                </td>
              </tr>
            )}
            {view.rows.map((viewRow) => {
              const row = byId.get(viewRow.id)!;
              return (
                <tr key={viewRow.id}>
                  {selection !== undefined && (
                    <td style={{ ...cellStyle, width: 32 }}>
                      <input
                        type="checkbox"
                        checked={selection.selected.has(viewRow.id)}
                        onChange={(): void => toggleRow(viewRow.id)}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{ ...cellStyle, textAlign: col.align ?? "left" }}
                      title={
                        viewRow.values[col.key] === undefined
                          ? undefined
                          : String(viewRow.values[col.key])
                      }
                    >
                      {col.render !== undefined
                        ? col.render(row)
                        : (viewRow.values[col.key] ?? "—")}
                    </td>
                  ))}
                  {actions !== undefined && (
                    <td style={{ ...cellStyle, textAlign: "right" }}>
                      {actions(row)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
