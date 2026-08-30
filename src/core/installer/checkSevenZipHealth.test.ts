/**
 * The preflight exists because an alpha tester on Proton found out that
 * archive extraction was broken by picking a collection and getting an error
 * that named neither the cause nor the fix.
 *
 * Two properties matter more than any individual message:
 *
 *  1. It NEVER throws. It runs before an install and is not allowed to become
 *     a gate — a preflight that wrongly refuses to start is worse than the
 *     failure it guards against, because there is no way past it.
 *  2. It says NOTHING when 7z is healthy. A preflight that announces success
 *     trains people to dismiss it unread, which costs exactly the case it was
 *     built for.
 */
import * as fsp from "fs/promises";
import * as path from "path";

import { describe, expect, it, vi } from "vitest";

// The suite runs with a WORKING mocked util.SevenZip, so calling the real
// resolveSevenZip here returns a healthy handle and the "Vortex never gave us
// 7z" path is unreachable — the first version of this file asserted
// "unavailable" and got "ok". Force the throw instead of relying on the
// ambient environment to produce it. sevenZipSelfTest stays real: it is the
// thing under test.
vi.mock("../manifest/sevenZip", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../manifest/sevenZip")>();
  return {
    ...actual,
    resolveSevenZip: () => {
      throw new Error(
        "vortex-api.util.SevenZip is not available at runtime. " +
          "Are we running outside of Vortex?",
      );
    },
  };
});

import {
  checkSevenZipHealth,
  describeSevenZipHealth,
  type SevenZipHealth,
} from "./checkSevenZipHealth";
import type { SevenZipApi } from "../manifest/sevenZip";

// The self-test now proves EXTRACTION, so a fake whose extractFull resolves
// without producing a file is not a working 7z — it is a 7z that silently
// extracts nothing, which is the failure being guarded against. These fakes
// write the probe file for real so the round-trip is genuinely exercised.
const PROBE = "event-horizon 7z self-test";

const writingExtract =
  (content: string | undefined) =>
  async (_archive: string, dest: string): Promise<{ code: number }> => {
    if (content !== undefined) {
      await fsp.mkdir(dest, { recursive: true });
      await fsp.writeFile(path.join(dest, "probe.txt"), content, "utf8");
    }
    return { code: 0 };
  };

/** Fully working: creates, extracts intact, and lists. */
const workingSevenZip = (): SevenZipApi =>
  ({
    add: () => Promise.resolve({ code: 0 }),
    list: () => Promise.resolve({ type: "zip" }),
    extractFull: writingExtract(PROBE),
  }) as unknown as SevenZipApi;

/**
 * The shape a real tester's Proton prefix produced: create and extract both
 * work, only `list` comes back unusable. NOT fatal — every listing path of
 * ours is native-first, so mods still install.
 */
const listOnlyBrokenSevenZip = (): SevenZipApi =>
  ({
    add: () => Promise.resolve({ code: 0 }),
    // An EMPTY spec is exactly what node-7z resolves with when 7z did not
    // run; it is indistinguishable from a corrupt archive at this layer.
    list: () => Promise.resolve({}),
    extractFull: writingExtract(PROBE),
  }) as unknown as SevenZipApi;

/** Extraction fails: FATAL, because no mod can be unpacked. */
const extractBrokenSevenZip = (): SevenZipApi =>
  ({
    add: () => Promise.resolve({ code: 0 }),
    list: () => Promise.resolve({ type: "zip" }),
    extractFull: () => Promise.reject(new Error("7z extract failed")),
  }) as unknown as SevenZipApi;

/** Extraction "succeeds" but produces nothing — also FATAL, and silent. */
const emptyExtractSevenZip = (): SevenZipApi =>
  ({
    add: () => Promise.resolve({ code: 0 }),
    list: () => Promise.resolve({ type: "zip" }),
    extractFull: writingExtract(undefined),
  }) as unknown as SevenZipApi;

/** A 7z whose binary will not start at all. */
const deadSevenZip = (): SevenZipApi =>
  ({
    add: () => Promise.reject(new Error("spawn 7z.exe ENOENT")),
    list: () => Promise.resolve({}),
    extractFull: () => Promise.reject(new Error("spawn 7z.exe ENOENT")),
  }) as unknown as SevenZipApi;

