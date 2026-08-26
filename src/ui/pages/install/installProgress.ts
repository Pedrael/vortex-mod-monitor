/**
 * ──────────────────────────────────────────────────────────────────────
 * How long has this been going, and how much longer?
 *
 * A 954-mod install runs for hours. The progress screen showed a phase name,
 * a message, and "step 340 / 954" — none of which answers the two questions
 * someone actually has while watching it: how long have I been here, and is
 * this still moving?
 *
 * The second matters more than it looks. Most beats arrive seconds apart, but
 * one large download can legitimately take ten minutes, during which the
 * screen is indistinguishable from a hung install. Without a "last update"
 * the only way to tell is to kill Vortex and find out the hard way.
 *
 * ── Why the estimate is deliberately vague ──
 * `DriverProgress.currentStep` / `totalSteps` are scoped to the CURRENT PHASE
 * and reset on every transition, so there is no global counter to divide. An
 * estimate is only meaningful inside `installing-mods`, which is where all the
 * time goes, and even there each step is a download whose duration depends on
 * a file size we do not know. So this reports "about 2 hours", never
 * "1h 58m 12s": the second one claims a precision the input cannot support,
 * and a confident wrong number is worse than an honest vague one.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { DriverPhase } from "../../../types/installDriver";

/** The phase whose steps are slow and numerous enough to extrapolate from. */
const ESTIMABLE_PHASE: DriverPhase = "installing-mods";

/**
 * Below this many completed steps an estimate is noise. The first few mods in
 * a collection are not representative — they are whatever the install order
 * happened to start with, which can be a 2KB patch or a 4GB texture pack.
 */
const MIN_SAMPLES = 5;

/** And below this much elapsed time, even enough samples can be misleading. */
const MIN_ELAPSED_MS = 30_000;

/** Past this with no beat, say when the last one was. */
const QUIET_MS = 3 * 60_000;

/**
 * Timing baseline for the current phase.
 *
 * Held per-phase because the step counters reset at every transition: carrying
 * a baseline across a transition would divide this phase's step count by the
 * whole run's elapsed time and produce an estimate that is wrong in the
 * reassuring direction.
 */
export type PhaseTiming = {
  phase: DriverPhase;
  /** When this phase's first beat arrived. */
  startedAtMs: number;
  /** When the most recent beat arrived. */
  lastBeatAtMs: number;
  /** `currentStep` from the most recent beat. */
  step: number;
};

/**
 * Fold a progress beat into the running timing.
 *
 * A phase change starts over rather than continuing, for the reason above.
 */
export function trackPhase(
  previous: PhaseTiming | undefined,
  beat: { phase: DriverPhase; currentStep: number },
  nowMs: number,
): PhaseTiming {
  if (previous === undefined || previous.phase !== beat.phase) {
    return {
      phase: beat.phase,
      startedAtMs: nowMs,
      lastBeatAtMs: nowMs,
      step: beat.currentStep,
    };
  }
  return { ...previous, lastBeatAtMs: nowMs, step: beat.currentStep };
}

/**
 * Roughly how much longer, or `undefined` when there is no honest answer.
 *
 * Returns nothing outside the estimable phase, before there are enough
 * samples, and when the totals do not describe a finite amount of remaining
 * work — all cases where a number would be invented rather than measured.
 */
export function estimateRemainingMs(args: {
  timing: PhaseTiming;
  totalSteps: number;
  nowMs: number;
}): number | undefined {
  const { timing, totalSteps, nowMs } = args;
  if (timing.phase !== ESTIMABLE_PHASE) return undefined;
  if (totalSteps <= 0 || timing.step <= 0) return undefined;
  if (timing.step < MIN_SAMPLES) return undefined;
  if (timing.step >= totalSteps) return undefined;

  const elapsed = nowMs - timing.startedAtMs;
  if (elapsed < MIN_ELAPSED_MS) return undefined;

  const perStep = elapsed / timing.step;
  return Math.round(perStep * (totalSteps - timing.step));
}

/**
 * How long since the last sign of life, when that is long enough to mention.
 *
 * Deliberately not called "stuck". A big download really does go quiet for
 * minutes, and telling someone their install has hung when it has not is how
 * they end up killing a working run at mod 600.
 */
export function describeQuiet(
  timing: PhaseTiming,
  nowMs: number,
): string | undefined {
  const quiet = nowMs - timing.lastBeatAtMs;
  if (quiet < QUIET_MS) return undefined;
  return (
    `No update for ${formatDuration(quiet)}. Large downloads can be quiet ` +
    `for a while — this is only a problem if it stays this way.`
  );
}

/**
 * Human duration, rounded to the precision the number deserves.
 *
 * Hours lose their minutes entirely: "about 3 hours" is the honest shape of an
 * estimate built from an average, and "2h 57m" would imply we know better.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;

  const hours = minutes / 60;
  // One decimal below 10 hours ("1.5 hours"), whole hours above — past ten
  // hours the fraction is well inside the error bars.
  const rounded = hours < 10 ? Math.round(hours * 2) / 2 : Math.round(hours);
  return `${rounded} ${rounded === 1 ? "hour" : "hours"}`;
}

/** "Running for 12 min", the one line that is always true and always useful. */
export function describeElapsed(startedAtMs: number, nowMs: number): string {
  return `Running for ${formatDuration(nowMs - startedAtMs)}`;
}
