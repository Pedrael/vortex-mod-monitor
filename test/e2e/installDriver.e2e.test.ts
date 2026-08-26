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
  }) as UserSideState;

/**
 * Drive the real driver, and if it stops making progress say WHERE.
 *
 * A driver that hangs produces a bare test timeout, which names the test and
 * not the phase. The phase list turns that into a diagnosis.
 */
async function install(manifest: EhcollManifest, fake: ReturnType<typeof makeFakeVortex>) {
  const phases: string[] = [];
  // A first install. `current-profile` is a different mode with its own
  // invariant (it requires a previous install from the ledger), so it belongs
  // in its own case rather than being faked here.
  const plan = resolveInstallPlan(manifest, userState(), {
    kind: "fresh-profile",
    profileName: "E2E Profile",
  } as never);
  const running = runInstall({
    api: fake.api,
    plan,
    ehcoll: { manifest, bundledArchives: [], warnings: [] } as never,
    ehcollZipPath: "C:/nowhere/pkg.ehcoll",
    appDataPath: "C:/nowhere/appdata",
    decisions: {},
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
    });
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
    const fake = makeFakeVortex({ gameId: "fallout4" });

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
});
