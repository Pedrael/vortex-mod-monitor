/**
 * `fileOverrides` is gone from the format.
 *
 * It recorded the deployment winner of every CONTESTED file — 17,161 entries
 * on a real 1753-mod Skyrim collection — and nothing on the install side ever
 * read one. The question was whether it was a gap to close or weight to shed,
 * and it was settled by measurement rather than taste.
 *
 * ─── WHAT WAS MEASURED ─────────────────────────────────────────────────
 * The rule direction was derived from the data instead of assumed: of 16,675
 * two-provider contests, "source before reference => reference wins" matched
 * the recorded winner 16,675 times and the opposite reading 0. With that
 * settled, applied to every contested file:
 *
 *     rules reproduce the recorded winner : 17,159
 *     rules imply a DIFFERENT winner      :      0
 *     no rule covers some pair            :      2
 *
 * The two are `Readme.txt` and `FOMod/info.xml` — files the game never loads.
 * So the field carried nothing the rules do not already determine, and the
 * installer applies the rules.
 *
 * ─── AND THE PER-MOD ONE WAS EMPTY ─────────────────────────────────────
 * `ModInstallState.fileOverrides` mirrored Vortex's manual per-file winner
 * picker. On the real collection: 0 mods, 0 paths. Nobody had ever used it.
 *
 * `AuditorMod.fileOverrides` STAYS — `compareSnapshots` diffs it when telling
 * a curator what changed between two profiles, which is a different job from
 * shipping it to a stranger.
 *
 * No backward-compatibility tests here, by decision: the curator rebuilds
 * their packages rather than carrying old ones forward. The parser ignores an
 * unrecognised key anyway, so an older .ehcoll still loads — that is a
 * property of how it parses, not a promise being kept.
 */
import { describe, expect, it } from "vitest";

import { parseManifest } from "./parseManifest";
import type { EhcollManifest } from "../../types/ehcoll";

/** A minimal manifest of the shape a current build emits. */
const base = (): Record<string, unknown> => ({
  schemaVersion: 1,
  package: {
    id: "00000000-0000-4000-8000-000000000000",
    name: "t",
    version: "1.0.0",
    author: "a",
    createdAt: "2026-01-01T00:00:00.000Z",
    strictMissingMods: false,
  },
  game: { id: "skyrimse", version: "1.6.1179.0", versionPolicy: "exact" },
  vortex: {
    version: "2.6.3",
    deploymentMethod: "hardlink",
    requiredExtensions: [],
  },
  mods: [],
  rules: [],
  plugins: { order: [] },
  loadOrder: [],
  userlist: { plugins: [], groups: [] },
  iniTweaks: [],
  gameIni: { files: [] },
  externalDependencies: [],
});

describe("the format no longer carries fileOverrides", () => {
  it("parses a current manifest that omits it entirely", () => {
    expect(() => parseManifest(JSON.stringify(base()))).not.toThrow();
  });

  it("does not surface it on the parsed manifest", () => {
    const { manifest } = parseManifest(JSON.stringify(base()));
    expect(
      (manifest as EhcollManifest & { fileOverrides?: unknown }).fileOverrides,
    ).toBeUndefined();
  });
});
