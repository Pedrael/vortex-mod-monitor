/**
 * Whose error is this?
 *
 * Our global listeners catch the whole Vortex renderer's failures, so an error
 * raised anywhere in the application arrived in an Event Horizon dialog with
 * an Event Horizon title. A tester was shown "Operation cancelled — canceled
 * by user" for an unhandled `UserCanceled` raised inside Vortex's own promise
 * machinery, while his install of 967 mods had completed every step. He had
 * cancelled nothing.
 *
 * The dangerous direction here is the opposite of the obvious one. Failing to
 * spot a foreign error costs a confusing dialog. Wrongly disowning OUR bug
 * sends a real defect back to a user as "not our problem", and nobody ever
 * looks again — so every ambiguous case must resolve to "ours".
 */
import { describe, expect, it } from "vitest";

import { describeForeignError, isForeignError, stackOf } from "./foreignError";

/** The tester's actual stack, trimmed. */
const VORTEX_STACK = `UserCanceled: canceled by user
    at terminate (C:/Program Files/Vortex/resources/app.asar/renderer.js:2:3395239)
    at terminateFromError (C:/Program Files/Vortex/resources/app.asar/renderer.js:2:2988650)
    at _ZoneDelegate.invokeTask (C:/Program Files/Vortex/resources/app.asar/node_modules/zone.js/bundles/zone.umd.js:443:37)
    at Promise._notifyUnhandledRejection (C:/Program Files/Vortex/resources/app.asar/node_modules/bluebird/js/release/debuggability.js:90:9)`;

const OUR_STACK = `Error: something broke
    at runInstall (C:/Users/x/AppData/Roaming/Vortex/plugins/event-horizon-0.1.0-alpha.20/dist/core/installer/runInstall.js:12:9)
    at async startInstall (C:/Users/x/AppData/Roaming/Vortex/plugins/event-horizon-0.1.0-alpha.20/dist/ui/pages/install/installSession.js:5:1)`;

const MIXED_STACK = `Error: broke while calling Vortex
    at runInstall (C:/Users/x/AppData/Roaming/Vortex/plugins/event-horizon-0.1.0-alpha.20/dist/core/installer/runInstall.js:12:9)
    at emit (C:/Program Files/Vortex/resources/app.asar/renderer.js:2:1)`;

const withStack = (stack: string): Error => {
  const e = new Error("x");
  e.stack = stack;
  return e;
};

describe("isForeignError", () => {
  it("recognises the tester's Vortex-only stack", () => {
    expect(isForeignError(withStack(VORTEX_STACK))).toBe(true);
  });

  it("does not disown an error from our own code", () => {
    expect(isForeignError(withStack(OUR_STACK))).toBe(false);
  });

  it("keeps a MIXED stack as ours", () => {
    // We called into Vortex and it threw. That is still our failure to handle,
    // and blaming Vortex for it would hide a real bug of ours.
    expect(isForeignError(withStack(MIXED_STACK))).toBe(false);
  });

  it("keeps anything with no stack at all", () => {
    // A thrown string, a rejected non-Error, a shape we do not know. No
    // evidence is not evidence of innocence.
    expect(isForeignError("just a string")).toBe(false);
    expect(isForeignError(new Error("no stack set"))).toBe(
      isForeignError(withStack("")),
    );
    expect(isForeignError(withStack(""))).toBe(false);
    expect(isForeignError(undefined)).toBe(false);
    expect(isForeignError(null)).toBe(false);
    expect(isForeignError({})).toBe(false);
  });

  it("keeps a stack that names neither side", () => {
    // Some third thing entirely: claim it rather than guess.
    expect(
      isForeignError(withStack("Error: x\n    at foo (some/other/file.js:1:1)")),
    ).toBe(false);
  });

  it("reads a stack off an error-shaped object", () => {
    expect(isForeignError({ stack: VORTEX_STACK })).toBe(true);
  });
});

describe("stackOf", () => {
  it("returns an empty string rather than throwing on junk", () => {
    expect(stackOf(undefined)).toBe("");
    expect(stackOf(42)).toBe("");
    expect(stackOf({ stack: 7 })).toBe("");
  });
});

describe("describeForeignError", () => {
  it("says it is not ours", () => {
    expect(describeForeignError()).toContain("came from Vortex itself");
  });

  it("says the work may have finished anyway", () => {
    // The tester's install HAD completed. Telling him only "not our problem"
    // would have left him assuming the opposite.
    expect(describeForeignError()).toContain("may have finished normally");
  });

  it("gives a next step rather than a shrug", () => {
    expect(describeForeignError()).toContain("My Collections");
  });
});
