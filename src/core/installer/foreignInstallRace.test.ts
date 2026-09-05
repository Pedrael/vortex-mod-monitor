/**
 * ──────────────────────────────────────────────────────────────────────
 * A install somebody else started must not settle OUR promise.
 *
 * `installFromLocalArchive` races two answers: Vortex's synchronous
 * `start-install` callback, which names the mod exactly, and a
 * `did-install-mod` listener that exists because some Vortex builds never
 * invoke the callback. The listener used to accept the FIRST install to finish
 * for the game.
 *
 * The note above it said that was safe because EHRuntime "serializes EH's
 * build/install pipelines". EHRuntime is two booleans and a listener set — no
 * lock, no queue — and its own header says concurrent operations are
 * deliberately not forbidden, only discouraged with a banner and a disabled
 * button the user can dismiss. So the guarantee the safety argument rested on
 * did not exist, and a user clicking install in Vortex's own UI during an EH
 * install could hand the driver a modId for a mod it never installed: verified
 * against the wrong staging folder, written into the receipt as the drift
 * oracle for the wrong mod, and the real one never checked.
 *
 * These tests drive the real function with a Vortex whose callback never
 * fires — the only condition under which the fallback decides anything.
 * ──────────────────────────────────────────────────────────────────────
 */
import { EventEmitter } from "events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installFromLocalArchive } from "./modInstall";
import type { types } from "@nexusmods/vortex-api";

/**
 * A Vortex that accepts `start-install` and never calls back.
 *
 * `mods` is mutable so a test can register what an install produced before
 * announcing it, which is the order Vortex itself uses.
 */
function silentCallbackVortex() {
  const events = new EventEmitter();
  const state = {
    session: { base: { visibleDialog: undefined, overlayOpen: false } },
    persistent: {
      downloads: {
        files: {
          "ours-dl": { localPath: "OurMod.zip", state: "finished", received: 1, size: 1 },
          "theirs-dl": { localPath: "SomeoneElse.zip", state: "finished", received: 1, size: 1 },
        },
      },
      mods: { fallout4: {} as Record<string, { archiveId?: string }> },
    },
  };
  const api = {
    getState: () => state,
    // Swallows the callback: this is the degraded build the fallback exists for.
    events: Object.assign(events, {
      emit: (event: string, ...args: unknown[]): boolean =>
        event === "start-install"
          ? true
          : EventEmitter.prototype.emit.call(events, event, ...args),
    }),
    store: {
      getState: () => state,
      dispatch: () => undefined,
      subscribe: () => () => undefined,
    },
  } as unknown as types.IExtensionApi;
  return { api, state, events };
}

const DOWNLOAD_DIR = "C:/downloads/fallout4";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the did-install-mod fallback", () => {
  it("ignores an install of a DIFFERENT archive, then accepts ours", async () => {
    const { api, state, events } = silentCallbackVortex();

    const promise = installFromLocalArchive(api, {
      gameId: "fallout4",
      archivePath: `${DOWNLOAD_DIR}/OurMod.zip`,
    } as never);

    const settled = vi.fn();
    void promise.then(settled, settled);

    // Somebody else's install lands first. Before the gate this resolved the
    // promise with "their-mod" and the driver adopted it.
    state.persistent.mods.fallout4["their-mod"] = { archiveId: "theirs-dl" };
    events.emit("did-install-mod", "fallout4", "theirs-dl", "their-mod");
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).not.toHaveBeenCalled();

    // Ours lands second and is the one taken.
    state.persistent.mods.fallout4["our-mod"] = { archiveId: "ours-dl" };
    events.emit("did-install-mod", "fallout4", "ours-dl", "our-mod");
    await vi.advanceTimersByTimeAsync(0);

    await expect(promise).resolves.toEqual({ vortexModId: "our-mod" });
  });

  it("does not accept a mod whose archive cannot be resolved", async () => {
    // Unresolvable means NO, on purpose. This leg only runs when Vortex's
    // callback already failed, so the choice is a visible timeout versus
    // silently adopting a mod we cannot identify.
    const { api, state, events } = silentCallbackVortex();
    const promise = installFromLocalArchive(api, {
      gameId: "fallout4",
      archivePath: `${DOWNLOAD_DIR}/OurMod.zip`,
    } as never);
    const settled = vi.fn();
    void promise.then(settled, settled);

    state.persistent.mods.fallout4["mystery"] = {}; // no archiveId at all
    events.emit("did-install-mod", "fallout4", "unknown-dl", "mystery");
    await vi.advanceTimersByTimeAsync(0);

    expect(settled).not.toHaveBeenCalled();
    promise.catch(() => undefined);
  });

  it("still ignores installs for another game", async () => {
    const { api, state, events } = silentCallbackVortex();
    const promise = installFromLocalArchive(api, {
      gameId: "fallout4",
      archivePath: `${DOWNLOAD_DIR}/OurMod.zip`,
    } as never);
    const settled = vi.fn();
    void promise.then(settled, settled);

    state.persistent.mods.fallout4["our-mod"] = { archiveId: "ours-dl" };
    events.emit("did-install-mod", "skyrimse", "ours-dl", "our-mod");
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).not.toHaveBeenCalled();

    events.emit("did-install-mod", "fallout4", "ours-dl", "our-mod");
    await vi.advanceTimersByTimeAsync(0);
    await expect(promise).resolves.toEqual({ vortexModId: "our-mod" });
  });
});
