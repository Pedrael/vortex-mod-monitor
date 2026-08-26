/**
 * Contract tests for the node-7z integration.
 *
 * Every assertion here corresponds to a defect that shipped and survived a
 * green test suite, because the old fixtures modelled an API that does not
 * exist (an event-emitter stream). The real one — node-7z 0.8.1, Nexus's
 * fork, bundled in Vortex's app.asar — is a constructor with promise-returning
 * prototype methods. Each case below FAILS against the previous
 * implementation, which is the only reason to keep it.
 */
import { describe, expect, it } from "vitest";

import {
  resolveSevenZip,
  sevenZipAdd,
  sevenZipExtractFull,
  sevenZipList,
} from "./sevenZip";
import { fakeSevenZip, type FakeSevenZipCall } from "./testing/fakeSevenZip";

describe("resolveSevenZip", () => {
  it("INSTANTIATES the constructor — methods live on the prototype", () => {
    // The bug: returning `util.SevenZip` itself yields an object whose `list`
    // is undefined, so every call threw `TypeError: Zip.list is not a
    // function` and was swallowed as "skipped". 993 mods, 112ms, no I/O.
    const api = resolveSevenZip();
    expect(typeof api.list).toBe("function");
    expect(typeof api.add).toBe("function");
    expect(typeof api.extractFull).toBe("function");
  });

  it("does not expose `extract`, which flattens the directory tree", () => {
    // node-7z's `extract` runs 7z `e`: verified on a real archive to produce
    // 9 files with 0 nested paths, against extractFull's 9 with 9. A mod
    // installer using it would collapse every folder into one.
    expect((resolveSevenZip() as Record<string, unknown>).extract).toBeUndefined();
  });
});

describe("sevenZipList", () => {
  it("collects entries from the progress callback, not a data event", async () => {
    const entries = await sevenZipList(
      fakeSevenZip({ entries: [{ name: "a.esp", size: 1 }, { name: "b.esp", size: 2 }] }),
      "x.zip",
    );
    expect(entries.map((e) => e.name)).toEqual(["a.esp", "b.esp"]);
  });

  it("THROWS when 7z could not open the archive, despite resolving", async () => {
    // node-7z resolves with an empty spec for a missing or corrupt file. A
    // silent empty listing would report every staged file as unexplained.
    await expect(
      sevenZipList(fakeSevenZip({ unreadable: true }), "corrupt.zip"),
    ).rejects.toThrow(/no archive information/i);
  });

  it("returns empty for a valid but genuinely empty archive", async () => {
    // "Cannot verify" and "nothing to verify" must not look the same.
    await expect(sevenZipList(fakeSevenZip({ entries: [] }), "empty.zip")).resolves.toEqual([]);
  });
});

describe("exit-code handling", () => {
  // node-7z resolves on child `close` regardless of exit status, so a failed
  // 7z run looks exactly like a successful one to an unchecked `await`. For a
  // tool that promises deterministic reproduction, silently "extracting"
  // nothing is the worst available outcome.
  it("sevenZipExtractFull throws on a non-zero exit code", async () => {
    await expect(
      sevenZipExtractFull(
        fakeSevenZip({ code: 2, errors: ["Cannot open the file as archive"] }),
        "a.zip",
        "/dest",
      ),
    ).rejects.toThrow(/code 2.*Cannot open the file as archive/s);
  });

  it("sevenZipAdd throws on a non-zero exit code", async () => {
    await expect(
      sevenZipAdd(fakeSevenZip({ code: 7, errors: ["Unknown switch"] }), "o.ehcoll", ["*"]),
    ).rejects.toThrow(/code 7/);
  });

  it("resolves normally on exit code 0", async () => {
    await expect(
      sevenZipAdd(fakeSevenZip({ code: 0 }), "o.ehcoll", ["*"]),
    ).resolves.toBeUndefined();
  });
});

describe("option and argument shapes", () => {
  it("passes sources as an ARRAY — node-7z calls .map on them", async () => {
    // `add(archive, "*")` threw `files.map is not a function`.
    const calls: FakeSevenZipCall[] = [];
    await sevenZipAdd(fakeSevenZip({ calls }), "o.ehcoll", ["/staging/*"], {
      raw: ["-tzip"],
      r: true,
    });
    const [, sources, opts] = calls[0]!.args as [string, unknown, Record<string, unknown>];
    expect(Array.isArray(sources)).toBe(true);

    // 0.8.1 renders unknown keys literally: `$raw: ["-tzip"]` became the
    // garbage switch `-$raw-tzip`, and 7z rejected the whole command.
    expect(opts).toEqual({ raw: ["-tzip"], r: true });
    expect(opts).not.toHaveProperty("$raw");
    expect(opts).not.toHaveProperty("recursive");
    expect(opts).not.toHaveProperty("workingDir");
  });

  it("cherry-picks through `raw`, as a trailing positional filter", async () => {
    const calls: FakeSevenZipCall[] = [];
    await sevenZipExtractFull(fakeSevenZip({ calls }), "a.ehcoll", "/tmp/x", {
      raw: ["manifest.json"],
    });
    const [, , opts] = calls[0]!.args as [string, string, Record<string, unknown>];
    expect(opts).toEqual({ raw: ["manifest.json"] });
    expect(opts).not.toHaveProperty("$cherryPick");
  });
});
