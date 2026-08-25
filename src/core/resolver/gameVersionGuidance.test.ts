/**
 * "Game version mismatch: required 1.10.163, installed 1.10.984" is true and
 * useless. The user has to work out on their own that Bethesda's update broke
 * the script extender, that the fix is to move the game BACKWARDS, and that
 * doing so is normal rather than a sign something is wrong.
 */
import { describe, expect, it } from "vitest";

import { compareVersions, gameVersionGuidance } from "./gameVersionGuidance";

describe("gameVersionGuidance", () => {
  it("names the next-gen problem and points at a downgrader", () => {
    const lines = gameVersionGuidance({
      gameId: "fallout4",
      required: "1.10.163",
      installed: "1.10.984",
    }).join(" ");
    expect(lines).toMatch(/next-gen/i);
    expect(lines).toMatch(/downgrade tool/i);
    expect(lines).toMatch(/Simple Fallout 4 Downgrader/);
    expect(lines).toMatch(/nexusmods\.com\/fallout4\/search/);
    // Reassurance is part of the job: this is the wall new modders hit.
    expect(lines).toMatch(/routine for modding/i);
  });

  it("sends the user FORWARD when their game is older", () => {
    const lines = gameVersionGuidance({
      gameId: "fallout4",
      required: "1.10.984",
      installed: "1.10.163",
    }).join(" ");
    expect(lines).toMatch(/older than this collection expects/i);
    expect(lines).toMatch(/Update the game/i);
    // Telling someone to downgrade when they must update wastes an afternoon.
    expect(lines).not.toMatch(/downgrade tool/i);
  });

  it("explains the AE split for Skyrim", () => {
    const lines = gameVersionGuidance({
      gameId: "skyrimse",
      required: "1.5.97",
      installed: "1.6.1170",
    }).join(" ");
    expect(lines).toMatch(/Anniversary Edition/);
    expect(lines).toMatch(/version-locked/);
    expect(lines).toMatch(/Skyrim Downgrade Patcher|Best of Both Worlds/);
  });

  it("says nothing rather than padding an error for an unknown game", () => {
    expect(
      gameVersionGuidance({ gameId: "morrowind", required: "1", installed: "2" }),
    ).toEqual([]);
  });

  it("still offers the downgrade route when a version cannot be compared", () => {
    // "cannot tell" must not silently become "you need to update".
    const lines = gameVersionGuidance({
      gameId: "fallout4",
      required: "1.10.163",
      installed: "unknown",
    }).join(" ");
    expect(lines).toMatch(/downgrade tool/i);
  });
});

describe("compareVersions", () => {
  it("orders dotted numeric versions", () => {
    expect(compareVersions("1.10.984", "1.10.163")).toBe(1);
    expect(compareVersions("1.10.163", "1.10.984")).toBe(-1);
    expect(compareVersions("1.10.163", "1.10.163")).toBe(0);
  });

  it("treats missing trailing components as zero", () => {
    expect(compareVersions("1.6", "1.6.0")).toBe(0);
    expect(compareVersions("1.6.1", "1.6")).toBe(1);
  });

  it("returns undefined rather than guessing at unparseable input", () => {
    expect(compareVersions("unknown", "1.0.0")).toBeUndefined();
    expect(compareVersions("1.0.0", "")).toBeUndefined();
  });
});
