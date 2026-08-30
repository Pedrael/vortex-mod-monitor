/**
 * A failed `nexusDownload` must not leave its watchdog running.
 *
 * From a real tester log: mod #274 started at 13:57:51 and failed 564ms later
 * with "returned no archiveId". Fifteen minutes after that — 14:12:51, exactly
 * the 900s stall budget measured from the START — the orphaned watchdog logged
 * `install.stalled` for a run that had already reported failure and exited.
 *
 * `waitForInstallCompletion` is armed BEFORE the download so a hot cache can't
 * fire `did-install-mod` before we subscribe, and its cleanup runs only when
 * the promise settles. The no-archiveId throw never settled it, so the
 * listener and both timers leaked. The leaked listener is the worse half: it
 * stays subscribed and can match a later install's event.
 */
import { describe, expect, it, vi } from "vitest";

import { installNexusViaApi } from "./modInstall";

type Listener = (...args: unknown[]) => void;

function fakeApi(nexusDownloadResult: unknown): {
  api: never;
  listenerCount: () => number;
} {
  const listeners = new Map<string, Set<Listener>>();
  const api = {
    ext: { nexusDownload: vi.fn().mockResolvedValue(nexusDownloadResult) },
    events: {
      on: (ev: string, fn: Listener) => {
        if (!listeners.has(ev)) listeners.set(ev, new Set());
        listeners.get(ev)!.add(fn);
      },
      removeListener: (ev: string, fn: Listener) => {
        listeners.get(ev)?.delete(fn);
      },
    },
    getState: () => ({ persistent: { downloads: { files: {} } } }),
    store: { subscribe: () => () => undefined },
  };
  return {
    api: api as never,
    listenerCount: () => listeners.get("did-install-mod")?.size ?? 0,
  };
}

describe("installNexusViaApi — a failed download must not leak its watchdog", () => {
  it("removes the did-install-mod listener when nexusDownload returns nothing", async () => {
    vi.useFakeTimers();
    try {
      const { api, listenerCount } = fakeApi(undefined);

      // The download now RETRIES, so the rejection does not arrive until both
      // backoffs have elapsed. Start the assertion, then drive the clock —
      // awaiting first deadlocks against the fake timers.
      const attempt = expect(
        installNexusViaApi(api, {
          gameId: "fallout4",
          nexusModId: 98669,
          nexusFileId: 375818,
          fileName: "Crazy Wasteland - New Magazines.7z",
        } as never),
      ).rejects.toThrow(/returned no archiveId/);
      await vi.advanceTimersByTimeAsync(20_000);
      await attempt;

      // The leak this test exists for: before the fix this was 1, and the
      // watchdog behind it fired 15 minutes later.
      expect(listenerCount()).toBe(0);

      // Advance well past the stall budget AND the 60-minute absolute cap.
      // A leaked timer would fire in here.
      await vi.advanceTimersByTimeAsync(61 * 60_000);
      expect(listenerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries a transient empty answer, and succeeds on a later attempt", async () => {
    vi.useFakeTimers();
    try {
      const { api } = fakeApi(undefined);
      // Empty twice, then a real id — the ZP's Billboards shape (56s, then
      // nothing) rather than the pulled-file shape (<1s, forever).
      const nexusDownload = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce("")
        .mockResolvedValue("archive-3");
      (api as unknown as { ext: { nexusDownload: unknown } }).ext = {
        nexusDownload,
      };

      const p = installNexusViaApi(api, {
        gameId: "fallout4",
        nexusModId: 93047,
        nexusFileId: 353836,
        fileName: "ZP Billboards.7z",
      } as never);
      // Let both backoffs elapse.
      await vi.advanceTimersByTimeAsync(20_000);
      // It got an id on the third attempt, so it is now waiting on
      // did-install-mod rather than having thrown.
      const settled = await Promise.race([
        p.then(() => "resolved").catch((e: Error) => `rejected: ${e.message}`),
        Promise.resolve().then(() => "pending"),
      ]);
      expect(nexusDownload).toHaveBeenCalledTimes(3);
      expect(settled).toBe("pending");
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives up after three attempts and leaks nothing", async () => {
    vi.useFakeTimers();
    try {
      const { api, listenerCount } = fakeApi(undefined);
      const p = installNexusViaApi(api, {
        gameId: "fallout4",
        nexusModId: 98669,
        nexusFileId: 375818,
        fileName: "Crazy Wasteland.7z",
      } as never);
      const assertion = expect(p).rejects.toThrow(/returned no archiveId/);
      await vi.advanceTimersByTimeAsync(20_000);
      await assertion;
      // Every attempt armed a waiter; every one must have been torn down.
      expect(listenerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(61 * 60_000);
      expect(listenerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("still succeeds normally when an archiveId comes back", async () => {
    const { api } = fakeApi("archive-1");
    // No did-install-mod is ever emitted here, so this asserts only that the
    // success path does NOT take the cancel branch — it stays pending rather
    // than rejecting with the no-archiveId error.
    const p = installNexusViaApi(api, {
      gameId: "fallout4",
      nexusModId: 1,
      nexusFileId: 2,
      fileName: "x.7z",
    } as never);
    const settled = await Promise.race([
      p.then(() => "resolved").catch((e: Error) => `rejected: ${e.message}`),
      new Promise((r) => setTimeout(() => r("pending"), 50)),
    ]);
    expect(settled).toBe("pending");
  });
});
