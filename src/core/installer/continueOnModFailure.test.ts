/**
 * One dead Nexus link must not cost the user every mod after it.
 *
 * From two of bluuuk's logs, the same failure at the same index both times:
 *
 *   install.mod.failed  i=274  total=967
 *   "Nexus download for modId=98669, fileId=375818 returned no archiveId."
 *
 * The driver returned on that first per-mod failure, so 693 mods that would
 * have installed fine never got the chance — and re-running hit the same wall
 * at the same index, forever. The file had been pulled from Nexus; nothing the
 * user or the curator could do would make mod 274 succeed.
 *
 * These are the properties, expressed against the real shapes rather than
 * against the driver (which needs a live Vortex): isolated failures accumulate
 * and the run goes on, a STREAK stops it because the cause is no longer the
 * mod, and a partial reproduction never claims success.
 */
import { describe, expect, it } from "vitest";

import type { FailedModReportEntry } from "../../types/installDriver";

/**
 * The driver's loop policy, extracted so it can be exercised without a live
 * Vortex. Mirrors runInstall's installing-mods loop: collect, count the
 * streak, bail at the threshold, reset on any success.
 */
function runLoop(
  outcomes: Array<"ok" | "fail">,
  streakLimit = 8,
): { installed: number; failed: FailedModReportEntry[]; stoppedEarly: boolean } {
  const failed: FailedModReportEntry[] = [];
  let installed = 0;
  let streak = 0;
  for (const [i, outcome] of outcomes.entries()) {
    if (outcome === "fail") {
      failed.push({
        compareKey: `k${i}`,
        name: `Mod ${i}`,
        decision: "nexus-download",
        error: "returned no archiveId",
      });
      streak += 1;
      if (streak >= streakLimit) return { installed, failed, stoppedEarly: true };
      continue;
    }
    installed += 1;
    streak = 0;
  }
  return { installed, failed, stoppedEarly: false };
}

describe("per-mod failures do not end the run", () => {
  it("installs the other 693 when one mod's file is gone", () => {
    // 967 mods, exactly one bad — bluuuk's actual shape.
    const outcomes = Array.from({ length: 967 }, (_, i) =>
      i === 273 ? ("fail" as const) : ("ok" as const),
    );
    const r = runLoop(outcomes);
    expect(r.stoppedEarly).toBe(false);
    expect(r.failed).toHaveLength(1);
    // The number that matters: before this change it was 273.
    expect(r.installed).toBe(966);
  });

  it("records every failure, not just the first", () => {
    const r = runLoop(["ok", "fail", "ok", "fail", "ok"]);
    expect(r.failed.map((f) => f.name)).toEqual(["Mod 1", "Mod 3"]);
    expect(r.installed).toBe(3);
  });

  it("stops on a streak, because that is no longer one bad mod", () => {
    // A dead extractor or a lost connection fails everything in turn.
    // Grinding through 900 identical failures helps nobody.
    const r = runLoop(Array.from({ length: 500 }, () => "fail" as const));
    expect(r.stoppedEarly).toBe(true);
    expect(r.failed).toHaveLength(8);
  });

  it("resets the streak on any success, so scattered failures never trip it", () => {
    // 7 fails, one success, 7 more fails: 14 failures but never 8 in a row.
    const outcomes: Array<"ok" | "fail"> = [
      ...Array.from({ length: 7 }, () => "fail" as const),
      "ok",
      ...Array.from({ length: 7 }, () => "fail" as const),
    ];
    const r = runLoop(outcomes);
    expect(r.stoppedEarly).toBe(false);
    expect(r.failed).toHaveLength(14);
  });

  it("trips exactly at the threshold, not before", () => {
    expect(runLoop(Array.from({ length: 7 }, () => "fail" as const)).stoppedEarly)
      .toBe(false);
    expect(runLoop(Array.from({ length: 8 }, () => "fail" as const)).stoppedEarly)
      .toBe(true);
  });
});
