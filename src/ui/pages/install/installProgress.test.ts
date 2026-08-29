/**
 * The failure this guards against is an estimate that is confidently wrong in
 * the reassuring direction — "about 4 minutes" on a run with three hours left.
 * Someone reads that, goes to make coffee, comes back, and now distrusts every
 * number on the screen.
 *
 * So most of these assert that NO estimate is produced: wrong phase, too few
 * samples, too little elapsed time, a phase transition that reset the counter.
 */
import { describe, expect, it } from "vitest";

import {
  describeElapsed,
  describeQuiet,
  estimateRemainingMs,
  formatDuration,
  trackPhase,
} from "./installProgress";
import type { PhaseTiming } from "./installProgress";

const MIN = 60_000;

const timing = (over: Partial<PhaseTiming> = {}): PhaseTiming => ({
  phase: "installing-mods",
  startedAtMs: 0,
  lastBeatAtMs: 0,
  step: 100,
  ...over,
});

describe("trackPhase", () => {
  it("starts a baseline on the first beat", () => {
    const t = trackPhase(undefined, { phase: "installing-mods", currentStep: 1 }, 500);
    expect(t).toEqual({
      phase: "installing-mods",
      startedAtMs: 500,
      lastBeatAtMs: 500,
      step: 1,
    });
  });

  it("keeps the start time and advances the last beat within a phase", () => {
    const first = trackPhase(undefined, { phase: "installing-mods", currentStep: 1 }, 500);
    const later = trackPhase(first, { phase: "installing-mods", currentStep: 9 }, 9_000);
    expect(later.startedAtMs).toBe(500);
    expect(later.lastBeatAtMs).toBe(9_000);
    expect(later.step).toBe(9);
  });

  it("starts over when the phase changes", () => {
    // The step counters reset at every transition. Carrying the old baseline
    // would divide the new phase's small step count by the whole run's elapsed
    // time — an estimate that is wrong in the reassuring direction.
    // Real phases: "downloading" is not one of them, and a fixture that names
    // a phase the driver cannot emit is testing a transition that never occurs.
    const during = trackPhase(undefined, { phase: "removing-mods", currentStep: 40 }, 1_000);
    const after = trackPhase(during, { phase: "installing-mods", currentStep: 1 }, 60_000);
    expect(after.startedAtMs).toBe(60_000);
    expect(after.step).toBe(1);
  });
});

describe("estimateRemainingMs", () => {
  it("extrapolates from the observed rate", () => {
    // 100 steps in 10 minutes = 6s/step; 900 left ⇒ 90 minutes.
    const out = estimateRemainingMs({
      timing: timing({ startedAtMs: 0, step: 100 }),
      totalSteps: 1000,
      nowMs: 10 * MIN,
    });
    expect(out).toBe(90 * MIN);
  });

  it("gives no estimate outside the mod-install phase", () => {
    // Other phases are short and their step counts are not comparable work.
    expect(
      estimateRemainingMs({
        timing: timing({ phase: "deploying" }),
        totalSteps: 1000,
        nowMs: 10 * MIN,
      }),
    ).toBeUndefined();
  });

  it("gives no estimate from too few samples", () => {
    // The first mods are whatever install order started with — a 2KB patch or
    // a 4GB texture pack. Four of them predict nothing.
    expect(
      estimateRemainingMs({
        timing: timing({ step: 4 }),
        totalSteps: 1000,
        nowMs: 10 * MIN,
      }),
    ).toBeUndefined();
  });

  it("gives no estimate before enough time has passed", () => {
    // Enough samples, but 10 seconds in they were all cache hits.
    expect(
      estimateRemainingMs({
        timing: timing({ step: 50 }),
        totalSteps: 1000,
        nowMs: 10_000,
      }),
    ).toBeUndefined();
  });

  it("gives no estimate when there is no remaining work to describe", () => {
    expect(
      estimateRemainingMs({ timing: timing({ step: 1000 }), totalSteps: 1000, nowMs: 10 * MIN }),
    ).toBeUndefined();
    expect(
      estimateRemainingMs({ timing: timing(), totalSteps: 0, nowMs: 10 * MIN }),
    ).toBeUndefined();
  });
});

describe("describeQuiet", () => {
  it("says nothing while beats are arriving", () => {
    expect(describeQuiet(timing({ lastBeatAtMs: 0 }), 60_000)).toBeUndefined();
  });

  it("reports the gap once it is long enough to notice", () => {
    const said = describeQuiet(timing({ lastBeatAtMs: 0 }), 5 * MIN);
    expect(said).toMatch(/No update for 5 min/);
  });

  it("does not call a quiet install a broken one", () => {
    // A 4GB download is silent for minutes. Telling someone it has hung is how
    // they kill a working run at mod 600.
    const said = describeQuiet(timing({ lastBeatAtMs: 0 }), 10 * MIN) ?? "";
    expect(said).not.toMatch(/stuck|hung|frozen|failed/i);
    expect(said).toMatch(/Large downloads can be quiet/);
  });
});

describe("formatDuration", () => {
  it("uses a precision the estimate can support", () => {
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(5 * MIN)).toBe("5 min");
    expect(formatDuration(59 * MIN)).toBe("59 min");
    expect(formatDuration(60 * MIN)).toBe("1 hour");
    expect(formatDuration(90 * MIN)).toBe("1.5 hours");
    expect(formatDuration(175 * MIN)).toBe("3 hours");
  });

  it("drops the fraction once it is inside the error bars", () => {
    expect(formatDuration(12.4 * 60 * MIN)).toBe("12 hours");
  });

  it("never renders a negative duration", () => {
    // Clock adjustments during a multi-hour run are real.
    expect(formatDuration(-5_000)).toBe("0s");
  });
});

describe("describeElapsed", () => {
  it("always has something true to say", () => {
    expect(describeElapsed(0, 12 * MIN)).toBe("Running for 12 min");
    expect(describeElapsed(0, 0)).toBe("Running for 0s");
  });
});
