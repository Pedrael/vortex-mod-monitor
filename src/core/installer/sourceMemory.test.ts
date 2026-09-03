/**
 * Where the user said an external mod lives.
 *
 * A collection carries mods Vortex cannot fetch, and the install asks the user
 * to point at each archive. That answer used to live only in wizard state, so
 * resuming asked again for every one — a tester with two dozen external mods
 * re-supplied all of them to continue an install he had already answered.
 *
 * The dangerous direction is remembering too eagerly: a stale path fails
 * SILENTLY, pre-filling an answer nobody re-confirms and installing from a
 * file that has since moved or changed.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

import {
  forgetSources,
  readSourceMemory,
  rememberSource,
  usableSources,
} from "./sourceMemory";

let dir: string;
beforeEach(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), "eh-src-"));
});
afterEach(async () => {
  await fsp.rm(dir, { recursive: true, force: true }).catch(() => undefined);
});

describe("remembering answers", () => {
  it("round-trips one answer", async () => {
    await rememberSource(dir, "pkg", "external:abc", "C:/mods/thing.7z");
    const mem = await readSourceMemory(dir, "pkg");
    expect(mem["external:abc"]?.path).toBe("C:/mods/thing.7z");
  });

  it("MERGES, so answering the second mod does not forget the first", async () => {
    // Answers arrive one at a time as the user works down the list. A write
    // that replaced the file would lose everything said before it — which is
    // the whole problem this exists to solve.
    await rememberSource(dir, "pkg", "external:a", "C:/a.7z");
    await rememberSource(dir, "pkg", "external:b", "C:/b.7z");
    const mem = await readSourceMemory(dir, "pkg");
    expect(Object.keys(mem).sort()).toEqual(["external:a", "external:b"]);
  });

  it("keeps collections apart", async () => {
    // Two collections may legitimately reference the same mod from different
    // places.
    await rememberSource(dir, "pkg-1", "external:a", "C:/one.7z");
    await rememberSource(dir, "pkg-2", "external:a", "C:/two.7z");
    expect((await readSourceMemory(dir, "pkg-1"))["external:a"]?.path).toBe(
      "C:/one.7z",
    );
    expect((await readSourceMemory(dir, "pkg-2"))["external:a"]?.path).toBe(
      "C:/two.7z",
    );
  });

  it("overwrites when the user changes their mind", async () => {
    await rememberSource(dir, "pkg", "external:a", "C:/old.7z");
    await rememberSource(dir, "pkg", "external:a", "C:/new.7z");
    expect((await readSourceMemory(dir, "pkg"))["external:a"]?.path).toBe(
      "C:/new.7z",
    );
  });

  it("forgets a collection on request", async () => {
    await rememberSource(dir, "pkg", "external:a", "C:/a.7z");
    await forgetSources(dir, "pkg");
    expect(await readSourceMemory(dir, "pkg")).toEqual({});
  });
});

describe("refusing to fail an install", () => {
  it("reads nothing rather than throwing when there is no file", async () => {
    expect(await readSourceMemory(dir, "never-written")).toEqual({});
  });

  it("reads nothing rather than throwing on corrupt json", async () => {
    const d = path.join(dir, "event-horizon", "install-ledger", "sources");
    await fsp.mkdir(d, { recursive: true });
    await fsp.writeFile(path.join(d, "pkg.json"), "{ not json", "utf8");
    expect(await readSourceMemory(dir, "pkg")).toEqual({});
  });

  it("skips entries with no usable path", async () => {
    const d = path.join(dir, "event-horizon", "install-ledger", "sources");
    await fsp.mkdir(d, { recursive: true });
    await fsp.writeFile(
      path.join(d, "pkg.json"),
      JSON.stringify({ a: { path: "" }, b: {}, c: { path: "C:/ok.7z" } }),
      "utf8",
    );
    expect(Object.keys(await readSourceMemory(dir, "pkg"))).toEqual(["c"]);
  });

  it("never throws when the answer cannot be written", async () => {
    const blocked = path.join(dir, "a-file-not-a-dir");
    await fsp.writeFile(blocked, "x", "utf8");
    await expect(
      rememberSource(blocked, "pkg", "external:a", "C:/a.7z"),
    ).resolves.toBeUndefined();
  });
});

describe("usableSources", () => {
  const mem = {
    gone: { path: "C:/gone.7z", rememberedAt: "" },
    here: { path: "C:/here.7z", rememberedAt: "" },
  };

  it("drops answers whose file is no longer there", async () => {
    // The load-bearing rule. Drives get unplugged and folders get tidied; a
    // pre-filled answer pointing at nothing is worse than asking again,
    // because nobody re-confirms a field that looks already answered.
    const usable = await usableSources(mem, async (p) => p === "C:/here.7z");
    expect(Object.keys(usable)).toEqual(["here"]);
  });

  it("keeps them all when they all exist", async () => {
    expect(Object.keys(await usableSources(mem, async () => true)).sort()).toEqual(
      ["gone", "here"],
    );
  });

  it("returns nothing when none exist", async () => {
    expect(await usableSources(mem, async () => false)).toEqual({});
  });

  it("handles an empty memory", async () => {
    expect(await usableSources({}, async () => true)).toEqual({});
  });
});
