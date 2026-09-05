/**
 * The property Vortex gets wrong, pinned.
 *
 * Vortex's bulk update loses files because it installs concurrently. Every
 * other test here matters less than the overlap one: if two updates can ever
 * run at the same time, this module has reproduced the bug it exists to avoid.
 */
import { describe, expect, it, vi } from "vitest";

import { describeBulkUpdate, runBulkUpdate } from "./bulkUpdate";
import type { CuratorMod, UpdateCandidate } from "./profileActions";

const mod = (id: string): CuratorMod => ({
  id,
  name: id,
  enabled: true,
  modType: "",
});

const candidate = (id: string): UpdateCandidate => ({
  mod: mod(id),
  fromFileId: 1,
  toFileId: 2,
  fromVersion: "1.0",
  toVersion: "2.0",
});

const ok = async (): Promise<{ kind: "ok" }> => ({ kind: "ok" });
const wait = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

describe("updates never overlap", () => {
  it("starts each mod only after the previous one has finished", async () => {
    // The whole feature. Recorded as intervals rather than a counter so a
    // failure says WHICH pair overlapped.
    const spans: { id: string; start: number; end: number }[] = [];
    let clock = 0;
    let live = 0;
    let maxLive = 0;

    await runBulkUpdate({
      candidates: [candidate("a"), candidate("b"), candidate("c")],
      update: async (c) => {
        live += 1;
        maxLive = Math.max(maxLive, live);
        const start = clock++;
        await wait(5);
        live -= 1;
        spans.push({ id: c.mod.id, start, end: clock++ });
      },
      verify: ok,
    });

    expect(maxLive).toBe(1);
    expect(spans.map((s) => s.id)).toEqual(["a", "b", "c"]);
    for (let i = 1; i < spans.length; i += 1) {
      expect(spans[i]!.start).toBeGreaterThan(spans[i - 1]!.end);
    }
  });

  it("verifies each mod before the next update begins", async () => {
    // Verifying at the END would report that something in the last forty mods
    // lost files. Verifying between says which one, while its archive is
    // still the obvious next thing to try.
    const order: string[] = [];
    await runBulkUpdate({
      candidates: [candidate("a"), candidate("b")],
      update: async (c) => {
        order.push(`update:${c.mod.id}`);
        await wait(1);
      },
      verify: async (m) => {
        order.push(`verify:${m.id}`);
        return { kind: "ok" };
      },
    });
    expect(order).toEqual(["update:a", "verify:a", "update:b", "verify:b"]);
  });
});

describe("what each mod's outcome is", () => {
  it("reports dropped files as their own kind, with the names", async () => {
    const report = await runBulkUpdate({
      candidates: [candidate("a")],
      update: async () => undefined,
      verify: async () => ({ kind: "missing", missing: ["Data/x.esp"] }),
    });
    expect(report.outcomes[0]).toEqual({
      kind: "files-dropped",
      mod: mod("a"),
      missing: ["Data/x.esp"],
    });
  });

  it("does not call a mod updated when the check could not run", async () => {
    // "Not checked" is not "fine", and collapsing them is the lie this
    // module exists to prevent.
    const report = await runBulkUpdate({
      candidates: [candidate("a")],
      update: async () => undefined,
      verify: async () => ({ kind: "cannot-check", why: "no archive" }),
    });
    expect(report.outcomes[0]!.kind).toBe("unverified");
  });

  it("treats a check that THREW as unverified, not as passed", async () => {
    const report = await runBulkUpdate({
      candidates: [candidate("a")],
      update: async () => undefined,
      verify: async () => {
        throw new Error("7z exploded");
      },
    });
    expect(report.outcomes[0]).toMatchObject({
      kind: "unverified",
      why: "7z exploded",
    });
  });

  it("records a failed update and does not then verify it", async () => {
    const verify = vi.fn(ok);
    const report = await runBulkUpdate({
      candidates: [candidate("a")],
      update: async () => {
        throw new Error("download refused");
      },
      verify,
    });
    expect(report.outcomes[0]).toMatchObject({ kind: "failed" });
    expect(verify).not.toHaveBeenCalled();
  });

  it("keeps going after one failure", async () => {
    // Unrelated mods. Abandoning thirty because the second failed turns one
    // bad archive into an afternoon.
    const report = await runBulkUpdate({
      candidates: [candidate("a"), candidate("b"), candidate("c")],
      update: async (c) => {
        if (c.mod.id === "b") throw new Error("nope");
      },
      verify: ok,
    });
    expect(report.outcomes.map((o) => o.kind)).toEqual([
      "updated",
      "failed",
      "updated",
    ]);
  });
});

describe("stopping", () => {
  it("leaves the remaining mods untouched", async () => {
    const controller = new AbortController();
    const touched: string[] = [];
    const report = await runBulkUpdate({
      candidates: [candidate("a"), candidate("b"), candidate("c")],
      update: async (c) => {
        touched.push(c.mod.id);
        if (c.mod.id === "a") controller.abort();
      },
      verify: ok,
      signal: controller.signal,
    });
    expect(touched).toEqual(["a"]);
    expect(report.cancelled).toBe(true);
    expect(report.outcomes).toHaveLength(1);
  });

  it("does nothing at all when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const update = vi.fn(async () => undefined);
    const report = await runBulkUpdate({
      candidates: [candidate("a")],
      update,
      verify: ok,
      signal: controller.signal,
    });
    expect(update).not.toHaveBeenCalled();
    expect(report.cancelled).toBe(true);
  });
});

describe("what the curator reads afterwards", () => {
  it("leads with dropped files and names them", async () => {
    const lines = describeBulkUpdate({
      cancelled: false,
      outcomes: [
        { kind: "updated", mod: mod("fine") },
        {
          kind: "files-dropped",
          mod: mod("broken"),
          missing: ["a.esp", "b.esp"],
        },
      ],
    });
    expect(lines[0]).toContain('"broken" LOST 2 file(s)');
    expect(lines[0]).toContain("a.esp");
    expect(lines[0]).toContain("Reinstall this mod");
  });

  it("never folds a dropped-file mod into the success count", async () => {
    // "38 updated, 2 issues" invites reading the 38 and moving on.
    const lines = describeBulkUpdate({
      cancelled: false,
      outcomes: [
        { kind: "updated", mod: mod("a") },
        { kind: "files-dropped", mod: mod("b"), missing: ["x"] },
      ],
    });
    expect(lines.some((l) => l.includes("1 mod(s) updated and verified"))).toBe(
      true,
    );
  });

  it("says plainly that unverified is not fine", () => {
    const lines = describeBulkUpdate({
      cancelled: false,
      outcomes: [{ kind: "unverified", mod: mod("a"), why: "no archive" }],
    });
    expect(lines.join(" ")).toContain("Not checked is not the same as fine");
  });

  it("mentions an early stop rather than implying the run completed", () => {
    const lines = describeBulkUpdate({ cancelled: true, outcomes: [] });
    expect(lines.join(" ")).toContain("Stopped early");
  });
});
