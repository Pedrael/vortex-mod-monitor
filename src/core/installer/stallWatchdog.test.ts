/**
 * The stall watchdog must not abort an install that is waiting for a HUMAN.
 *
 * ─── THE FIELD FAILURE ─────────────────────────────────────────────────
 * A tester left the machine while a FOMOD dialog was open. Nothing
 * dispatched, no progress signal moved, and the watchdog concluded the
 * pipeline was hung and killed a perfectly healthy install of a 963-mod
 * collection.
 *
 * A dialog waiting for a person cannot be told from a hang by watching for
 * progress, because neither makes any. The difference is whether Vortex is
 * blocked on input, which it publishes in `session.base.visibleDialog`.
 *
 * Our own FOMOD replay makes this the NORMAL case rather than a rare one:
 * the curator's answers are shown as presets and the user still clicks
 * through, once per FOMOD mod — 115 of them in this collection.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { types } from "@nexusmods/vortex-api";

import { installFromExistingDownload, isAwaitingUserInput } from "./modInstall";

describe("knowing when Vortex is waiting on a person", () => {
  const withSession = (base: unknown): types.IExtensionApi =>
    ({ getState: () => ({ session: { base } }) }) as unknown as types.IExtensionApi;

  /** A whole session, so the FOMOD installer's own dialog state can be set. */
  const withFullSession = (session: unknown): types.IExtensionApi =>
    ({ getState: () => ({ session }) }) as unknown as types.IExtensionApi;

  it("sees the FOMOD installer's OWN dialog, which uses a different key", () => {
    // The signal that actually matters, and the one that was missing: the
    // FOMOD installer does not set session.base.visibleDialog. It keeps
    // session.fomod.installer.dialog.activeInstanceId, which is what Vortex's
    // own shipped code tests. A tester lost six mods to the watchdog while
    // answering FOMOD prompts because we watched the wrong key.
    expect(
      isAwaitingUserInput(
        withFullSession({
          base: { visibleDialog: "", overlayOpen: false },
          fomod: { installer: { dialog: { activeInstanceId: "inst-42" } } },
        }),
      ),
    ).toBe(true);
  });

  it("is false when the FOMOD dialog has no active instance", () => {
    expect(
      isAwaitingUserInput(
        withFullSession({
          base: { visibleDialog: "", overlayOpen: false },
          fomod: { installer: { dialog: { activeInstanceId: undefined } } },
        }),
      ),
    ).toBe(false);
  });

  it("survives a session with no fomod branch at all", () => {
    // Older Vortex builds, or a profile where the installer never ran.
    expect(
      isAwaitingUserInput(
        withFullSession({ base: { visibleDialog: "", overlayOpen: false } }),
      ),
    ).toBe(false);
  });

  it("sees an open dialog", () => {
    expect(isAwaitingUserInput(withSession({ visibleDialog: "fomod-installer" }))).toBe(
      true,
    );
  });

  it("sees an open overlay", () => {
    expect(isAwaitingUserInput(withSession({ overlayOpen: true }))).toBe(true);
  });

  it("is false when nothing is on screen", () => {
    expect(isAwaitingUserInput(withSession({ visibleDialog: "", overlayOpen: false }))).toBe(
      false,
    );
    expect(isAwaitingUserInput(withSession({}))).toBe(false);
  });

  it("fails to FALSE when the state shape is not what we expect", () => {
    // Deliberate direction. If Vortex renames this, the watchdog goes back to
    // being occasionally impatient — annoying. Failing to TRUE would make it
    // never fire, turning a real hang into an install that waits forever.
    const broken = {
      getState: () => {
        throw new Error("no state");
      },
    } as unknown as types.IExtensionApi;
    expect(isAwaitingUserInput(broken)).toBe(false);
    expect(isAwaitingUserInput(withSession(null))).toBe(false);
  });
});

describe("the watchdog while a dialog is open", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /**
   * A Vortex that accepts the install and then goes completely silent —
   * exactly what an unattended FOMOD prompt looks like from here.
   */
  const silentVortex = (visibleDialog: string) => {
    const listeners: Array<() => void> = [];
    const state = {
      session: { base: { visibleDialog, overlayOpen: false } },
      persistent: {
        downloads: { files: { "dl-1": { localPath: "a.zip", state: "finished", received: 1, size: 1 } } },
        mods: { fallout4: {} },
      },
    };
    // A real emitter, because the primitive subscribes to did-install-mod and
    // a hand-rolled stub that only has `emit` fails for a reason that has
    // nothing to do with what these tests are about.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EventEmitter } = require("events") as typeof import("events");
    const api = {
      getState: () => state,
      events: new EventEmitter(),
      store: {
        getState: () => state,
        dispatch: () => undefined,
        subscribe: (fn: () => void) => {
          listeners.push(fn);
          return () => undefined;
        },
      },
    } as unknown as types.IExtensionApi;
    return { api, state };
  };

  it("does NOT abort while a dialog is on screen", async () => {
    // The regression. Before the fix this rejected after the stall budget and
    // took a healthy 963-mod install with it.
    const { api } = silentVortex("fomod-installer");
    const install = installFromExistingDownload(api, {
      gameId: "fallout4",
      archiveId: "dl-1",
    } as never);
    const outcome = vi.fn();
    void install.then(
      () => outcome("resolved"),
      () => outcome("rejected"),
    );

    // Well past any stall budget, and past the 60-minute absolute cap too:
    // capping a dialog-blocked install would only move the same loss to the
    // user who goes to bed mid-install.
    await vi.advanceTimersByTimeAsync(3 * 60 * 60_000);
    expect(outcome).not.toHaveBeenCalled();
  });

  it("DOES abort when it is silent with no dialog open", async () => {
    // The other half: ignoring the dialog must not become ignoring
    // everything. A genuine hang still has to surface.
    const { api } = silentVortex("");
    const install = installFromExistingDownload(api, {
      gameId: "fallout4",
      archiveId: "dl-1",
    } as never);

    const settled = vi.fn();
    void install.catch((err: Error) => settled(err.message));

    await vi.advanceTimersByTimeAsync(3 * 60 * 60_000);
    expect(settled).toHaveBeenCalled();
    expect(String(settled.mock.calls[0]?.[0])).toMatch(/stalled|time cap/i);
  });

  it("resumes counting once the dialog closes", async () => {
    // A user who answers the prompt and then hits a real hang must still be
    // protected — the pause is for as long as the dialog is up, not for the
    // rest of the install.
    const { api, state } = silentVortex("fomod-installer");
    const install = installFromExistingDownload(api, {
      gameId: "fallout4",
      archiveId: "dl-1",
    } as never);
    const settled = vi.fn();
    void install.catch((err: Error) => settled(err.message));

    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(settled).not.toHaveBeenCalled();

    // They clicked through; nothing else ever happens.
    state.session.base.visibleDialog = "";
    await vi.advanceTimersByTimeAsync(2 * 60 * 60_000);
    expect(settled).toHaveBeenCalled();
  });
});
