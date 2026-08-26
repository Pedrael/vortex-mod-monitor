/**
 * The bug: everything typed into the external-mods table lived only in a
 * module-scoped session, so a Vortex restart discarded it. Measured on the
 * real config — 32 entries, last written two hours earlier, zero links saved
 * while the curator was actively filling them in.
 *
 * Two things have to hold. Typing must not produce a write per keystroke, and
 * a write must never drop the fields the form cannot see — packageId above
 * all, which is the collection's identity across releases.
 */
import { describe, expect, it, vi } from "vitest";

import {
  configWithOverrides,
  createOverridePersister,
  PERSIST_DELAY_MS,
} from "./persistOverrides";
import type { CollectionConfig } from "../../../core/manifest/collectionConfig";

const cfg = (over: Partial<CollectionConfig> = {}): CollectionConfig =>
  ({
    schemaVersion: 1,
    packageId: "11111111-2222-4333-8444-555555555555",
    externalMods: {},
    ...over,
  }) as CollectionConfig;

/** A controllable clock, so the debounce is asserted rather than slept through. */
const fakeTimers = () => {
  let queued: (() => void) | undefined;
  return {
    deps: {
      setTimer: (fn: () => void) => {
        queued = fn;
        return 1;
      },
      clearTimer: () => {
        queued = undefined;
      },
    },
    fire: () => {
      const f = queued;
      queued = undefined;
      f?.();
    },
    armed: () => queued !== undefined,
  };
};

describe("createOverridePersister", () => {
  it("coalesces a burst of typing into one write", async () => {
    // Thirty-two rows filled in one sitting is a lot of keystrokes.
    const write = vi.fn(async () => undefined);
    const t = fakeTimers();
    const p = createOverridePersister({ write, ...t.deps });

    p.save({ configPath: "a.json", config: cfg() });
    p.save({ configPath: "a.json", config: cfg() });
    p.save({ configPath: "a.json", config: cfg({ readme: "third" } as never) });
    expect(write).not.toHaveBeenCalled();

    t.fire();
    await Promise.resolve();
    expect(write).toHaveBeenCalledTimes(1);
    // And it saves the LATEST value, not the first.
    expect((write.mock.calls[0]! as unknown[])[1]).toMatchObject({
      readme: "third",
    });
  });

  it("flush writes immediately, for a page that is going away", async () => {
    const write = vi.fn(async () => undefined);
    const t = fakeTimers();
    const p = createOverridePersister({ write, ...t.deps });

    p.save({ configPath: "a.json", config: cfg() });
    await p.flush();
    expect(write).toHaveBeenCalledTimes(1);
    // The pending timer is cancelled, so it does not write twice.
    expect(t.armed()).toBe(false);
  });

  it("flush with nothing pending does nothing", async () => {
    const write = vi.fn(async () => undefined);
    const p = createOverridePersister({ write, ...fakeTimers().deps });
    await p.flush();
    expect(write).not.toHaveBeenCalled();
  });

  it("survives a failing write without breaking the form", async () => {
    // The build still writes the config, so a failed autosave loses a round,
    // not the only route to disk — and must never throw into a keystroke.
    const write = vi.fn(async () => {
      throw new Error("disk full");
    });
    const t = fakeTimers();
    const p = createOverridePersister({ write, ...t.deps });
    p.save({ configPath: "a.json", config: cfg() });
    t.fire();
    await expect(p.flush()).resolves.toBeUndefined();
  });

  it("debounces on a delay a human would not notice", () => {
    expect(PERSIST_DELAY_MS).toBeGreaterThan(200);
    expect(PERSIST_DELAY_MS).toBeLessThan(3000);
  });
});

describe("configWithOverrides", () => {
  it("keeps fields the form cannot see", () => {
    // packageId is the collection's identity across releases. Writing only
    // what the form knows would delete it.
    const out = configWithOverrides({
      config: cfg({ readme: "kept" } as never),
      overrides: { "mod-1": { url: "https://e.com/a" } },
    });
    expect(out.packageId).toBe("11111111-2222-4333-8444-555555555555");
    expect((out as { readme?: string }).readme).toBe("kept");
  });

  it("merges rather than replaces the external-mod map", () => {
    const out = configWithOverrides({
      config: cfg({ externalMods: { "mod-1": { bundled: true } } }),
      overrides: { "mod-2": { url: "https://e.com/b" } },
    });
    expect(Object.keys(out.externalMods).sort()).toEqual(["mod-1", "mod-2"]);
  });

  it("lets a newer entry win for the same mod", () => {
    const out = configWithOverrides({
      config: cfg({ externalMods: { "mod-1": { instructions: "old" } } }),
      overrides: { "mod-1": { instructions: "new" } },
    });
    expect(out.externalMods["mod-1"]).toEqual({ instructions: "new" });
  });
});
