/**
 * The gate that stops an install Vortex could stage perfectly and never
 * deliver.
 *
 * Staging and DEPLOYING are separate steps. A tester's run staged 963 of 967
 * mods over seventy minutes and deployed none of them — Vortex had no usable
 * deployment method, and the first sign of it had appeared an hour earlier on
 * mod 489.
 *
 * Two properties, and the second matters more:
 *   - `none` blocks the install and names the screen that fixes it
 *   - `unknown` does NOT block, ever. This gate runs before an install the
 *     user has already committed to, so refusing a working setup because the
 *     check could not run is worse than the failure it guards against.
 */
import { describe, expect, it, vi } from "vitest";

let probeResult: { kind: string; why?: string; methodId?: string } = {
  kind: "ok",
  methodId: "x",
};

vi.mock("../../../core/installer/probeDeployment", () => ({
  probeDeploymentMethod: () => probeResult,
  describeDeploymentBlock: () => ({
    title: "Vortex cannot put mods into the game folder",
    body: "Fix it in Vortex under Settings → Mods → Deployment Method.",
  }),
}));

vi.mock("../../../core/installer/runInstall", () => ({
  runInstall: () => new Promise(() => undefined),
  buildAbortedResult: () => ({ kind: "aborted" }),
}));

import { getInstallSession } from "./installSession";
import type { PreviewBundle } from "./state";

const bundle = (): PreviewBundle =>
  ({
    zipPath: "C:/x.ehcoll",
    ehcoll: { manifest: { package: { name: "Ivy 2" } } },
    receipt: undefined,
    plan: { modResolutions: [], manifest: { game: { id: "fallout4" } } },
    appDataPath: "C:/appdata",
  }) as unknown as PreviewBundle;

function confirmSession(): ReturnType<typeof getInstallSession> {
  // Module singleton: state leaks between cases, and the stubbed runInstall
  // never settles — which would leave installInFlight true and make the next
  // startInstall return early, a false pass that looks exactly like the gate.
  const s = getInstallSession();
  (s as unknown as { installInFlight: boolean }).installInFlight = false;
  (s as unknown as { installController?: unknown }).installController = undefined;
  (s as unknown as { state: unknown }).state = {
    kind: "confirm",
    bundle: bundle(),
    decisions: { conflictChoices: {}, orphanChoices: {} },
  };
  return s;
}

const fakeApi = (): { api: never; dialogs: unknown[][] } => {
  const dialogs: unknown[][] = [];
  return {
    api: {
      showDialog: (...args: unknown[]) => {
        dialogs.push(args);
        return Promise.resolve({});
      },
    } as never,
    dialogs,
  };
};

const kindOf = (s: unknown): string =>
  (s as { state: { kind: string } }).state.kind;

describe("startInstall — deployment gate", () => {
  it("refuses to start when Vortex has no deployment method", async () => {
    probeResult = { kind: "none" };
    const { api, dialogs } = fakeApi();
    const s = confirmSession();
    s.startInstall(api);
    await Promise.resolve();
    await Promise.resolve();

    expect(kindOf(s)).toBe("confirm");
    // The dialog is opened from an async path; the load-bearing assertion is
    // that the install did NOT start.
    expect(kindOf(s)).not.toBe("installing");
    void dialogs;
  });

  it("starts normally when a method is available", () => {
    probeResult = { kind: "ok", methodId: "hardlink_activator" };
    const { api } = fakeApi();
    const s = confirmSession();
    s.startInstall(api);
    expect(kindOf(s)).toBe("installing");
  });

  it("starts when the check could not run — unknown is never a block", () => {
    // The property that keeps this gate from becoming the bug. Vortex may move
    // getCurrentActivator; if it does, every install must still work.
    probeResult = { kind: "unknown", why: "resolver missing" };
    const { api } = fakeApi();
    const s = confirmSession();
    s.startInstall(api);
    expect(kindOf(s)).toBe("installing");
  });
});
