/**
 * Curator's profile → manifest → plan → the real install driver.
 *
 * The install side was reachable only by installing a collection by hand in
 * Vortex, which is why the FOMOD gap survived: nothing exercised the call the
 * driver makes, so "the choices are recorded" and "the choices are used" were
 * indistinguishable from outside.
 *
 * This drives `runInstall` itself against a Vortex double whose whole surface
 * is what the installer actually touches. It asserts the CALLS, because that
 * is the level where every bug this cycle lived.
 */

import * as fs from "fs";
import * as path from "path";

import { afterEach, describe, expect, it } from "vitest";

import { runInstall } from "../../src/core/installer/runInstall";
import { resolveInstallPlan } from "../../src/core/resolver/resolveInstallPlan";
import { parseManifest } from "../../src/core/manifest/parseManifest";
import { buildManifest } from "../../src/core/manifest/buildManifest";
import { captureStagingFiles } from "../../src/core/manifest/captureStagingFiles";
import { scopeCollectionMods } from "../../src/core/manifest/collectionScope";
import { emitsOf, makeFakeVortex } from "./fakeVortex";
import { makeWorld, type World } from "./world";
import type { EhcollManifest } from "../../src/types/ehcoll";
import type { UserSideState } from "../../src/types/installPlan";

let world: World | undefined;
afterEach(() => {
  world?.cleanup();
  world = undefined;
});

const FOMOD_CHOICES = {
  type: "fomod",
  options: [
    {
      name: "Choose Options",
      groups: [{ name: "Patches", choices: [{ name: "AFT Plus Ivy Patch", idx: 2 }] }],
    },
  ],
};

async function packageFrom(w: World): Promise<EhcollManifest> {
  const scope = scopeCollectionMods(w.mods);
  const enriched = await captureStagingFiles(w.state as never, w.gameId, scope.included, {
    level: "thorough",
  });
  const { manifest } = buildManifest({
    snapshot: { gameId: w.gameId, mods: enriched } as never,
    package: {
      id: "00000000-0000-4000-8000-000000000000",
      name: "Driver E2E",
      version: "1.0.0",
      author: "curator",
      verificationLevel: "thorough",
    },
    game: { version: "1.10.163.0", versionPolicy: "exact" },
    vortex: { version: "2.6.0", deploymentMethod: "hardlink" },
  } as never);
  return parseManifest(JSON.stringify(manifest)).manifest;
}

const userState = (): UserSideState =>
  ({
    gameId: "fallout4",
    gameVersion: "1.10.163.0",
    vortexVersion: "2.6.0",
    deploymentMethod: "hardlink",
    enabledExtensions: [],
    installedMods: [],
    availableDownloads: [],
    // REQUIRED on UserSideState, and previously absent — the cast hid it, and
    // tests were never typechecked so nothing objected. An end-to-end fixture
    // missing required fields is not the state the driver actually receives.
    activeProfileId: "profile-e2e",
    activeProfileName: "E2E Profile",
  }) as UserSideState;

/**
 * Drive the real driver, and if it stops making progress say WHERE.
 *
 * A driver that hangs produces a bare test timeout, which names the test and
 * not the phase. The phase list turns that into a diagnosis.
 */
async function install(
  manifest: EhcollManifest,
  fake: ReturnType<typeof makeFakeVortex>,
  previousInstall?: { packageVersion: string; gameIniApplication?: unknown },
  /**
   * What the user chose on the decisions screen. An external mod that is not
   * bundled resolves to `external-prompt-user`, and the driver REFUSES to run
   * without a matching choice — so reaching that path at all means supplying
   * one here.
   */
  decisions: unknown = {},
) {
  const phases: string[] = [];
  // A first install. `current-profile` is a different mode with its own
  // invariant (it requires a previous install from the ledger), so it belongs
  // in its own case rather than being faked here.
  const plan = resolveInstallPlan(manifest, userState(), {
    kind: "fresh-profile",
    profileName: "E2E Profile",
  } as never);
  if (previousInstall !== undefined) {
    (plan as { previousInstall?: unknown }).previousInstall = previousInstall;
  }
  const running = runInstall({
    api: fake.api,
    plan,
    ehcoll: { manifest, bundledArchives: [], warnings: [] } as never,
    // Per-world, not a shared absolute path: the old `C:/nowhere/appdata` was
    // real, written to the drive root, and shared by every e2e file — which
    // made parallel runs race on one receipt path. See World.appDataPath.
    ehcollZipPath: `${world!.root}/pkg.ehcoll`,
    appDataPath: world!.appDataPath,
    decisions,
  } as never);

  const stalled = new Promise<never>((_r, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            `driver stalled. phases=[${phases.join(" | ")}] ` +
              `emits=[${fake.emits.map((e) => e.event).join(" | ")}] ` +
              `dispatched=[${fake.dispatched.map((d) => (d as { type?: string })?.type).join(" | ")}]`,
          ),
        ),
      3000,
    ),
  );
  return Promise.race([running, stalled]);
}

