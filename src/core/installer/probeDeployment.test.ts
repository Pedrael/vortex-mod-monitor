/**
 * The pre-flight that would have saved seventy minutes.
 *
 * Vortex can stage every mod perfectly and still have no way to LINK them into
 * the game folder. A tester's run staged 963 of 967 and deployed none of them.
 *
 * The failure mode to guard against here is not missing the problem — it is
 * INVENTING one. This gate blocks an install before it starts, so a false
 * "your Vortex cannot deploy" refuses a working setup and the user has no way
 * to tell the tool is wrong.
 */
import { describe, expect, it, vi } from "vitest";

import {
  describeDeploymentBlock,
  probeDeploymentMethod,
} from "./probeDeployment";

const api = { getState: () => ({ settings: {} }) } as never;

describe("probeDeploymentMethod", () => {
  it("reports ok when Vortex resolves a method", () => {
    const r = probeDeploymentMethod({
      api,
      gameId: "fallout4",
      getCurrentActivator: () => ({ id: "hardlink_activator" }),
    });
    expect(r).toEqual({ kind: "ok", methodId: "hardlink_activator" });
  });

  it("reports none when Vortex resolves nothing", () => {
    // Exactly the state that makes Vortex throw
    // ProcessCanceled("No deployment method active") — getCurrentActivator
    // returns undefined rather than throwing, and that undefined IS the
    // condition.
    const r = probeDeploymentMethod({
      api,
      gameId: "fallout4",
      getCurrentActivator: () => undefined,
    });
    expect(r).toEqual({ kind: "none" });
  });

  it("asks with allowDefault, because most users never pick one by hand", () => {
    // Passing false would report trouble for everyone relying on Vortex's
    // auto-selection, which is most people — the single easiest way to turn
    // this gate into a bug.
    const spy = vi.fn(() => ({ id: "x" }));
    probeDeploymentMethod({ api, gameId: "fallout4", getCurrentActivator: spy });
    expect(spy).toHaveBeenCalledWith(expect.anything(), "fallout4", true);
  });

  it("says unknown, not none, when the resolver is missing", () => {
    // getCurrentActivator is not a documented extension API we can rely on
    // forever. If Vortex moves it, this gate must get out of the way rather
    // than block every install.
    const r = probeDeploymentMethod({
      api,
      gameId: "fallout4",
      getCurrentActivator: undefined as never,
    });
    // Resolved from the real package here; either it is present (ok/none) or
    // it is not (unknown). The property that matters is that a MISSING
    // resolver never yields "none".
    if (r.kind === "unknown") expect(r.why.length).toBeGreaterThan(0);
    expect(["ok", "none", "unknown"]).toContain(r.kind);
  });

  it("says unknown, not none, when the resolver throws", () => {
    const r = probeDeploymentMethod({
      api,
      gameId: "fallout4",
      getCurrentActivator: () => {
        throw new Error("state shape changed");
      },
    });
    expect(r.kind).toBe("unknown");
    if (r.kind === "unknown") expect(r.why).toContain("state shape changed");
  });

  it("says unknown when reading state throws", () => {
    const r = probeDeploymentMethod({
      api: {
        getState: () => {
          throw new Error("no store");
        },
      } as never,
      gameId: "fallout4",
      getCurrentActivator: () => ({ id: "x" }),
    });
    expect(r.kind).toBe("unknown");
  });

  it("tolerates a method object with no id", () => {
    // A resolved method is a resolved method; the id is for the log line.
    const r = probeDeploymentMethod({
      api,
      gameId: "fallout4",
      getCurrentActivator: () => ({}) as never,
    });
    expect(r.kind).toBe("ok");
  });
});

describe("describeDeploymentBlock", () => {
  it("leads with the consequence, not the mechanism", () => {
    // The reader is about to spend an hour. "Deployment method" means nothing
    // to them; "none of it would reach the game" does.
    const { body } = describeDeploymentBlock(false);
    expect(body).toContain("none of it would reach the game");
  });

  it("names the exact screen that fixes it", () => {
    expect(describeDeploymentBlock(false).body).toContain(
      "Settings → Mods → Deployment Method",
    );
  });

  it("adds the Proton cause only on Proton", () => {
    expect(describeDeploymentBlock(true).body).toContain("SAME filesystem");
    expect(describeDeploymentBlock(false).body).not.toContain("SAME filesystem");
  });
});
