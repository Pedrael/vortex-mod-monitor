/**
 * ──────────────────────────────────────────────────────────────────────
 * Reusing a packed archive, and the two ways that could go wrong.
 *
 * Wrong in the expensive direction: reuse an archive whose content moved, and
 * the collection ships last week's DynDOLOD output while claiming to ship
 * this week's. Nothing fails; the world is just subtly not the one that was
 * built.
 *
 * Wrong in the cheap direction: fail to reuse, and the curator waits. That is
 * the direction every uncertainty here resolves towards.
 * ──────────────────────────────────────────────────────────────────────
 */
import { describe, expect, it } from "vitest";

import {
  bundleFileName,
  bundleSidecarPath,
  isBundleOfMod,
  sanitizeModId,
  sidecarMatches,
  staleBundlesFor,
} from "./bundleCache";

const KEY_A = "a".repeat(64);
const KEY_B = "b".repeat(64);

describe("naming an archive after what is inside it", () => {
  it("carries both the mod and the content", () => {
    expect(bundleFileName("mod-1", KEY_A)).toBe(`mod-1-${KEY_A}.zip`);
  });

  it("gives different content a different name", () => {
    // The whole mechanism. The old name was `<modId>.zip`, which says which
    // mod and nothing about which version of it — so it could never be
    // trusted for reuse, and was deleted and rewritten every build.
    expect(bundleFileName("m", KEY_A)).not.toBe(bundleFileName("m", KEY_B));
  });

  it("keeps a mod id usable as a filename", () => {
    expect(sanitizeModId("Ünsafe/name:v2")).toBe("_nsafe_name_v2");
  });

  it("puts the sidecar beside the archive", () => {
    expect(bundleSidecarPath("C:/x/m-abc.zip")).toBe("C:/x/m-abc.zip.json");
  });
});

describe("which files belong to which mod", () => {
  it("claims its own archive and sidecar", () => {
    expect(isBundleOfMod(`m-${KEY_A}.zip`, "m")).toBe(true);
    expect(isBundleOfMod(`m-${KEY_A}.zip.json`, "m")).toBe(true);
  });

  it("does NOT let one mod claim another whose id starts the same", () => {
    // Sweeping is a delete. "m" matching "m2"'s files would throw away a
    // cache entry that belongs to a different mod entirely.
    expect(isBundleOfMod(`m2-${KEY_A}.zip`, "m")).toBe(false);
  });

  it("ignores anything that is not one of ours", () => {
    expect(isBundleOfMod("m-notahash.zip", "m")).toBe(false);
    expect(isBundleOfMod("m.zip", "m")).toBe(false);
    expect(isBundleOfMod("something-else.txt", "m")).toBe(false);
  });
});

describe("sweeping older versions", () => {
  it("keeps the one in use and drops the rest, sidecars included", () => {
    expect(
      staleBundlesFor({
        fileNames: [
          `m-${KEY_A}.zip`,
          `m-${KEY_A}.zip.json`,
          `m-${KEY_B}.zip`,
          `m-${KEY_B}.zip.json`,
        ],
        modId: "m",
        keep: `C:/cache/m-${KEY_A}.zip`,
      }),
    ).toEqual([`m-${KEY_B}.zip`, `m-${KEY_B}.zip.json`]);
  });

  it("never touches another mod's cache", () => {
    // The folder is shared by every collection. A build of one must not
    // throw away what another one would have reused.
    expect(
      staleBundlesFor({
        fileNames: [`other-${KEY_B}.zip`, `m-${KEY_B}.zip`],
        modId: "m",
        keep: `C:/cache/m-${KEY_A}.zip`,
      }),
    ).toEqual([`m-${KEY_B}.zip`]);
  });

  it("drops nothing when the only copy is the one in use", () => {
    expect(
      staleBundlesFor({
        fileNames: [`m-${KEY_A}.zip`, `m-${KEY_A}.zip.json`],
        modId: "m",
        keep: `C:/cache/m-${KEY_A}.zip`,
      }),
    ).toEqual([]);
  });
});

describe("trusting a sidecar", () => {
  it("accepts one whose size still matches the file", () => {
    expect(sidecarMatches({ sha256: KEY_A, bytes: 100 }, 100)).toBe(true);
  });

  it("rejects one whose archive is a different length", () => {
    // What a crash mid-write leaves behind: a real file, a real sidecar, and
    // a hash describing bytes that were never finished.
    expect(sidecarMatches({ sha256: KEY_A, bytes: 100 }, 42)).toBe(false);
  });

  it("rejects a sidecar with no usable hash in it", () => {
    expect(sidecarMatches({ sha256: "nope", bytes: 1 }, 1)).toBe(false);
    expect(
      sidecarMatches({ bytes: 1 } as unknown as { sha256: string; bytes: number }, 1),
    ).toBe(false);
  });

  it("rejects nothing at all", () => {
    expect(sidecarMatches(undefined, 100)).toBe(false);
  });
});
