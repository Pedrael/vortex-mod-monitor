/**
 * The user's replay choice has to survive the wizard and reach the driver.
 *
 * A picker that renders correctly and then loses its value on a Back/Next is
 * indistinguishable, from the user's side, from one that was never wired: they
 * pick "show me the installers", walk back to fix a conflict, and get a silent
 * install anyway. Nothing throws, nothing logs, and the collection installs
 * perfectly — just not the way they asked.
 */
import { describe, expect, it } from "vitest";

import { DEFAULT_FOMOD_REPLAY_MODE } from "../../../core/installer/fomodReplayMode";
import { buildUserConfirmedDecisions, wizardReducer as reduce } from "./state";
import type { WizardState } from "./state";

const bundle = { plan: { manifest: { mods: [] } } } as never;

function atDecisions(): WizardState {
  return reduce({ kind: "idle" } as never, {
    type: "open-decisions",
    bundle,
    conflictChoices: {},
    orphanChoices: {},
  } as never);
}

describe("fomod replay mode through the wizard", () => {
  it("starts at the default so the question is never unanswered", () => {
    const s = atDecisions();
    expect(s.kind).toBe("decisions");
    expect((s as { fomodReplayMode?: string }).fomodReplayMode).toBe(
      DEFAULT_FOMOD_REPLAY_MODE,
    );
  });

  it("records a pick made on the confirm step", () => {
    const confirm = reduce(atDecisions(), {
      type: "open-confirm",
      decisions: buildUserConfirmedDecisions({}, {}, "silent"),
    } as never);
    const picked = reduce(confirm, {
      type: "set-fomod-mode",
      mode: "supervised",
    } as never);
    expect(
      (picked as { decisions: { fomodReplayMode?: string } }).decisions
        .fomodReplayMode,
    ).toBe("supervised");
  });

  it("keeps the pick across confirm → back → confirm", () => {
    // The regression this file exists for. `back-from-confirm` rebuilds the
    // decisions state, and rebuilding it from the conflict/orphan maps alone
    // silently resets the mode to the default.
    let s: WizardState = atDecisions();
    s = reduce(s, {
      type: "open-confirm",
      decisions: buildUserConfirmedDecisions({}, {}, "silent"),
    } as never);
    s = reduce(s, { type: "set-fomod-mode", mode: "supervised" } as never);
    s = reduce(s, { type: "back-from-confirm" } as never);

    expect(s.kind).toBe("decisions");
    expect((s as { fomodReplayMode?: string }).fomodReplayMode).toBe(
      "supervised",
    );
  });

  it("carries the pick into the decisions the driver receives", () => {
    // The end of the wire: `installing` is what startInstall hands to
    // runInstall, and runInstall reads decisions.fomodReplayMode.
    let s: WizardState = atDecisions();
    s = reduce(s, { type: "set-fomod-mode", mode: "supervised" } as never);
    s = reduce(s, {
      type: "open-confirm",
      decisions: buildUserConfirmedDecisions(
        {},
        {},
        (s as { fomodReplayMode: "silent" | "supervised" }).fomodReplayMode,
      ),
    } as never);
    s = reduce(s, { type: "start-install" } as never);

    expect(s.kind).toBe("installing");
    expect(
      (s as { decisions: { fomodReplayMode?: string } }).decisions
        .fomodReplayMode,
    ).toBe("supervised");
  });

  it("ignores a mode change on a step that has no such choice", () => {
    const preview = reduce({ kind: "idle" } as never, {
      type: "plan-ready",
      bundle,
    } as never);
    expect(
      reduce(preview, { type: "set-fomod-mode", mode: "supervised" } as never),
    ).toBe(preview);
  });
});
