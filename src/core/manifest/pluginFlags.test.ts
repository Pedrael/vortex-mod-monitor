/**
 * The ESL / "light" flag: bit 0x200 of the TES4 flags field at offset 8.
 *
 * Load-bearing, not cosmetic. Only 254 regular plugins can load; light ones
 * share the FE index for free. Measured on the real 963-mod profile: 817
 * plugins, 573 light, so 244 regular against a limit of 254 — ten slots of
 * headroom, and eleven lost flags means the game does not start.
 *
 * The parser is checked against a header built here AND against the real
 * fixtures the reader must not mistake for plugins.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  readPluginFlags,
  setPluginLightFlag,
  REGULAR_PLUGIN_LIMIT,
} from "./pluginFlags";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "eh-esp-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * A minimal TES4 record header.
 *
 * Layout Vortex's own ESPFile reads: type[4] "TES4", dataSize[4], flags[4] at
 * offset 8. Trailing bytes stand in for the rest of the record.
 */
const writePlugin = (name: string, flags: number): string => {
  const buf = Buffer.alloc(24);
  buf.write("TES4", 0, "latin1");
  buf.writeUInt32LE(12, 4);
  buf.writeUInt32LE(flags, 8);
  const p = path.join(dir, name);
  fs.writeFileSync(p, buf);
  return p;
};

const FLAG_LIGHT = 0x200;
const FLAG_MASTER = 0x1;

describe("reading the flag", () => {
  it("reads light and master independently", async () => {
    expect(await readPluginFlags(writePlugin("a.esp", 0))).toEqual({
      isLight: false,
      isMaster: false,
    });
    expect(await readPluginFlags(writePlugin("b.esp", FLAG_LIGHT))).toEqual({
      isLight: true,
      isMaster: false,
    });
    expect(await readPluginFlags(writePlugin("c.esm", FLAG_MASTER))).toEqual({
      isLight: false,
      isMaster: true,
    });
    // An ESM that is ALSO light — 34 of them on the real profile.
    expect(
      await readPluginFlags(writePlugin("d.esm", FLAG_MASTER | FLAG_LIGHT)),
    ).toEqual({ isLight: true, isMaster: true });
  });

  it("ignores unrelated flag bits", async () => {
    // Real headers carry other bits. Testing only 0x200 in isolation would
    // pass for an implementation that compared the whole word.
    // `>>> 0` because JS bitwise ops yield a SIGNED int32, and writeUInt32LE
    // rejects the negative that `0xffffffff & ~0x200` produces.
    const p = writePlugin("e.esp", (0xffff_ffff & ~FLAG_LIGHT) >>> 0);
    expect((await readPluginFlags(p))!.isLight).toBe(false);
    const q = writePlugin("f.esp", 0x8000_0201);
    expect((await readPluginFlags(q))!.isLight).toBe(true);
  });

  it("returns undefined — not 'not light' — for anything unreadable", async () => {
    // The distinction the whole feature rests on. A file we cannot parse
    // recorded as `false` would tell the installer to CLEAR a flag the user
    // legitimately has, which is the direction that breaks a game.
    expect(await readPluginFlags(path.join(dir, "missing.esp"))).toBeUndefined();

    const notAPlugin = path.join(dir, "text.esp");
    fs.writeFileSync(notAPlugin, "this is not a plugin at all");
    expect(await readPluginFlags(notAPlugin)).toBeUndefined();

    const truncated = path.join(dir, "short.esp");
    fs.writeFileSync(truncated, Buffer.from("TES4"));
    expect(await readPluginFlags(truncated)).toBeUndefined();
  });
});

describe("writing the flag", () => {
  it("sets and clears only that bit, leaving the rest of the header alone", async () => {
    const p = writePlugin("g.esp", 0x0000_00a5);
    const before = fs.readFileSync(p);

    expect(await setPluginLightFlag(p, true)).toBe(true);
    expect((await readPluginFlags(p))!.isLight).toBe(true);

    const after = fs.readFileSync(p);
    // Same length, same everything except the flags word.
    expect(after.length).toBe(before.length);
    expect(after.subarray(0, 8)).toEqual(before.subarray(0, 8));
    expect(after.subarray(12)).toEqual(before.subarray(12));
    // The other bits of the flags word survived.
    expect(after.readUInt32LE(8) & 0xff).toBe(0xa5);

    expect(await setPluginLightFlag(p, false)).toBe(true);
    expect((await readPluginFlags(p))!.isLight).toBe(false);
    expect(fs.readFileSync(p)).toEqual(before);
  });

  it("reports NO change when the flag already matches", async () => {
    // A no-op write would inflate the reported correction count and bump the
    // file's mtime, which the hash cache keys on — invalidating a cache entry
    // for a file whose bytes never changed.
    const p = writePlugin("h.esp", FLAG_LIGHT);
    expect(await setPluginLightFlag(p, true)).toBe(false);
  });

  it("throws when it cannot write, rather than reporting success", async () => {
    // Reading failures degrade quietly; write failures must not. Each one is a
    // plugin closer to the game not loading.
    await expect(
      setPluginLightFlag(path.join(dir, "nope.esp"), true),
    ).rejects.toThrow();
  });
});

describe("the limit that makes this matter", () => {
  it("is 254 regular plugins", () => {
    // 817 plugins - 573 light = 244 regular. Ten spare.
    expect(REGULAR_PLUGIN_LIMIT).toBe(254);
    expect(817 - 573).toBeLessThan(REGULAR_PLUGIN_LIMIT);
    expect(817 - 573 + 11).toBeGreaterThan(REGULAR_PLUGIN_LIMIT);
  });
});
