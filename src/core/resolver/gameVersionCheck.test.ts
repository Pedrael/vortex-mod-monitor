/**
 * A collection built on a machine where Vortex could not report the game
 * version shipped `game.version: "unknown"` with policy `"exact"`. Read
 * literally that says "your game must be version 'unknown'" — which no real
 * install satisfies, so the collection is blocked for every user on earth
 * because of a detection gap on one curator's machine.
 */
import { describe, expect, it } from "vitest";

import { resolveCompatibility } from "./resolveInstallPlan";
import type { EhcollManifest } from "../../types/ehcoll";
import type { UserSideState } from "../../types/installPlan";

const manifest = (version: string, policy: "exact" | "minimum" = "exact") =>
  ({
    game: { id: "fallout4", version, versionPolicy: policy },
    vortex: { version: "2.6.0", deploymentMethod: "hardlink", requiredExtensions: [] },
    mods: [],
  }) as unknown as EhcollManifest;

const user = (gameVersion: string | undefined) =>
  ({
    gameId: "fallout4",
    gameVersion,
    enabledExtensions: [],
    vortexVersion: "2.6.0",
    deploymentMethod: "hardlink",
  }) as unknown as UserSideState;

describe("game version compatibility", () => {
  it("does NOT block an install over a requirement the curator never determined", () => {
    const report = resolveCompatibility(manifest("unknown"), user("1.10.163.0"));
    expect(report.errors).toEqual([]);
    expect(report.gameVersion.status).toBe("unknown");
    expect(report.warnings.join(" ")).toMatch(/does not record which game version/);
  });

  it("treats an empty requirement the same way", () => {
    const report = resolveCompatibility(manifest(""), user("1.10.163.0"));
    expect(report.errors).toEqual([]);
  });

  it("still blocks a REAL exact mismatch — the guard must not swallow the check", () => {
    const report = resolveCompatibility(manifest("1.10.163.0"), user("1.10.984.0"));
    expect(report.errors.join(" ")).toMatch(/Game version mismatch/);
    expect(report.gameVersion.status).toBe("mismatch");
  });

  it("still passes a real match", () => {
    const report = resolveCompatibility(manifest("1.10.163.0"), user("1.10.163.0"));
    expect(report.errors).toEqual([]);
    expect(report.gameVersion.status).toBe("ok");
  });
});
