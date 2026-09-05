/**
 * The estimate must stay tied to the pacing that produces it.
 *
 * The failure this guards is not an arithmetic one: it is someone tuning
 * `ENDORSE_PACE_MS` and leaving a hardcoded "about 6 minutes" on the button.
 */
import { describe, expect, it } from "vitest";

import {
  ENDORSE_PACE_MS,
  describeEndorseDuration,
  endorseDurationMs,
  endorseIsLong,
} from "./endorsePace";

describe("how long it takes", () => {
  it("is the pace times the gaps, not times the mods", () => {
    // Ten mods is nine waits. Off by one endorsement is nothing; deriving it
    // from the constant rather than restating it is the point.
    expect(endorseDurationMs(10)).toBe(9 * ENDORSE_PACE_MS);
  });

  it("costs nothing for one mod, or none", () => {
    expect(endorseDurationMs(1)).toBe(0);
    expect(endorseDurationMs(0)).toBe(0);
  });

  it("tracks the constant rather than a copy of it", () => {
    // If the pace is retuned, this scales with it. A test asserting "380500"
    // would pass forever while the button said the wrong thing.
    expect(endorseDurationMs(1522)).toBe(1521 * ENDORSE_PACE_MS);
  });
});

describe("how it is worded", () => {
  it("gives the real profile's answer in minutes", () => {
    // 1,522 unendorsed mods is what the curator's live profile reports.
    expect(describeEndorseDuration(1522)).toBe("about 6 minutes");
  });

  it("does not dress a short run up as a duration", () => {
    expect(describeEndorseDuration(5)).toBe("a few seconds");
    expect(describeEndorseDuration(0)).toBe("a few seconds");
  });

  it("says a minute rather than 'about 1 minutes'", () => {
    expect(describeEndorseDuration(200)).toBe("about a minute");
  });

  it("breaks an hour out rather than saying 'about 125 minutes'", () => {
    const hourly = describeEndorseDuration(Math.round(3600_000 / ENDORSE_PACE_MS) + 1);
    expect(hourly).toContain("hour");
  });

  it("never states a precision a setTimeout floor does not have", () => {
    // Every wording is an estimate. `setTimeout(250)` means "not before",
    // so a curator must never read a deadline off this.
    for (const n of [0, 5, 200, 1522, 50_000]) {
      expect(describeEndorseDuration(n)).toMatch(/^(a few seconds|about )/);
    }
  });
});

describe("when it is worth warning about", () => {
  it("warns on the run that actually takes minutes", () => {
    expect(endorseIsLong(1522)).toBe(true);
  });

  it("stays quiet on a run that finishes before you could stop it", () => {
    expect(endorseIsLong(10)).toBe(false);
    expect(endorseIsLong(0)).toBe(false);
  });

  it("draws the line at a minute of real waiting", () => {
    const atTheLine = Math.round(60_000 / ENDORSE_PACE_MS) + 1;
    expect(endorseIsLong(atTheLine)).toBe(true);
    expect(endorseIsLong(atTheLine - 2)).toBe(false);
  });
});
