/**
 * ──────────────────────────────────────────────────────────────────────
 * The ESL / "light" flag, read from and written to the plugin file itself.
 *
 * ─── WHY THIS IS LOAD-BEARING, NOT COSMETIC ────────────────────────────
 * Fallout 4 and Skyrim SE address regular plugins with one byte, so only 254
 * can load. Light plugins live in the shared `FE` slot instead and do not
 * consume an index, which is the only reason a large collection can exist at
 * all.
 *
 * Measured on the real 963-mod profile this was built for: 817 plugins, of
 * which 573 are light-flagged and 537 carry the flag WITHOUT an `.esl`
 * extension. That leaves 244 regular plugins against a limit of 254 — ten
 * slots of headroom. Lose eleven flags on the user's machine and the game
 * does not start.
 *
 * ─── AND THE LOSS IS SILENT BY CONSTRUCTION ────────────────────────────
 * The flag is a bit inside the plugin file, so a curator who marks a plugin
 * light after installing it has changed a staged file that the ARCHIVE does
 * not contain. On the user's machine the archive is what gets installed, so
 * their copy differs — and `judgeReinstall` then correctly observes that the
 * user's bytes match the archive, concludes "the curator's staging diverged",
 * and accepts it. Every other kind of divergence that reasoning excuses is
 * genuinely harmless. This one is not, which is why it has to be carried
 * explicitly rather than left to file comparison.
 *
 * ─── THE FORMAT ────────────────────────────────────────────────────────
 * Every plugin begins with a TES4 record: a 4-byte type tag, a 4-byte data
 * size, then a 4-byte flags field at offset 8. This mirrors Vortex's own
 * `ESPFile` exactly — it reads `buf.readUInt32LE(8)` and tests `flags &
 * FLAG_LIGHT`, and its `setLightFlag` rewrites those same four bytes.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as fsp from "fs/promises";

/** Bit 0: this plugin is a master (ESM), regardless of extension. */
const FLAG_MASTER = 0x1;
/**
 * Bit 9: light (ESL / "ESP-FE").
 *
 * Starfield uses a different bit, which is why Vortex's ESPFile branches on
 * game mode. Every game Event Horizon supports is a pre-Starfield Bethesda
 * title, so this is the only value in play — stated here so the assumption is
 * visible if that ever changes.
 */
const FLAG_LIGHT = 0x200;

/** Offset of the 4-byte flags field inside the TES4 header. */
const FLAGS_OFFSET = 8;
const HEADER_BYTES = 12;

export type PluginFlags = {
  isLight: boolean;
  isMaster: boolean;
};

/**
 * Read a plugin's header flags, or `undefined` when it is not a plugin we can
 * parse.
 *
 * Never throws. A file we cannot read is not a plugin whose flag is `false` —
 * those are different facts, and collapsing them would let an unreadable file
 * be recorded as "not light", which is the direction that breaks a game.
 */
/**
 * ─── WHY THE READ FAILED, FOR THE CALLER THAT HAS TO EXPLAIN IT ────────
 * `readPluginFlags` collapses every failure to `undefined`, which is right
 * for deciding whether to WRITE a flag — any doubt means leave the file
 * alone. It is wrong for telling a user what happened: a plugin that is not
 * on disk, one the game has open, and one that is not a plugin at all are
 * three different problems with three different fixes, and the install
 * reported all of them as "not on disk here".
 *
 * Both live here so they cannot drift: the swallowing version is defined in
 * terms of this one.
 */
export type PluginFlagsRead =
  | { kind: "ok"; flags: PluginFlags }
  /** ENOENT — the file genuinely is not there. */
  | { kind: "not-found" }
  /** Present and readable, but not a Bethesda plugin (or truncated). */
  | { kind: "not-a-plugin"; why: string }
  /** There, but we could not read it: locked, permissions, an I/O error. */
  | { kind: "unreadable"; why: string };

export async function readPluginFlagsDetailed(
  filePath: string,
): Promise<PluginFlagsRead> {
  let handle;
  try {
    handle = await fsp.open(filePath, "r");
    const buf = Buffer.alloc(HEADER_BYTES);
    const { bytesRead } = await handle.read(buf, 0, HEADER_BYTES, 0);
    if (bytesRead < HEADER_BYTES) {
      return {
        kind: "not-a-plugin",
        why: `only ${bytesRead} bytes — too short to hold a TES4 header`,
      };
    }
    // Anything else is not a Bethesda plugin — a stray .esp that is really a
    // text file, or a truncated download.
    if (buf.toString("latin1", 0, 4) !== "TES4") {
      return { kind: "not-a-plugin", why: "no TES4 header" };
    }
    const flags = buf.readUInt32LE(FLAGS_OFFSET);
    return {
      kind: "ok",
      flags: {
        isLight: (flags & FLAG_LIGHT) !== 0,
        isMaster: (flags & FLAG_MASTER) !== 0,
      },
    };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { kind: "not-found" };
    // EBUSY/EPERM/EACCES are the interesting ones: the file IS there, and
    // telling the user it is missing sends them looking in the wrong place.
    return {
      kind: "unreadable",
      why: `${code ?? "read failed"}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/**
 * The flags, or `undefined` for any reason at all.
 *
 * Deliberately lossy: every caller that WRITES a flag must treat doubt as
 * "leave it alone", and a single `undefined` makes that impossible to get
 * wrong. Callers that must EXPLAIN a failure use
 * {@link readPluginFlagsDetailed}.
 */
export async function readPluginFlags(
  filePath: string,
): Promise<PluginFlags | undefined> {
  const read = await readPluginFlagsDetailed(filePath);
  return read.kind === "ok" ? read.flags : undefined;
}

/**
 * Set or clear the light flag in place.
 *
 * Reads the current flags and rewrites only that bit, so nothing else in the
 * header is disturbed — the same four-byte read-modify-write Vortex performs.
 * Returns whether the file was actually changed: a no-op write would make the
 * caller report corrections it did not make, and would needlessly alter the
 * file's mtime, which the hash cache keys on.
 *
 * Throws on IO failure. Unlike reading, a failed write must be visible: it
 * means the user's game is one plugin closer to not loading.
 */
export async function setPluginLightFlag(
  filePath: string,
  enabled: boolean,
): Promise<boolean> {
  const handle = await fsp.open(filePath, "r+");
  try {
    const buf = Buffer.alloc(4);
    const { bytesRead } = await handle.read(buf, 0, 4, FLAGS_OFFSET);
    if (bytesRead < 4) {
      throw new Error(`"${filePath}" is too short to carry a TES4 header`);
    }
    const before = buf.readUInt32LE(0);
    const after = enabled ? before | FLAG_LIGHT : before & ~FLAG_LIGHT;
    if (after === before) return false;
    buf.writeUInt32LE(after >>> 0, 0);
    await handle.write(buf, 0, 4, FLAGS_OFFSET);
    return true;
  } finally {
    await handle.close().catch(() => undefined);
  }
}

/**
 * How many regular (non-light) plugins a game can address.
 *
 * Light plugins share the `FE` index and do not count. Used to say something
 * concrete — "you are 3 over the limit" — instead of "some flags are missing".
 */
export const REGULAR_PLUGIN_LIMIT = 254;
