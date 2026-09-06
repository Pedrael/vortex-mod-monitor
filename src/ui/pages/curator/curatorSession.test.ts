/**
 * The state that has to outlive the component.
 *
 * The failure it exists to prevent: tab away mid-run, come back, and the page
 * says nothing happened — buttons enabled, report gone, loop still going.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { getCuratorSession } from "./curatorSession";
import { getEHRuntime } from "../../runtime/ehRuntime";

const session = getCuratorSession();

beforeEach(() => {
  // Return to idle between tests without exposing a reset the app can call.
  if (session.isBusy()) session.finish([]);
  session.dismiss();
});

describe("surviving a tab switch", () => {
  it("still reports busy to a fresh subscriber", () => {
    // A remounted page must not offer the buttons again while a run is live.
    session.begin("update");
    expect(getCuratorSession().getSnapshot().busy).toBe("update");
    expect(getCuratorSession().isBusy()).toBe(true);
  });

  it("keeps the report after the run ends", () => {
    // The LOST lines are the entire product of verifying between mods. They
    // used to die with the component that was showing them.
    session.begin("update");
    session.finish(['"A Mod" LOST 3 file(s)']);
    expect(getCuratorSession().getSnapshot().lines).toEqual([
      '"A Mod" LOST 3 file(s)',
    ]);
  });

  it("clears the report only when asked", () => {
    session.begin("update");
    session.finish(["done"]);
    session.dismiss();
    expect(session.getSnapshot().lines).toEqual([]);
  });

  it("refuses to dismiss a report while a run is in flight", () => {
    session.begin("update");
    session.dismiss();
    expect(session.getSnapshot().busy).toBe("update");
  });
});

describe("one run at a time", () => {
  it("refuses a second run and hands back no signal", () => {
    // The concurrency this whole feature exists to eliminate. A remounted
    // page with re-enabled buttons could previously start one.
    expect(session.begin("update")).toBeInstanceOf(AbortSignal);
    expect(session.begin("reinstall")).toBeUndefined();
    expect(session.getSnapshot().busy).toBe("update");
  });

  it("allows the next run once the first has finished", () => {
    session.begin("update");
    session.finish([]);
    expect(session.begin("cleanup")).toBeInstanceOf(AbortSignal);
  });
});

describe("telling the rest of the app it is working", () => {
  it("marks the runtime busy for the duration", () => {
    // Nothing did this before, so a build could start mid-update and hash a
    // staging folder being rewritten underneath it.
    expect(getEHRuntime().getSnapshot().installBusy).toBe(false);
    session.begin("update");
    expect(getEHRuntime().getSnapshot().installBusy).toBe(true);
    session.finish([]);
    expect(getEHRuntime().getSnapshot().installBusy).toBe(false);
  });
});

describe("cancelling", () => {
  it("aborts the signal the run was given", () => {
    const signal = session.begin("update");
    expect(signal?.aborted).toBe(false);
    session.cancel();
    expect(signal?.aborted).toBe(true);
  });

  it("says so, rather than looking frozen", () => {
    session.begin("update");
    session.cancel();
    expect(session.getSnapshot().progress).toMatch(/stopping/i);
  });

  it("is inert when nothing is running", () => {
    expect(() => session.cancel()).not.toThrow();
  });
});

describe("progress", () => {
  it("is ignored once the run is over, so a late tick cannot revive it", () => {
    session.begin("update");
    session.finish(["report"]);
    session.progress("Updating 9 of 40");
    expect(session.getSnapshot().progress).toBeUndefined();
    expect(session.getSnapshot().busy).toBeUndefined();
  });
});

describe("a note-only run leaves the report alone", () => {
  /**
   * Re-checking Nexus is the natural next click after an update run, and it
   * produces a NOTE, not a report. Clearing on `begin` threw away the LOST
   * lines — the one thing on the page a curator has to act on — for a run
   * that had nothing to put in their place.
   */
  it("keeps the standing report across a re-check", () => {
    session.begin("update");
    session.finish(['"A Mod" LOST 3 file(s)']);

    session.begin("refresh", { keepReport: true });
    expect(session.getSnapshot().lines).toEqual(['"A Mod" LOST 3 file(s)']);
    session.finish(undefined, "Nexus re-checked.");
    expect(session.getSnapshot().lines).toEqual(['"A Mod" LOST 3 file(s)']);
    expect(session.getSnapshot().note).toBe("Nexus re-checked.");
  });

  it("still clears it for a run that has a report of its own", () => {
    session.begin("update");
    session.finish(["old report"]);
    session.begin("update");
    expect(session.getSnapshot().lines).toEqual([]);
  });
});
