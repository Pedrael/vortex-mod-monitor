/**
 * The gate for Vortex's automatic deployment.
 *
 * Auto-deploy runs a full deployment whenever the mod list changes — up to 967
 * times during a collection install. The slowness is the visible half. The
 * half that corrupts is that one of those deployments can land BEFORE the
 * collection's conflict rules are applied, and those rules decide which mod
 * wins a shared file: the wrong winner gets linked into the game folder, every
 * hash still matches, and nothing downstream can see it.
 *
 * It blocks, so the same rule as every other gate applies: only a definite yes
 * stops an install.
 */
import { describe, expect, it } from "vitest";

import {
  blocksInstall,
  describeAutoDeployBlock,
  readsAutoDeploy,
} from "./autoDeploy";

const state = (deploy: unknown): unknown => ({
  settings: { automation: { deploy } },
});

describe("readsAutoDeploy", () => {
  it("reads Vortex's own state path", () => {
    // settings.automation.deploy — read out of the shipped bundle, where the
    // notification code branches on exactly this.
    expect(readsAutoDeploy(state(true))).toBe(true);
    expect(readsAutoDeploy(state(false))).toBe(false);
  });

  it("is undefined when it cannot be read, not false", () => {
    // "Could not read" and "off" are different claims, and only one of them
    // means the install is safe to start.
    for (const s of [undefined, null, {}, { settings: {} }, state("yes"), state(1)]) {
      expect(readsAutoDeploy(s)).toBeUndefined();
    }
  });
});

describe("blocksInstall", () => {
  it("blocks only on a definite yes", () => {
    expect(blocksInstall(state(true))).toBe(true);
    expect(blocksInstall(state(false))).toBe(false);
  });

  it("does NOT block when the setting cannot be read", () => {
    // The fail-open rule shared with the deployment-method gate: refusing a
    // working install because a check could not run does more damage than the
    // thing it guards against.
    for (const s of [undefined, {}, { settings: { automation: {} } }]) {
      expect(blocksInstall(s)).toBe(false);
    }
  });
});

describe("describeAutoDeployBlock", () => {
  it("leads with the corruption, not the slowness", () => {
    // Someone who has never watched a deployment does not know what "deploys
    // after every mod" costs them. "The game loads something the curator never
    // had" is the part that decides whether they say yes.
    const { body } = describeAutoDeployBlock(967);
    expect(body).toContain("conflict rules");
    expect(body).toContain("something the curator never had");
  });

  it("names the scale it was given", () => {
    expect(describeAutoDeployBlock(967).body).toContain("967 mods");
  });

  it("stays sensible with no count", () => {
    const { body } = describeAutoDeployBlock(0);
    expect(body).toContain("a collection");
    expect(body).not.toContain("0 mods");
  });

  it("says the setting stays off, and names the toggle", () => {
    // We are changing something in the user's Vortex. Saying so, and saying
    // where to undo it, is the difference between a gate and a liberty.
    const { body } = describeAutoDeployBlock(10);
    expect(body).toContain("stays off afterwards");
    expect(body).toContain('"Deploy Mods when Enabled"');
  });

  it("offers a way out as well as a way through", () => {
    const d = describeAutoDeployBlock(10);
    expect(d.confirm.length).toBeGreaterThan(0);
    expect(d.decline).toBe("Cancel");
  });
});
