/**
 * ──────────────────────────────────────────────────────────────────────
 * Do a list of things to mods, one at a time, checking each before the next.
 *
 * Extracted because there are now two callers — bulk update and bulk reinstall
 * — and "sequence is the feature" is not a property that survives being
 * written twice. A second copy is a second place for someone to decide the
 * loop would be faster with `Promise.all`, which is precisely the change that
 * makes Vortex's own bulk update lose files.
 *
 * The `await` between `act` and the next iteration IS the guarantee. Verifying
 * between rather than at the end is the other half: a batch that checks
 * afterwards can only say something in the last forty mods lost files, while
 * one that checks between says which, with its archive still to hand.
 * ──────────────────────────────────────────────────────────────────────
 */

import { ehLog } from "../logging/ehLog";

/** The check run after each step. Injected so the loop stays testable. */
export type StepVerify<T> = (item: T) => Promise<
  | { kind: "ok" }
  | { kind: "missing"; missing: string[] }
  | { kind: "cannot-check"; why: string }
>;

export type StepOutcome<T> =
  /** Done, and its files match what the archive should have produced. */
  | { kind: "done"; item: T }
  /**
   * Done, but files the archive contains are NOT on disk.
   *
   * The failure Vortex's own bulk operations produce silently.
   */
  | { kind: "files-dropped"; item: T; missing: string[] }
  /** The action failed. The mod is whatever it was before. */
  | { kind: "failed"; item: T; why: string }
  /**
   * Done, and we could not tell whether anything was lost.
   *
   * Kept apart from `done` because "not checked" is not "fine", and a report
   * that merged them would make a promise it never tested.
   */
  | { kind: "unverified"; item: T; why: string };

export type SequentialReport<T> = {
  outcomes: StepOutcome<T>[];
  /** True when the curator stopped it; the remaining items were not touched. */
  cancelled: boolean;
};

export async function runSequentially<T>(input: {
  items: readonly T[];
  act: (item: T) => Promise<void>;
  verify: StepVerify<T>;
  onProgress?: (done: number, total: number, item: T) => void;
  signal?: AbortSignal;
}): Promise<SequentialReport<T>> {
  const { items, act, verify, onProgress, signal } = input;
  const outcomes: StepOutcome<T>[] = [];

  /**
   * Named for the log, not for the screen.
   *
   * Every bulk action a curator can start runs through here, and none of them
   * wrote a line anywhere: a run that did nothing at all was indistinguishable
   * from one that worked, and the only way to tell was to read Vortex's log
   * and find it empty too. That is not a diagnosis anyone should have to make,
   * least of all a user reporting a problem from another machine.
   */
  const label = (item: T): string => {
    const named = item as { name?: unknown; mod?: { name?: unknown } };
    if (typeof named.name === "string") return named.name;
    if (typeof named.mod?.name === "string") return named.mod.name;
    return "(unnamed)";
  };

  const startedAt = Date.now();
  ehLog("info", "sequential.start", { items: items.length });

  let done = 0;
  for (const item of items) {
    if (signal?.aborted === true) {
      ehLog("info", "sequential.cancelled", { done, of: items.length });
      return { outcomes, cancelled: true };
    }
    onProgress?.(done, items.length, item);
    ehLog("debug", "sequential.item.start", {
      n: done + 1,
      of: items.length,
      item: label(item),
    });

    try {
      // Everything below happens after this one has finished, and the next
      // iteration cannot begin until it has.
      await act(item);
    } catch (err) {
      ehLog("warn", "sequential.item.failed", { item: label(item), err });
      outcomes.push({
        kind: "failed",
        item,
        why: err instanceof Error ? err.message : String(err),
      });
      done += 1;
      continue;
    }

    try {
      const checked = await verify(item);
      if (checked.kind === "ok") {
        ehLog("debug", "sequential.item.ok", { item: label(item) });
        outcomes.push({ kind: "done", item });
      } else if (checked.kind === "missing") {
        // The reason this loop is sequential at all. Loud on purpose.
        ehLog("warn", "sequential.item.files-dropped", {
          item: label(item),
          missing: checked.missing.length,
          examples: checked.missing.slice(0, 5),
        });
        outcomes.push({ kind: "files-dropped", item, missing: checked.missing });
      } else {
        ehLog("info", "sequential.item.unverified", {
          item: label(item),
          why: checked.why,
        });
        outcomes.push({ kind: "unverified", item, why: checked.why });
      }
    } catch (err) {
      // A check that threw is a check that did not happen. Reporting the item
      // as done here would be the one lie this loop exists to prevent.
      outcomes.push({
        kind: "unverified",
        item,
        why: err instanceof Error ? err.message : String(err),
      });
    }
    done += 1;
  }

  if (items.length > 0) onProgress?.(done, items.length, items[items.length - 1]!);
  ehLog("info", "sequential.done", {
    ms: Date.now() - startedAt,
    items: items.length,
    outcomes: outcomes.reduce<Record<string, number>>((acc, o) => {
      acc[o.kind] = (acc[o.kind] ?? 0) + 1;
      return acc;
    }, {}),
  });
  return { outcomes, cancelled: false };
}
