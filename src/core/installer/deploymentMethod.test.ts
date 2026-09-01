/**
 * The failure that cost a tester seventy minutes and told him he had
 * cancelled it.
 *
 * Vortex throws `ProcessCanceled("No deployment method active")` when it has
 * no usable way to link staged mods into the game folder. It is a property of
 * the MACHINE, so every subsequent mod fails identically — and the run that
 * produced these tests hit it at mod 489 of 967, carried on for another 478,
 * and died at the end with no receipt.
 */
import { describe, expect, it } from "vitest";

import {
  describeMissingDeploymentMethod,
  isDeploymentMethodMissing,
  selectedDeploymentMethod,
} from "./deploymentMethod";

describe("isDeploymentMethodMissing", () => {
  it("recognises Vortex's message", () => {
    expect(
      isDeploymentMethodMissing(new Error("No deployment method active")),
    ).toBe(true);
  });

  it("matches regardless of case or surrounding text", () => {
    // It arrives wrapped by the time the driver sees it.
    expect(
      isDeploymentMethodMissing(
        new Error('Failed to install "FixCubemaps": no deployment method active'),
      ),
    ).toBe(true);
  });

  it("accepts a bare string or an error-shaped object", () => {
    expect(isDeploymentMethodMissing("No deployment method active")).toBe(true);
    expect(
      isDeploymentMethodMissing({ message: "No deployment method active" }),
    ).toBe(true);
  });

  it("does not fire on other cancellations", () => {
    // Matched on the MESSAGE, not the class. Vortex uses `ProcessCanceled` for
    // unrelated things too, and treating every one of them as this would abort
    // installs for the wrong reason.
    expect(isDeploymentMethodMissing(new Error("canceled by user"))).toBe(false);
    expect(isDeploymentMethodMissing(new Error("Operation cancelled"))).toBe(
      false,
    );
    expect(isDeploymentMethodMissing(new Error("deployment failed"))).toBe(
      false,
    );
  });

  it("survives junk", () => {
    expect(isDeploymentMethodMissing(undefined)).toBe(false);
    expect(isDeploymentMethodMissing(null)).toBe(false);
    expect(isDeploymentMethodMissing({})).toBe(false);
  });
});

describe("selectedDeploymentMethod", () => {
  const state = (activator: unknown): unknown => ({
    settings: { mods: { activator } },
  });

  it("reads the same path Vortex reads", () => {
    expect(
      selectedDeploymentMethod(state({ fallout4: "hardlink_activator" }), "fallout4"),
    ).toBe("hardlink_activator");
  });

  it("is undefined when this game has none", () => {
    expect(
      selectedDeploymentMethod(state({ skyrimse: "symlink" }), "fallout4"),
    ).toBeUndefined();
  });

  it("survives a state shape it does not recognise", () => {
    // Never throws: this runs inside preflight, and a reader that takes down
    // the check over one unfamiliar field is worse than no check.
    expect(selectedDeploymentMethod(undefined, "fallout4")).toBeUndefined();
    expect(selectedDeploymentMethod({}, "fallout4")).toBeUndefined();
    expect(selectedDeploymentMethod(state(null), "fallout4")).toBeUndefined();
    expect(selectedDeploymentMethod(state({ fallout4: 7 }), "fallout4")).toBeUndefined();
  });
});

describe("describeMissingDeploymentMethod", () => {
  const base = { modName: "FixCubemaps", atIndex: 489, total: 967 };

  it("says it is not the collection and not the user", () => {
    // The tester was asleep and was told he had cancelled it. A confidently
    // wrong diagnosis is worse than a stack trace: it stops the reader looking.
    const msg = describeMissingDeploymentMethod({ ...base, wine: false });
    expect(msg).toContain("not a problem with the collection");
    expect(msg).toContain("nobody cancelled anything");
  });

  it("says where it stopped and why every remaining mod would fail", () => {
    const msg = describeMissingDeploymentMethod({ ...base, wine: false });
    expect(msg).toContain("mod 489 of 967");
    expect(msg).toContain("Every remaining mod would fail the same way");
  });

  it("names the setting that fixes it", () => {
    const msg = describeMissingDeploymentMethod({ ...base, wine: false });
    expect(msg).toContain("Settings → Mods → Deployment Method");
  });

  it("says a re-run is cheap, because that is the actual next step", () => {
    // Without it, "run the install again" reads as "redo the seventy minutes".
    expect(
      describeMissingDeploymentMethod({ ...base, wine: false }),
    ).toContain("already installed are skipped");
  });

  it("adds the Proton-specific cause only on Proton", () => {
    // Hardlink deployment needs staging and game on one filesystem, which a
    // Proton prefix often breaks — but that advice is noise on Windows.
    expect(describeMissingDeploymentMethod({ ...base, wine: true })).toContain(
      "SAME filesystem",
    );
    expect(
      describeMissingDeploymentMethod({ ...base, wine: false }),
    ).not.toContain("SAME filesystem");
  });
});
