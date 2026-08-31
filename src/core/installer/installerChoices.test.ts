/**
 * 114 of 954 mods in the curator's real collection carry FOMOD answers that
 * reached nobody: every archive went to Vortex's installer, which asked the
 * USER instead. The manifest then asserted the curator's staged hashes, so the
 * divergence was detected after the fact and could not be prevented.
 *
 * The signature these feed was observed, not guessed — see installerChoices.ts.
 */
import { describe, expect, it } from "vitest";

import { choicesFor, installOptions,
} from "./installerChoices";
import type { EhcollMod } from "../../types/ehcoll";

const entry = (install: Partial<EhcollMod["install"]>): EhcollMod =>
  ({ name: "m", install: { fomodSelections: [], ...install } }) as EhcollMod;

const step = (choiceName: string, idx: number) => ({
  name: "Choose Options",
  groups: [{ name: "Patches", choices: [{ name: choiceName, idx }] }],
});

describe("choicesFor", () => {
  it("hands back the recorded answers with their own type", () => {
    const out = choicesFor(
      entry({
        fomodSelections: [step("AFT Plus Ivy Patch", 2)] as never,
        installerChoicesType: "fomod",
      }),
    );
    expect(out).toEqual({
      type: "fomod",
      options: [step("AFT Plus Ivy Patch", 2)],
    });
  });

  it("assumes fomod only for manifests built before the type was captured", () => {
    // Old packages recorded `options` and dropped `type`. FOMOD is the only
    // Vortex installer that asks questions, so it is the right guess — but it
    // IS a guess, and a new manifest must never reach it.
    const out = choicesFor(entry({ fomodSelections: [step("A", 0)] as never }));
    expect(out!.type).toBe("fomod");
  });

  it("prefers the recorded type over the assumption", () => {
    const out = choicesFor(
      entry({
        fomodSelections: [step("A", 0)] as never,
        installerChoicesType: "something-else",
      }),
    );
    expect(out!.type).toBe("something-else");
  });

  it("returns undefined for a mod with no recorded answers", () => {
    // Load-bearing: undefined makes the caller take the ORIGINAL install path.
    // Replay must not change how the other 840 mods install.
    expect(choicesFor(entry({ fomodSelections: [] }))).toBeUndefined();
  });

  it("returns undefined when the steps answer nothing", () => {
    // A recorded step whose groups hold no chosen option asserts a choice the
    // curator never made; sending it would tell Vortex to pick "nothing".
    const empty = choicesFor(
      entry({
        fomodSelections: [
          { name: "Select an option:", groups: [{ name: "Select one:", choices: [] }] },
        ] as never,
      }),
    );
    expect(empty).toBeUndefined();
  });

  it("is undefined-safe for a mod that is not in the manifest", () => {
    expect(choicesFor(undefined)).toBeUndefined();
  });
});

describe("installOptions", () => {
  it("builds the bag Vortex was observed to pass", () => {
    // `unattended` joined the bag deliberately. Vortex's install manager
    // forwards options.unattended straight into the fomod installer, which
    // bypasses the dialog only when choices.type === "fomod" AND
    // unattended === true. This deep-equal is the record of what we send, so
    // it is meant to fail when that changes — which is what it just did.
    const choices = { type: "fomod", options: [] };
    expect(installOptions(choices)).toEqual({
      allowAutoEnable: true,
      choices,
      unattended: true,
    });
  });
});

describe("silent FOMOD replay", () => {
  it("asks Vortex to bypass the dialog by default", () => {
    // Vortex's installer bypasses only when all three hold:
    //   choices !== undefined && choices.type === "fomod" && unattended === true
    // We supply the first two already; this is the third.
    const opts = installOptions({ type: "fomod", options: [] });
    expect(opts.unattended).toBe(true);
    expect(opts.choices.type).toBe("fomod");
  });

  it("can be told to show the dialog instead", () => {
    // Observability is a legitimate preference, so the automation is a
    // parameter rather than a hard-coded truth.
    expect(installOptions({ type: "fomod", options: [] }, false).unattended)
      .toBe(false);
  });

  it("keeps allowAutoEnable, which is a different thing entirely", () => {
    // allowAutoEnable is about enabling the mod in the profile; unattended is
    // about showing a dialog. Conflating them would silently change what gets
    // enabled while trying to change what gets shown.
    const opts = installOptions({ type: "fomod", options: [] }, false);
    expect(opts.allowAutoEnable).toBe(true);
  });
});
