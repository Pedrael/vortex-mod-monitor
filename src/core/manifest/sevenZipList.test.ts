/**
 * node-7z RESOLVES on failure instead of rejecting. So every way a list can go
 * wrong — a binary that will not spawn, an unreachable path, no permission, a
 * Wine prefix without a working 7z — comes back as a result object with no
 * `type`, indistinguishable from a genuinely bad archive.
 *
 * `sevenZipList` inferred from that alone and reported all of them as
 * "missing, corrupt, password-protected, or not an archive" — while the exit
 * code and stderr sat unread on the result. An alpha tester on Proton hit a
 * failure whose real cause was invisible for exactly this reason, and the
 * message pointed at his file instead.
 *
 * `extractFull` and `add` had always run their results through assertOk. Only
 * `list` did not.
 */
import * as fsp from "fs/promises";
import * as path from "path";

import { describe, expect, it } from "vitest";

import { sevenZipList, sevenZipSelfTest } from "./sevenZip";
import type { SevenZipApi } from "./sevenZip";

/** A node-7z double: whatever the real one would have resolved with. */
const apiResolving = (result: unknown): SevenZipApi =>
  ({
    list: async () => result,
  }) as unknown as SevenZipApi;

describe("sevenZipList", () => {
  it("surfaces 7z's exit code and stderr instead of blaming the file", async () => {
    await expect(
      sevenZipList(
        apiResolving({ code: 2, errors: ["ERROR: cannot find archive"] }),
        "X:/Downloads/thing.ehcoll",
      ),
    ).rejects.toThrow(/exited with code 2.*cannot find archive/s);
  });

  it("never calls the file corrupt on this path", async () => {
    // The failure mode that cost the alpha a diagnosis: the message named the
    // user's download as the problem when nothing had established that.
    const err = await sevenZipList(
      apiResolving({ code: 127, errors: ["not found"] }),
      "a.ehcoll",
    ).catch((e: Error) => e);
    expect(String(err)).not.toMatch(/corrupt/i);
    expect(String(err)).not.toMatch(/password-protected/i);
  });

  it("does NOT accuse the file, because an empty spec cannot single it out", async () => {
    // node-7z's `list` resolves with an archive SPEC and discards {code,
    // errors}, so an empty spec means the same thing for a corrupt file, a
    // truncated download, an unreachable path, and a 7z that will not run.
    // The old message picked one of those and stated it. Separating them is
    // the caller's job — diagnoseArchive for the file, sevenZipSelfTest for
    // 7z — and this message says so instead of guessing.
    const err = await sevenZipList(apiResolving({ code: 0 }), "b.ehcoll").catch(
      (e: Error) => e,
    );
    expect(String(err)).toMatch(/no archive information/);
    expect(String(err)).not.toMatch(/corrupt/i);
    expect(String(err)).toMatch(/7z itself/);
  });

  it("accepts a good archive and returns its entries", async () => {
    const api = {
      list: async (
        _a: string,
        _o: unknown,
        onBatch: (b: { name: string }[]) => void,
      ) => {
        onBatch([{ name: "manifest.json" }, { name: "bundled/x.zip" }]);
        return { type: "zip", code: 0 };
      },
    } as unknown as SevenZipApi;
    const entries = await sevenZipList(api, "good.ehcoll");
    expect(entries.map((e) => e.name)).toEqual([
      "manifest.json",
      "bundled/x.zip",
    ]);
  });

  it("treats a missing code as success, since node-7z omits it on the happy path", async () => {
    const api = {
      list: async (
        _a: string,
        _o: unknown,
        onBatch: (b: { name: string }[]) => void,
      ) => {
        onBatch([{ name: "manifest.json" }]);
        return { type: "zip" };
      },
    } as unknown as SevenZipApi;
    await expect(sevenZipList(api, "ok.ehcoll")).resolves.toHaveLength(1);
  });
});

describe("sevenZipSelfTest", () => {
  it("reports 7z as broken when it cannot run at all", async () => {
    // The question `list` cannot answer: is the file bad, or is 7z bad? Both
    // resolve with an empty spec, so the only way to separate them is to ask
    // 7z to do something that must succeed.
    const api = {
      add: async () => {
        throw new Error("spawn 7z ENOENT");
      },
    } as unknown as SevenZipApi;
    const health = await sevenZipSelfTest(api);
    expect(health.ok).toBe(false);
    if (health.ok) throw new Error("unreachable");
    expect(health.why).toMatch(/ENOENT|could not run/);
  });

  it("grades a list-only failure NON-fatal, because extraction still works", async () => {
    // The shape a real Proton prefix produced: create and extract both work,
    // only `list` comes back unusable. That used to be reported as a dead
    // extractor, which pointed the diagnosis at a missing Visual C++ runtime -
    // something the successful `add` had already ruled out, since a missing
    // DLL means the exe never starts. Listing is also the one operation we
    // route around natively, so it cannot justify blocking an install.
    const api = {
      add: async () => ({ code: 0 }),
      list: async () => ({}),
      extractFull: async (_a: string, dest: string) => {
        await fsp.mkdir(dest, { recursive: true });
        await fsp.writeFile(
          path.join(dest, "probe.txt"),
          "event-horizon 7z self-test",
          "utf8",
        );
        return { code: 0 };
      },
    } as unknown as SevenZipApi;
    const health = await sevenZipSelfTest(api);
    expect(health.ok).toBe(false);
    if (health.ok) throw new Error("unreachable");
    expect(health.fatal).toBe(false);
    expect(health.why).toMatch(/cannot list/i);
  });

  it("grades a failed extraction FATAL, because no mod can be unpacked", async () => {
    const api = {
      add: async () => ({ code: 0 }),
      list: async () => ({ type: "zip" }),
      extractFull: async () => {
        throw new Error("extract blew up");
      },
    } as unknown as SevenZipApi;
    const health = await sevenZipSelfTest(api);
    expect(health.ok).toBe(false);
    if (health.ok) throw new Error("unreachable");
    expect(health.fatal).toBe(true);
  });

  it("passes only when the archive survives a real extract round trip", async () => {
    // extractFull writes the probe back for real. A double that resolved
    // without producing a file would be a 7z that silently extracts nothing -
    // which is the worst failure shape there is, and now fails this test.
    const api = {
      add: async () => ({ code: 0 }),
      list: async () => ({ type: "zip" }),
      extractFull: async (_a: string, dest: string) => {
        await fsp.mkdir(dest, { recursive: true });
        await fsp.writeFile(
          path.join(dest, "probe.txt"),
          "event-horizon 7z self-test",
          "utf8",
        );
        return { code: 0 };
      },
    } as unknown as SevenZipApi;
    expect(await sevenZipSelfTest(api)).toEqual({ ok: true });
  });
});