describe("checkSevenZipHealth", () => {
  it("reports ok when 7z round-trips an archive", async () => {
    expect(await checkSevenZipHealth(workingSevenZip())).toEqual({ kind: "ok" });
  });

  it("grades a list-only failure as NON-fatal", async () => {
    // The shape a real Proton prefix produced. `list` resolving with an empty
    // spec means "7z did not run" and "the file is corrupt" equally, so on its
    // own it proves nothing about installing. Extraction works here, and
    // extraction is what mods need — so this must not block an install.
    const health = await checkSevenZipHealth(listOnlyBrokenSevenZip());
    expect(health.kind).toBe("broken");
    if (health.kind === "broken") {
      expect(health.fatal).toBe(false);
      expect(health.why).toMatch(/cannot list/i);
    }
  });

  it("grades a failed extraction as FATAL", async () => {
    const health = await checkSevenZipHealth(extractBrokenSevenZip());
    expect(health.kind).toBe("broken");
    if (health.kind === "broken") expect(health.fatal).toBe(true);
  });

  it("grades a silent empty extraction as FATAL", async () => {
    // extractFull resolving with code 0 while producing no files is the worst
    // shape: it looks like success everywhere except the filesystem.
    const health = await checkSevenZipHealth(emptyExtractSevenZip());
    expect(health.kind).toBe("broken");
    if (health.kind === "broken") expect(health.fatal).toBe(true);
  });

  it("reports broken when the 7z binary will not start", async () => {
    const health = await checkSevenZipHealth(deadSevenZip());
    expect(health.kind).toBe("broken");
    if (health.kind === "broken") {
      expect(health.fatal).toBe(true);
      expect(health.why).toMatch(/ENOENT|could not run/i);
    }
  });

  it("reports unavailable when Vortex never exposed SevenZip", async () => {
    // resolveSevenZip throws when util.SevenZip is absent (see the mock at the
    // top). That is a real finding about the host, not a failure of this
    // check, and it must not be reported as a broken 7z — the fixes differ.
    const health = await checkSevenZipHealth();
    expect(health.kind).toBe("unavailable");
    if (health.kind === "unavailable") {
      expect(health.why).toMatch(/not available at runtime/);
    }
  });

  it("never throws, whatever the api does", async () => {
    // The property that lets this run unguarded before an install.
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error("hostile api");
        },
      },
    ) as unknown as SevenZipApi;
    await expect(checkSevenZipHealth(hostile)).resolves.toBeDefined();
  });
});

describe("describeSevenZipHealth", () => {
  it("says nothing at all when 7z is healthy", async () => {
    expect(describeSevenZipHealth({ kind: "ok" })).toBeUndefined();
  });

  it("on Wine, points at the setup script before anything manual", async () => {
    const advice = describeSevenZipHealth(
      { kind: "broken", fatal: true, why: "7z could not run" },
      true,
    );
    expect(advice?.message).toMatch(/Wine|Proton/);
    expect(advice?.steps[0]).toMatch(/setup-proton\.sh/);
  });

  it("on Wine, blames the runtime rather than telling them to install 7-Zip", async () => {
    // Vortex SHIPS 7z.exe and 7z.dll in its own app dir -- we found both in
    // the tester's prefix. "Install 7-Zip" is advice that cannot help and
    // costs the user an hour finding that out.
    const advice = describeSevenZipHealth(
      { kind: "broken", fatal: true, why: "x" },
      true,
    );
    const all = advice?.steps.join(" ") ?? "";
    expect(all).toMatch(/vcrun|Visual C\+\+/i);
    expect(all).not.toMatch(/install 7-?zip\b/i);
  });

  it("off Wine, does not send the user to protontricks", async () => {
    const advice = describeSevenZipHealth(
      { kind: "broken", fatal: true, why: "x" },
      false,
    );
    const all = `${advice?.message} ${advice?.steps.join(" ")}`;
    expect(all).not.toMatch(/protontricks|setup-proton/i);
    expect(all).toMatch(/Restart Vortex/i);
  });

  it("keeps the reason, so a report carries the actual error", async () => {
    const advice = describeSevenZipHealth(
      { kind: "broken", fatal: true, why: "spawn 7z.exe ENOENT" },
      true,
    );
    expect(advice?.steps.join(" ")).toContain("spawn 7z.exe ENOENT");
  });

  it("calls an indeterminate result unverified, not a fault", async () => {
    // We do not know anything is wrong. Saying so as if we did would send a
    // user to fix a working system.
    const advice = describeSevenZipHealth({
      kind: "indeterminate",
      why: "probe failed",
    });
    expect(advice?.message).toMatch(/could not verify/i);
    expect(advice?.message).not.toMatch(/\bis not working\b/i);
  });

  it("covers every health kind, so a new one cannot slip through silently", async () => {
    const kinds: SevenZipHealth[] = [
      { kind: "ok" },
      { kind: "unavailable", why: "w" },
      { kind: "broken", fatal: true, why: "w" },
      { kind: "indeterminate", why: "w" },
    ];
    for (const k of kinds) {
      const advice = describeSevenZipHealth(k, true);
      if (k.kind === "ok") {
        expect(advice).toBeUndefined();
      } else {
        expect(advice?.message.length ?? 0).toBeGreaterThan(0);
        expect(advice?.steps.length ?? 0).toBeGreaterThan(0);
      }
    }
  });
});