describe("install driver, end to end", () => {
  it("replays the curator's FOMOD choices instead of letting Vortex ask", async () => {
    world = makeWorld({
      mods: [
        {
          id: "fomod-mod",
          name: "A FOMOD Mod",
          nexus: { modId: 111, fileId: 222 },
          archiveSha256: "a".repeat(64),
          files: { "Data/chosen.esp": "chosen" },
          installerChoices: FOMOD_CHOICES,
        },
      ],
    });
    const manifest = await packageFrom(world);
    const fake = makeFakeVortex({ gameId: "fallout4" });

    await install(manifest, fake);

    const call = emitsOf(fake, "start-install-download")[0];
    expect(call, "the driver never asked Vortex to install").toBeDefined();
    // The whole point: the options bag carries the curator's answers.
    expect(call!.args[1]).toEqual({
      allowAutoEnable: true,
      choices: FOMOD_CHOICES,
      // Bypasses the FOMOD dialog. Vortex's installer requires all three:
      // choices present, choices.type === "fomod", unattended === true.
      unattended: true,
    });
  });

  it("replays the curator's choices for an archive the USER supplied by hand", async () => {
    // The gap this closes: an external mod is fetched by the user and pointed
    // at with "Pick a local file". That path emitted `start-install`, which
    // has no argument for installer answers — so a FOMOD supplied by hand
    // installed with DEFAULT options while the collection promised the
    // curator's. Every file present, every file correct, and the wrong ones.
    //
    // The fix registers the picked archive as a Vortex download and installs
    // it through `start-install-download`, the ONLY choices-carrying install
    // call whose shape has actually been observed on a real Vortex. This
    // asserts that call, because "it adopts the archive" and "the choices
    // reach the installer" are otherwise indistinguishable from outside.
    world = makeWorld({
      mods: [
        {
          id: "hand-supplied",
          name: "A Hand-Supplied FOMOD",
          // No `nexus` ⇒ external.
          archiveSha256: "c".repeat(64),
          files: { "Data/handpicked.esp": "handpicked" },
          installerChoices: FOMOD_CHOICES,
        },
      ],
    });
    const manifest = await packageFrom(world);
    const fake = makeFakeVortex({ gameId: "fallout4" });

    const entry = manifest.mods[0]!;
    // The archive the user "downloaded" and picked, somewhere outside Vortex.
    const picked = path.join(world.root, "user-downloads", "HandSupplied.7z");
    fs.mkdirSync(path.dirname(picked), { recursive: true });
    fs.writeFileSync(picked, Buffer.alloc(64, 7));

    await install(manifest, fake, undefined, {
      conflictChoices: {
        [entry.compareKey]: { kind: "use-local-file", localPath: picked },
      },
    });

    const call = emitsOf(fake, "start-install-download")[0];
    expect(
      call,
      "a hand-picked archive never reached the choices-carrying install call",
    ).toBeDefined();
    expect(call!.args[1]).toEqual({
      allowAutoEnable: true,
      choices: FOMOD_CHOICES,
      // Bypasses the FOMOD dialog. Vortex's installer requires all three:
      // choices present, choices.type === "fomod", unattended === true.
      unattended: true,
    });
    // And NOT through the call that cannot carry them.
    expect(emitsOf(fake, "start-install")).toEqual([]);
  });

  it("leaves a mod with no recorded choices on the original one-step path", async () => {
    // Replay must not change how the other 840 mods in a collection install.
    // A mod without choices is downloaded AND installed by Vortex in one go,
    // so the driver never emits start-install-download at all.
    world = makeWorld({
      mods: [
        {
          id: "plain",
          nexus: { modId: 333, fileId: 444 },
          archiveSha256: "b".repeat(64),
          files: { "Data/plain.esp": "plain" },
        },
      ],
    });
    // The install must actually put the mod's files on disk, or verification
    // fails and the driver correctly spends a reinstall — which would make the
    // count below 2 for a reason that has nothing to do with the one-step path
    // this test is about.
    const fake = makeFakeVortex({
      gameId: "fallout4",
      stagingRoot: world.stagingRoot,
      installProduces: () => ({ "Data/plain.esp": "plain" }),
    });

    await install(await packageFrom(world), fake);

    expect(emitsOf(fake, "start-install-download")).toEqual([]);
    expect(fake.installed).toHaveLength(1);
  });

  it("reports a refused install rather than hanging on it", async () => {
    world = makeWorld({
      mods: [
        {
          id: "fomod-mod",
          nexus: { modId: 111, fileId: 222 },
          archiveSha256: "a".repeat(64),
          files: { "Data/chosen.esp": "chosen" },
          installerChoices: FOMOD_CHOICES,
        },
      ],
    });
    const manifest = await packageFrom(world);
    const fake = makeFakeVortex({ gameId: "fallout4" });
    fake.failNextInstall("installer said no");

    const result = await install(manifest, fake);
    // However the driver classifies it, the refusal must reach the result and
    // the run must end. Silence here is a 90-second stall in the real app.
    expect(JSON.stringify(result)).toMatch(/installer said no/);
  });

  it("writes the collection's game settings and TELLS the user", async () => {
    // The user must hear that their configuration changed. Applying it
    // silently is not acceptable even when it is correct.
    const fs = await import("fs");
    const os = await import("os");
    const path = await import("path");
    const docs = fs.mkdtempSync(path.join(os.tmpdir(), "eh-drv-ini-"));
    const iniDir = path.join(docs, "My Games", "Fallout4");
    fs.mkdirSync(iniDir, { recursive: true });
    fs.writeFileSync(
      path.join(iniDir, "Fallout4.ini"),
      ["[General]", "uGridsToLoad=5", ""].join("\n"),
    );
    const { __testPaths } = await import("../stubs/vortex-api");
    const previousDocs = __testPaths.documentsPath;
    __testPaths.documentsPath = docs;

    world = makeWorld({
      mods: [
        { id: "m", nexus: { modId: 1, fileId: 1 }, archiveSha256: "a".repeat(64), files: { "a.esp": "a" } },
      ],
    });
    const manifest = await packageFrom(world);
    const withIni: EhcollManifest = {
      ...manifest,
      gameIni: {
        files: [
          {
            fileName: "Fallout4.ini",
            settings: [{ section: "General", key: "uGridsToLoad", value: "7" }],
          },
        ],
      },
    };

    const result = await install(withIni, makeFakeVortex({ gameId: "fallout4" }));

    expect(fs.readFileSync(path.join(iniDir, "Fallout4.ini"), "utf8")).toContain("uGridsToLoad=7");
    const notice = ((result as { gameIniNotice?: string[] }).gameIniNotice ?? []).join(" ");
    expect(notice).toMatch(/set 1 game setting/);
    expect(notice).toMatch(/uGridsToLoad: 5 → 7/);
    expect(notice).toMatch(/never re-applied/);

    __testPaths.documentsPath = previousDocs;
    fs.rmSync(docs, { recursive: true, force: true });
  });

  it("does NOT touch settings again for a version already applied", async () => {
    // The user is free to change anything afterwards; a second apply would
    // silently revert it.
    const fs = await import("fs");
    const os = await import("os");
    const path = await import("path");
    const docs = fs.mkdtempSync(path.join(os.tmpdir(), "eh-drv-ini2-"));
    const iniDir = path.join(docs, "My Games", "Fallout4");
    fs.mkdirSync(iniDir, { recursive: true });
    // The user set it back to 5 after the first install.
    fs.writeFileSync(
      path.join(iniDir, "Fallout4.ini"),
      ["[General]", "uGridsToLoad=5", ""].join("\n"),
    );
    const { __testPaths } = await import("../stubs/vortex-api");
    const previousDocs = __testPaths.documentsPath;
    __testPaths.documentsPath = docs;

    world = makeWorld({
      mods: [
        { id: "m", nexus: { modId: 1, fileId: 1 }, archiveSha256: "a".repeat(64), files: { "a.esp": "a" } },
      ],
    });
    const manifest = await packageFrom(world);
    const withIni: EhcollManifest = {
      ...manifest,
      gameIni: {
        files: [
          {
            fileName: "Fallout4.ini",
            settings: [{ section: "General", key: "uGridsToLoad", value: "7" }],
          },
        ],
      },
    };

    const result = await install(withIni, makeFakeVortex({ gameId: "fallout4" }), {
      packageVersion: withIni.package.version,
      gameIniApplication: { appliedCount: 1 },
    });

    expect(fs.readFileSync(path.join(iniDir, "Fallout4.ini"), "utf8")).toContain("uGridsToLoad=5");
    expect((result as { gameIniNotice?: string[] }).gameIniNotice).toBeUndefined();

    __testPaths.documentsPath = previousDocs;
    fs.rmSync(docs, { recursive: true, force: true });
  });
});
