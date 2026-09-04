/**
 * One resolver for "where does this mod live".
 *
 * Six places built `path.join(installRoot, mod.installationPath)` by hand.
 * Three guarded the folder name's LENGTH and three checked only its type — and
 * `path.join(root, "")` returns root, so on the permissive half a mod with a
 * blank folder name addressed the entire staging tree. Nothing threw: the
 * verifier would read every mod in the collection, find each expected file
 * present, and report a mountain of extras.
 *
 * That is what an absent shared helper costs. Not a wrong answer everywhere —
 * a different answer in half the places, decided by whoever wrote each one.
 *
 * ─── TWO INPUTS ARE KEPT, ON PURPOSE ───────────────────────────────────
 * The build side holds an AuditorMod whose installationPath was read moments
 * earlier; the install and doctor sides hold a Vortex mod id for a mod created
 * on THIS machine, where there is no curator-side object to trust. Collapsing
 * those into one signature would have been its own bug, so the module exposes
 * both and shares only the part they must agree on.
 */
import { describe, expect, it } from "vitest";

import {
  installRootFor,
  installationPathFromState,
  stagingRootForModId,
  stagingRootFromFolder,
} from "./stagingPath";
import { __testPaths } from "../../test/stubs/vortex-api";

const stateWith = (mods: Record<string, unknown>): never =>
  ({ persistent: { mods: { skyrimse: mods } } }) as never;

describe("joining a root to a folder", () => {
  it("refuses a blank folder name", () => {
    // The whole reason this module exists.
    expect(stagingRootFromFolder("/staging", "")).toBeUndefined();
  });

  it("refuses a missing or non-string folder name", () => {
    expect(stagingRootFromFolder("/staging", undefined)).toBeUndefined();
    expect(stagingRootFromFolder("/staging", 42)).toBeUndefined();
    expect(stagingRootFromFolder("/staging", null)).toBeUndefined();
  });

  it("refuses when there is no root", () => {
    expect(stagingRootFromFolder(undefined, "MyMod")).toBeUndefined();
  });

  it("joins when both are real", () => {
    expect(stagingRootFromFolder("/staging", "MyMod-123")).toContain("MyMod-123");
  });
});

describe("reading the folder from live state", () => {
  it("finds it for a known mod", () => {
    expect(
      installationPathFromState(
        stateWith({ "mod-1": { installationPath: "MyMod-123" } }),
        "skyrimse",
        "mod-1",
      ),
    ).toBe("MyMod-123");
  });

  it("treats blank as absent rather than as a folder", () => {
    expect(
      installationPathFromState(
        stateWith({ "mod-1": { installationPath: "" } }),
        "skyrimse",
        "mod-1",
      ),
    ).toBeUndefined();
  });

  it("is undefined for a mod Vortex does not have", () => {
    expect(
      installationPathFromState(stateWith({}), "skyrimse", "ghost"),
    ).toBeUndefined();
  });

  it("does not throw on a state shape it cannot read", () => {
    // Unreadable state means "no opinion". Throwing here would take down an
    // install over a lookup.
    expect(
      installationPathFromState({} as never, "skyrimse", "mod-1"),
    ).toBeUndefined();
    expect(
      installationPathFromState(undefined as never, "skyrimse", "mod-1"),
    ).toBeUndefined();
  });
});

describe("the id-based resolver used by install and doctor", () => {
  it("resolves a real mod", () => {
    __testPaths.installPath = "/staging";
    expect(
      stagingRootForModId(
        stateWith({ "mod-1": { installationPath: "MyMod-123" } }),
        "skyrimse",
        "mod-1",
      ),
    ).toContain("MyMod-123");
  });

  it("returns undefined for a blank folder, never the root itself", () => {
    __testPaths.installPath = "/staging";
    const got = stagingRootForModId(
      stateWith({ "mod-1": { installationPath: "" } }),
      "skyrimse",
      "mod-1",
    );
    expect(got).toBeUndefined();
    // Belt and braces: the failure mode was returning the root, so assert it
    // by value and not only by undefined-ness.
    expect(got).not.toBe("/staging");
  });

  it("returns undefined when the game has no install path", () => {
    __testPaths.installPath = "";
    expect(
      stagingRootForModId(
        stateWith({ "mod-1": { installationPath: "MyMod" } }),
        "skyrimse",
        "mod-1",
      ),
    ).toBeUndefined();
    __testPaths.installPath = "/staging";
  });
});

describe("nobody builds a staging path by hand any more", () => {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  const ROOT = join(__dirname, "..");

  const SITES = [
    "core/installer/verifyModInstall.ts",
    "core/installer/runInstall.ts",
    "core/manifest/bundleFromStaging.ts",
    "core/manifest/captureStagingFiles.ts",
    "core/resolver/enrichStagingSetHashes.ts",
    "ui/pages/doctor/DoctorPage.tsx",
  ];

  it("finds every site it claims to check", () => {
    for (const rel of SITES) {
      expect(readFileSync(join(ROOT, rel), "utf8").length).toBeGreaterThan(0);
    }
  });

  it("has no hand-rolled join left", () => {
    const offenders = SITES.filter((rel) =>
      readFileSync(join(ROOT, rel), "utf8").includes("path.join(installRoot"),
    );
    expect(offenders).toEqual([]);
  });

  it("has no site resolving the install root for itself", () => {
    // Seven call sites each decided what a falsy return meant.
    const offenders = SITES.filter((rel) =>
      /selectors\.installPathForGame/.test(readFileSync(join(ROOT, rel), "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
