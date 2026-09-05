/**
 * ──────────────────────────────────────────────────────────────────────
 * Update many mods without losing files, which means one at a time.
 *
 * Vortex ships a bulk update and it drops files. The mechanism is not exotic:
 * it starts several installs concurrently, and Vortex's own installer is not
 * safe against that — a mod comes out with a folder half-written and nothing
 * anywhere says so. The install driver in this project has been sequential
 * from the start for exactly that reason, and this is the same property
 * applied to updating.
 *
 * So SEQUENCE IS THE FEATURE. Not a performance choice to revisit when someone
 * notices it is slower than Vortex's — the slowness is the correctness. The
 * test that matters here records when each step starts and ends and asserts no
 * two ever overlap.
 *
 * ─── AND EVERY UPDATE IS CHECKED BEFORE THE NEXT ONE STARTS ────────────
 * A file dropped during install is invisible: the mod is present, the version
 * is right, and the missing file only surfaces as a crash hours into a game.
 * So after each mod is updated its staging folder is compared against what its
 * archive says should be there — and for a FOMOD, against the file set its
 * script produces for the choices Vortex recorded. That check already exists
 * (`selfCheckMod`) and is injected here rather than reimplemented.
 *
 * Checking BEFORE moving on is deliberate. A batch that verifies at the end
 * tells the curator that something in the last forty mods lost files; a batch
 * that verifies each tells them which mod, while the archive it came from is
 * still the obvious next thing to try.
 *
 * ─── ONE FAILURE DOES NOT END THE RUN ──────────────────────────────────
 * These are unrelated mods. Abandoning thirty because the fourth failed would
 * turn one bad archive into an afternoon, and the curator can act on a list of
 * three failures as easily as on one.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { CuratorMod, UpdateCandidate } from "./profileActions";
import { runSequentially } from "./runSequentially";

/** What happened to one mod. */
export type UpdateOutcome =
  /** Updated, and its files match what the archive should have produced. */
  | { kind: "updated"; mod: CuratorMod }
  /**
   * Updated, but files the archive contains are NOT on disk.
   *
   * The exact failure Vortex's own bulk update produces silently. Named
   * loudly, with the files, because "some mods may have issues" is not
   * something a curator can act on.
   */
  | { kind: "files-dropped"; mod: CuratorMod; missing: string[] }
  /** The update itself failed. The mod is whatever it was before. */
  | { kind: "failed"; mod: CuratorMod; why: string }
  /**
   * Updated, and we could not tell whether anything was lost.
   *
   * No archive to compare against, or a FOMOD whose script could not be
   * replayed. Distinct from `updated` on purpose: "not checked" is not "fine",
   * and a run that reported it as fine would be making a promise it never
   * tested.
   */
  | { kind: "unverified"; mod: CuratorMod; why: string };

export type BulkUpdateReport = {
  outcomes: UpdateOutcome[];
  /** True when the curator stopped it; the remaining mods were not touched. */
  cancelled: boolean;
};

/** The check run after each update. Injected so the engine stays testable. */
export type VerifyUpdated = (mod: CuratorMod) => Promise<
  | { kind: "ok" }
  | { kind: "missing"; missing: string[] }
  | { kind: "cannot-check"; why: string }
>;

export type BulkUpdateInput = {
  candidates: readonly UpdateCandidate[];
  /**
   * Perform ONE update and resolve when Vortex has finished installing it.
   *
   * Resolving early is the whole hazard this module exists to avoid, so the
   * edge that implements this must wait for the install to complete rather
   * than for the request to be accepted.
   */
  update: (candidate: UpdateCandidate) => Promise<void>;
  verify: VerifyUpdated;
  onProgress?: (done: number, total: number, mod: CuratorMod) => void;
  signal?: AbortSignal;
};

/**
 * Update every candidate, in order, checking each before starting the next.
 *
 * Never throws for one mod's problem: the report carries what happened to all
 * of them.
 */
export async function runBulkUpdate(
  input: BulkUpdateInput,
): Promise<BulkUpdateReport> {
  const report = await runSequentially<UpdateCandidate>({
    items: input.candidates,
    act: input.update,
    verify: (c) => input.verify(c.mod),
    ...(input.onProgress !== undefined
      ? {
          onProgress: (done, total, c) =>
            input.onProgress!(done, total, c.mod),
        }
      : {}),
    ...(input.signal !== undefined ? { signal: input.signal } : {}),
  });
  return {
    cancelled: report.cancelled,
    outcomes: report.outcomes.map((o): UpdateOutcome => {
      if (o.kind === "done") return { kind: "updated", mod: o.item.mod };
      if (o.kind === "files-dropped") {
        return { kind: "files-dropped", mod: o.item.mod, missing: o.missing };
      }
      if (o.kind === "failed") {
        return { kind: "failed", mod: o.item.mod, why: o.why };
      }
      return { kind: "unverified", mod: o.item.mod, why: o.why };
    }),
  };
}

/**
 * What the curator is told afterwards.
 *
 * Dropped files come first and are never folded into a total. A run that says
 * "38 updated, 2 issues" invites reading the 38 and moving on, which is how
 * the silent failure stays silent.
 */
export function describeBulkUpdate(report: BulkUpdateReport): string[] {
  const by = (k: UpdateOutcome["kind"]): UpdateOutcome[] =>
    report.outcomes.filter((o) => o.kind === k);

  const lines: string[] = [];
  const dropped = by("files-dropped");
  for (const outcome of dropped) {
    if (outcome.kind !== "files-dropped") continue;
    const shown = outcome.missing.slice(0, 4).join(", ");
    const more =
      outcome.missing.length > 4
        ? ` and ${outcome.missing.length - 4} more`
        : "";
    lines.push(
      `"${outcome.mod.name}" LOST ${outcome.missing.length} file(s) during ` +
        `install — its archive contains them and they are not on disk: ` +
        `${shown}${more}. Reinstall this mod before shipping anything.`,
    );
  }

  for (const outcome of by("failed")) {
    if (outcome.kind !== "failed") continue;
    lines.push(`"${outcome.mod.name}" did not update: ${outcome.why}`);
  }

  const unverified = by("unverified");
  if (unverified.length > 0) {
    const names = unverified
      .slice(0, 3)
      .map((o) => `"${o.mod.name}"`)
      .join(", ");
    lines.push(
      `${unverified.length} mod(s) updated but could NOT be checked for lost ` +
        `files (${names}) — no archive to compare against, or a FOMOD whose ` +
        `script could not be replayed. Not checked is not the same as fine.`,
    );
  }

  const ok = by("updated").length;
  lines.push(
    ok === 0
      ? "No mods updated cleanly."
      : `${ok} mod(s) updated and verified against their archives.`,
  );
  if (report.cancelled) {
    lines.push("Stopped early — the remaining mods were left alone.");
  }
  return lines;
}
