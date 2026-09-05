/**
 * Render the real UI to static HTML so it can be LOOKED AT.
 *
 * Not a test — a rendering harness that happens to live under vitest, because
 * vitest is the only place `@nexusmods/vortex-api` resolves (to the stub) and
 * therefore the only place these components can be imported at all outside a
 * running Vortex.
 *
 * Skipped unless EH_RENDER is set, so a normal `vitest run` neither writes
 * files nor pays for it:
 *
 *   EH_RENDER=1 npx vitest run src/ui/__render__/renderScreens.test.ts
 *
 * Then screenshot the output with headless Edge and read the images. The data
 * below is modelled on the real 963-mod Fallout 4 collection rather than
 * invented, because a screen that looks calm with three mods is exactly how
 * this UI's problems stayed invisible.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { describe, it } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// From the modules, not the barrel: `src/ui/theme/index.ts` re-exports only
// EventHorizonStyles, so importing these from there yields undefined and the
// harness renders a page with no CSS at all — which is what the first run of
// this produced, and it looked like a UI problem rather than a harness one.
import { BASE_CSS } from "../theme/base";
import { COMPONENTS_CSS } from "../theme/components";
import { KEYFRAMES_CSS } from "../theme/keyframes";
import { LOGO_CSS } from "../theme/logo";
import { TOKENS_CSS } from "../theme/tokens";
import { UTILITIES_CSS } from "../theme/utilities";
import {
  ConfirmStep,
  DecisionsStep,
  DoneStep,
  InstallingStep,
  PreviewStep,
} from "../pages/install/steps";
import { ApiProvider } from "../state/ApiContext";
import { ToastProvider } from "../components/Toast";
import { AvailabilityPanel, DonePanel } from "../pages/build/BuildPage";
import { summarizeAvailability } from "../../core/build/nexusAvailability";
import { DraftCard, PublishedCard } from "../pages/build/BuildDashboard";
import { DashboardBody, Hero } from "../pages/HomePage";
import {
  FailedAttempts,
  InterruptedInstalls,
} from "../pages/CollectionsPage";
import { DoctorPanel } from "../pages/doctor/DoctorPanel";
import { evaluateHealth, healingBlockedReason } from "../../core/doctor/health";

/**
 * Where the rendered screens land.
 *
 * This was an absolute path hardcoded to one machine, one user and one agent
 * session id — so it wrote nowhere useful for anybody else, and it carried the
 * project's old name long after the rename. Set `EH_RENDER_OUT` to steer it;
 * otherwise it goes to a per-run temp directory, which is right for a harness
 * whose output you look at once.
 */
const OUT =
  process.env.EH_RENDER_OUT ??
  path.join(os.tmpdir(), "event-horizon-render", "ui");

const CSS = [
  TOKENS_CSS,
  BASE_CSS,
  KEYFRAMES_CSS,
  UTILITIES_CSS,
  COMPONENTS_CSS,
  LOGO_CSS,
].join("\n");

/**
 * The real tree nests every page inside `.eh-app > .eh-app__inner >
 * .eh-app__main` (EventHorizonMainPage), and that wrapper carries the base
 * typography, background and content width. Rendering a step without it
 * produces unstyled dark-on-dark text that says nothing about the real UI —
 * which is exactly what the first attempt at this harness captured.
 */
const page = (title: string, body: string): string => `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>${CSS}</style>
<style>
  html,body{margin:0;background:var(--eh-bg-void, #0b0e14);}
  /* Animations would capture mid-flight and make every screenshot differ. */
  *,*::before,*::after{animation:none !important;transition:none !important;}
  /* .eh-stagger > * starts at opacity:0 and is revealed BY its animation.
     Killing animations above left every staggered child invisible - which
     photographed as a large empty band where the quick-action cards are, and
     read as a missing UI section rather than a harness artefact. */
  .eh-stagger > *{opacity:1 !important;}

  /* The shell is position:absolute + inset:0 + overflow:hidden because Vortex
     renders it into a positioned pane, and eh-app__main scrolls inside it.
     A screenshot of that captures one viewport and CLIPS the rest - which is
     what the first attempts here produced: a Done screen that looked four
     cards long because everything past the fold was cut, not laid out.
     Unpinning it lets the page grow so a tall window photographs all of it.
     (No backticks in here: this whole block lives inside a template literal,
     and one backtick silently ends the string.) */
  .eh-app{position:static !important;inset:auto !important;height:auto !important;
          overflow:visible !important;}
  .eh-app__inner,.eh-app__main{height:auto !important;max-height:none !important;
          overflow:visible !important;}
  /* Modal sizes itself as calc(100% - 32px) of the backdrop, and the backdrop
     is absolute:inset-0 inside .eh-app. With height:auto above, that resolves
     against the PAGE CONTENT rather than the window, so a modal renders
     clipped here and fine in Vortex. Give it a realistic window height so the
     screenshot shows what the user sees, not what the harness did. */
  .eh-app{min-height:780px !important;}
</style>
</head><body>
<div class="eh-app"><div class="eh-app__inner"><main class="eh-app__main">
${body}
</main></div></div>
</body></html>`;

const write = (name: string, node: React.ReactElement): void => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, `${name}.html`),
    page(name, renderToStaticMarkup(node)),
    "utf8",
  );
};

// ── data modelled on the real collection ────────────────────────────────
const manifest = {
  package: { id: "pkg", name: "Ivy 2", version: "1.0.10" },
  game: { id: "fallout4", version: "1.10.163.0" },
  // 115 of them carry FOMOD answers, as the real collection does — the screen
  // has to warn that Vortex will stop and ask.
  // 112 replayable + 3 that recorded an installer but answered nothing —
  // the real 963-mod split. The 3 ask the user in BOTH modes, so the copy has
  // to account for them and the fixture has to contain them.
  mods: Array.from({ length: 963 }, (_, i) => ({
    name: `Mod ${i}`,
    install:
      i < 112
        ? { fomodSelections: [{ name: "step", groups: [{ name: "g", choices: [{ name: "c", idx: 1 }] }] }] }
        : i < 115
          ? { fomodSelections: [{ name: "step", groups: [{ name: "g", choices: [] }] }] }
          : {},
  })),
  plugins: { order: Array.from({ length: 817 }, (_, i) => ({ name: `p${i}.esp` })) },
  rules: Array.from({ length: 291 }, () => ({})),
};

/**
 * The full PreviewBundle shape, not a convenient subset.
 *
 * Built from the type rather than by adding fields until the render stopped
 * throwing: a partial mock renders a screen that is missing whatever the
 * missing field drives, and that absence looks like a UI finding rather than a
 * hole in the fixture.
 */
const bundle = {
  zipPath:
    "C:/Users/x/AppData/Roaming/Vortex/event-horizon/collections/ivy-2-1.0.10.ehcoll",
  appDataPath: "C:/Users/x/AppData/Roaming/Vortex",
  ehcoll: { manifest, bundledArchives: [], warnings: [], errors: [] },
  receipt: undefined,
  plan: {
    manifest,
    installTarget: { kind: "fresh-profile", suggestedProfileName: "Ivy 2 v1.0.10" },
    summary: {
      totalMods: 963,
      alreadyInstalled: 0,
      willInstallSilently: 931,
      needsUserConfirmation: 27,
      missing: 5,
      orphans: 0,
      canProceed: true,
      ruleCount: 291,
      // Zero for Fallout 4 by design — the case that reads as failure.
      loadOrderCount: 0,
      pluginOrderCount: 817,
      userlistPluginCount: 29,
      userlistGroupCount: 0,
    },
    modResolutions: [],
    orphanedMods: [],
    externalDependencies: [],
    rulePlan: [],
    pluginOrder: { entries: [], warnings: [] },
    compatibility: { errors: [], warnings: [], canProceed: true },
    previousInstall: undefined,
  },
} as never;

/** Full shapes — DoneStep reads these fields unguarded. */
const RULES = {
  appliedRuleCount: 291,
  appliedLoadOrderCount: 0,
  overwrittenUserRuleCount: 14,
  skippedRules: [],
  skippedLoadOrderEntries: [],
  baselinePluginOrder: [],
} as never;

const USERLIST = {
  appliedRuleCount: 29,
  appliedGroupAssignmentCount: 12,
  appliedNewGroupCount: 0,
  appliedGroupRuleCount: 0,
  overwrittenGroupAssignmentCount: 3,
  skippedUserlistEntries: [],
} as never;

/**
 * DashboardData with EVERY field the panels actually read, enumerated from the
 * component source rather than added until the render stopped throwing. A
 * partial fixture renders a screen missing whatever the absent field drives,
 * and that absence reads as a UI defect instead of a hole in the mock.
 */
const dashboardData = {
  status: {
    gameId: "fallout4",
    gameIsSupported: true,
    gameLabel: "Fallout 4",
    profileId: "S1xCt4Cbj1x",
    profileName: "Ivy 2 v1.0.10",
    vortexVersion: "2.6.0",
    appDataPath: "C:/Users/DuduPhudu/AppData/Roaming/Vortex",
  },
  receipts: [
    {
      packageId: "0f6b1a2c-1d3e-4f50-9a1b-2c3d4e5f6071",
      packageName: "Ivy 2",
      packageVersion: "1.0.10",
      gameId: "fallout4",
      installedAt: Date.parse("2026-08-29T21:14:00Z"),
      installTargetMode: "fresh-profile",
      mods: Array.from({ length: 963 }, () => ({})),
    },
    {
      packageId: "1a7c2b3d-2e4f-5061-ab2c-3d4e5f607182",
      packageName: "Ivy 2",
      packageVersion: "1.0.9",
      gameId: "fallout4",
      installedAt: Date.parse("2026-08-24T18:02:00Z"),
      installTargetMode: "current-profile",
      mods: Array.from({ length: 954 }, () => ({})),
    },
  ],
  receiptErrors: [],
  curatorConfigs: [
    {
      slug: "ivy-2",
      configPath: "C:/Users/DuduPhudu/AppData/Roaming/Vortex/event-horizon/collections/ivy-2.json",
      modifiedAt: Date.parse("2026-08-30T09:31:00Z"),
      config: { externalMods: { a: {}, b: {}, c: {} } },
    },
  ],
  builtPackages: [
    {
      packagePath: "C:/…/collections/ivy-2-1.0.10.ehcoll",
      fileName: "ivy-2-1.0.10.ehcoll",
      modifiedAt: Date.parse("2026-08-30T09:33:00Z"),
      sizeBytes: 157_984_816,
    },
    {
      packagePath: "C:/…/collections/ivy-2-1.0.9.ehcoll",
      fileName: "ivy-2-1.0.9.ehcoll",
      modifiedAt: Date.parse("2026-08-24T17:58:00Z"),
      sizeBytes: 151_220_004,
    },
  ],
} as never;

describe("render", () => {
  const on = process.env.EH_RENDER === "1";
  // A machine with a half-installed collection and NO receipt — the exact
  // state a tester was in, where this page said "no collections" while 963
  // mods sat staged on his disk.
  it.skipIf(!on)("collections-interrupted — the install that never finished", () => {
    write(
      "collections-interrupted",
      React.createElement(
        "div",
        { className: "eh-page" },
        React.createElement(FailedAttempts, {
          attempts: [
            {
              packageId: "pkg-1",
              packageName: "Ivy 2",
              packageVersion: "1.0.12",
              gameId: "fallout4",
              endedAt: new Date(Date.now() - 3600_000).toISOString(),
              outcome: "failed",
              phase: "installing-mods",
              installedCount: 963,
              totalMods: 967,
              error: "No deployment method active",
              profileId: "2be7648d",
            },
          ],
          onRetry: () => undefined,
        } as never),
        React.createElement(InterruptedInstalls, {
          markers: [
            {
              packageId: "pkg-1",
              packageName: "Ivy 2",
              startedAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
              profileId: "2be7648d",
              gameId: "fallout4",
              totalMods: 967,
            },
          ],
          onResume: () => undefined,
        } as never),
      ),
    );
  });

  it.skipIf(!on)("doctor — a collection with real problems", () => {
    // The interesting state, not the happy one: a screen of green cards tells
    // you nothing about whether the design works.
    const checks = evaluateHealth(
      {
        packageName: "Ivy 2",
        packageVersion: "1.0.10",
        vortexProfileId: "prof-1",
        mods: Array.from({ length: 963 }, (_, i) => ({
          vortexModId: `m${i}`,
          compareKey: `nexus:${i}:${i}`,
          name: `Mod ${i}`,
        })),
        rulesApplication: {
          appliedRuleCount: 291,
          baselinePluginOrder: ["a.esp", "b.esp", "c.esp", "d.esp"],
        },
        userlistApplication: { appliedRuleCount: 29 },
      },
      {
        existingProfileIds: ["prof-1"],
        activeProfileId: "other-profile",
        // three mods removed, two more disabled
        installedModIds: Array.from({ length: 960 }, (_, i) => `m${i}`),
        enabledModIds: Array.from({ length: 958 }, (_, i) => `m${i}`),
        driftedCompareKeys: ["nexus:5:5", "nexus:9:9"],
        currentPluginOrder: ["a.esp", "c.esp", "b.esp", "d.esp"],
        currentModRuleCount: 280,
        currentUserlistRuleCount: 29,
      },
    );
    write(
      "doctor",
      React.createElement(
        "div",
        { className: "eh-page" },
        React.createElement(DoctorPanel, {
          packageName: "Ivy 2",
          packageVersion: "1.0.10",
          checks,
          onRecheck: () => undefined,
          onRunDeepScan: () => undefined,
          onHeal: () => undefined,
        } as never),
      ),
    );
  });

  // The state where the .ehcoll is gone: diagnosis still works, and the three
  // cures that re-run manifest-reading steps say why they cannot. Worth a
  // screenshot because "disabled with a reason" is only better than "hidden"
  // if the reason is actually legible on the button.
  it.skipIf(!on)("doctor-no-package — cures needing the package, disabled with the reason", () => {
    const checks = evaluateHealth(
      {
        packageName: "Ivy 2",
        packageVersion: "1.0.10",
        vortexProfileId: "prof-1",
        mods: Array.from({ length: 963 }, (_, i) => ({
          vortexModId: `m${i}`,
          compareKey: `nexus:${i}:${i}`,
          name: `Mod ${i}`,
        })),
        rulesApplication: {
          appliedRuleCount: 291,
          baselinePluginOrder: ["a.esp", "b.esp", "c.esp", "d.esp"],
        },
        userlistApplication: { appliedRuleCount: 29 },
      },
      {
        existingProfileIds: ["prof-1"],
        activeProfileId: "other-profile",
        installedModIds: Array.from({ length: 960 }, (_, i) => `m${i}`),
        enabledModIds: Array.from({ length: 958 }, (_, i) => `m${i}`),
        driftedCompareKeys: ["nexus:5:5", "nexus:9:9"],
        currentPluginOrder: ["a.esp", "c.esp", "b.esp", "d.esp"],
        currentModRuleCount: 280,
        currentUserlistRuleCount: 29,
      },
    );
    write(
      "doctor-no-package",
      React.createElement(
        "div",
        { className: "eh-page" },
        React.createElement(DoctorPanel, {
          packageName: "Ivy 2",
          packageVersion: "1.0.10",
          checks,
          onRecheck: () => undefined,
          onHeal: () => undefined,
          unavailableHeal: (action: string) =>
            action === "reapply-rules" ||
            action === "reapply-userlist" ||
            action === "reinstall-mods"
              ? "Needs the .ehcoll"
              : undefined,
        } as never),
      ),
    );
  });

  it.skipIf(!on)("doctor — healing blocked because an install is running", () => {
    const checks = evaluateHealth(
      {
        packageName: "Ivy 2",
        packageVersion: "1.0.10",
        vortexProfileId: "prof-1",
        mods: Array.from({ length: 963 }, (_, i) => ({
          vortexModId: `m${i}`,
          compareKey: `nexus:${i}:${i}`,
          name: `Mod ${i}`,
        })),
        rulesApplication: {
          appliedRuleCount: 291,
          baselinePluginOrder: ["a.esp", "b.esp", "c.esp", "d.esp"],
        },
        userlistApplication: { appliedRuleCount: 29 },
      },
      {
        existingProfileIds: ["prof-1"],
        activeProfileId: "prof-1",
        installedModIds: Array.from({ length: 960 }, (_, i) => `m${i}`),
        enabledModIds: Array.from({ length: 960 }, (_, i) => `m${i}`),
        driftedCompareKeys: undefined,
        currentPluginOrder: ["a.esp", "c.esp", "b.esp", "d.esp"],
        currentModRuleCount: 291,
        currentUserlistRuleCount: 29,
      },
    );
    write(
      "doctor-blocked",
      React.createElement(
        "div",
        { className: "eh-page" },
        React.createElement(DoctorPanel, {
          packageName: "Ivy 2",
          packageVersion: "1.0.10",
          checks,
          healingBlocked: healingBlockedReason({ kind: "installing" }),
          onRecheck: () => undefined,
          onHeal: () => undefined,
        } as never),
      ),
    );
  });

  it.skipIf(!on)("main dashboard — the first screen anyone sees", () => {
    write(
      "dashboard-home",
      // The real tree is .eh-page > Hero + DashboardBody (see Dashboard).
      React.createElement(
        "div",
        { className: "eh-page" },
        React.createElement(Hero, null),
        React.createElement(DashboardBody, {
        data: dashboardData,
        onNavigate: () => undefined,
          onRefresh: () => undefined,
        } as never),
      ),
    );
  });


  it.skipIf(!on)("build dashboard — the cards that ARE its content", () => {
    // The dashboard mounts loading and fills in from an effect, which static
    // rendering never runs, so capturing the page shows a skeleton. The cards
    // take their data as props, so they show the real screen without a DOM.
    //
    // Both states that matter: a published collection whose profile has NOT
    // changed since it shipped (Update suppressed), and one whose fingerprint
    // is unknown — which must still offer Update, because unknown is not the
    // same as up to date.
    const published = {
      slug: "ivy-2",
      packageId: "00000000-0000-4000-8000-000000000000",
      configPath: "C:/Users/x/AppData/Roaming/Vortex/event-horizon/collections/ivy-2.json",
      gameId: "fallout4",
      lastBuiltName: "Ivy 2",
      lastBuiltVersion: "1.0.10",
      lastBuiltAuthor: "DuduPhudu",
      lastBuiltAt: new Date(Date.now() - 42 * 60_000).toISOString(),
      lastBuiltProfileFingerprint: "dfe737127f8add3a",
    } as never;

    const draft = {
      key: "fallout4",
      updatedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
      payload: {
        draftId: "d1",
        gameId: "fallout4",
        title: "Ivy 2",
        linkedSlug: "ivy-2",
        linkedPackageId: "00000000-0000-4000-8000-000000000000",
        verificationLevel: "thorough",
        reverifyEverything: false,
        changelog: "",
        readme: "",
        overrides: {},
        curator: { name: "Ivy 2", version: "1.0.11", author: "DuduPhudu", description: "" },
      },
    } as never;

    write(
      "build-dashboard",
      React.createElement(ToastProvider, {
        children: React.createElement(
          "div",
          { className: "eh-stack eh-stack--lg" },
          React.createElement(DraftCard, {
            env: draft,
            activeGameId: "fallout4",
            registrySessionStateKind: "idle",
            onOpen: () => undefined,
            onDiscard: () => undefined,
          } as never),
          // The reported case: a draft linked to a published collection whose
          // card is therefore hidden, on a profile that has since changed.
          // Before this the dashboard knew the profile had moved — its own log
          // said upToDate:false — and showed a card that mentioned none of it.
          React.createElement(DraftCard, {
            env: draft,
            activeGameId: "fallout4",
            registrySessionStateKind: "idle",
            linkedPublished: { builtVersion: "1.0.11", profileChanged: true },
            onOpen: () => undefined,
            onDiscard: () => undefined,
          } as never),
          React.createElement(PublishedCard, {
            summary: published,
            upToDate: true,
            knownSlugs: ["ivy-2"],
            onUpdate: () => undefined,
            onDelete: () => undefined,
          } as never),
          React.createElement(PublishedCard, {
            summary: { ...(published as object), lastBuiltProfileFingerprint: undefined },
            upToDate: false,
            knownSlugs: ["ivy-2"],
            onUpdate: () => undefined,
            onDelete: () => undefined,
          } as never),
        ),
      } as never),
    );
  });

  it.skipIf(!on)("build done — the real v1.0.10 result and its 10 warnings", () => {
    // Verbatim from the actual build log: same counts, same sha256, same
    // warnings in the same order. This is the screen a curator reads after 28
    // minutes, and the only place those warnings are ever shown.
    const result = {
      outputPath:
        "C:/Users/x/AppData/Roaming/Vortex/event-horizon/collections/ivy-2-1.0.10.ehcoll",
      outputBytes: 157_837_710,
      outputSha256:
        "409721827a4c0097de4f2d33e2c45a789f7bdbdcf48df019423cc315b66dc276",
      bundledCount: 4,
      modCount: 963,
      warnings: [
        '"Liberty Wasteland Redux" is a Vortex collection installed in this profile, not a mod, so it was left out. Its staging folder holds copies of other mods\' files, which would have shipped them twice — and any INI tweaks it carries are not included either. The mods it installed are still in this collection in their own right.',
        "5 mods have no source archive and no Nexus source to fetch one from. They still ship — they are identified by the SHA-256 of their deployed files instead — but that identity is weaker: a user whose copy differs even slightly will not match it, and will be asked to supply the mod themselves. Re-importing their archives into Vortex would give them a real identity.",
        '2 external mods no longer match the archive they came from — files have been added or removed in the staging folder since. Right now the collection ships the ARCHIVE, so whoever installs it gets the original, not your version. Tick "bundle" on them to pack your actual files into the .ehcoll instead.\n  • "CC_enclave_textures": 766 staged file(s) are not in the archive (e.g. cc_enclave_textures.7z).\n  • "PorcOverlays_esl_02b": 1 staged file(s) are not in the archive.',
        "21 INI setting(s) describe your machine rather than this collection and were NOT shipped: bBorderless, bEnableAudio, bFull Screen, bMaximizeWindow, bTopMostWindow, fDefault1stPersonFOV, fDefaultWorldFOV, iAdapter, and 11 more.",
        '106 mod rule(s) reference 66 mod(s) that are not in this collection, so those rules were dropped: "1Optional - M1Garand", "2.1.0 CBBE BODY AND BODYSLIDES", and 60 more. This is normal on a profile that has been curated for a while.',
        "4382 contested file(s) recorded; 46205 file(s) are shipped by exactly one mod, so their deployment winner is that mod and was not written out.",
        '115 mod(s) were installed with FOMOD options you chose (e.g. "Weapon Mod Fixes"). Those choices are recorded here and replayed on install.',
        '"Ivy\'sPantiesSettings" is missing 7 file(s) that its archive contains and its own folders suggest should be there (e.g. F4SE/Plugins/BakaMaxPapyrusOps.toml). 13 of 21 files in "F4SE/Plugins" are installed (62%) — a partially extracted folder is what a lost write looks like. Worth opening before shipping.',
        '13 mod(s) have 885 staged file(s) that differ from their archives — most often "CC_enclave_textures" (766). This is normal if you repack BA2s, clean plugins, or run the game before building.',
        "9 mod(s) could not be checked against their archive (archive missing from disk, or unreadable).",
      ],
      // The decision panel, with the real shape of the finding: one mod that
      // is obviously generator output, one that is obviously NOT. If the
      // rendered page does not make those two look like different answers,
      // the copy has failed at the only job it has.
      postProcessingCandidates: [
        {
          modId: "mod-xlodgen",
          modName: "sse-xlodgen-output-pbr",
          unexplained: 1608,
          canMirror: true,
          files: [
            { path: "Textures/Terrain/Valefrost/Valefrost.Terrain.HeightMap.-27.-7.23.26.-256.452.dds", kind: "changed", delta: 24576 },
            { path: "Textures/Terrain/Tamriel/Tamriel.Terrain.HeightMap.4.-12.dds", kind: "added" },
            { path: "Meshes/Terrain/Tamriel/Objects/Tamriel.32.-32.-32.BTO", kind: "changed", delta: -2048 },
          ],
        },
        {
          modId: "mod-armour",
          modName: "Immersive Armours",
          unexplained: 2,
          canMirror: true,
          files: [
            { path: "Data/Meshes/armour/hide/patched_cuirass.nif", kind: "changed", delta: 24576 },
            { path: "Data/MyFix-Patch.esp", kind: "added" },
          ],
        },
        // Three more, taken from a real 57-mod report. Two candidates make
        // any layout look fine; the complaint this fixture exists to expose
        // is that consecutive mods ran together into one unreadable column,
        // which only shows up once there are several in a row.
        {
          modId: "mod-eeos",
          modName: "EEOS - Enemy Revolution of Skyrim-37228-2-02-1705594315",
          unexplained: 6,
          canMirror: true,
          files: [
            { path: "ApocalypseSpellsForNPCs_DISTR.ini", kind: "changed", delta: 24576 },
            { path: "GrowlPerksAndSpellsForNPCs_DISTR.ini", kind: "added" },
            { path: "ODINSpellsForNPCs_DISTR.ini", kind: "changed", delta: -2048 },
            { path: "PotionsForNPCs_DISTR.ini", kind: "changed", delta: -118 },
            { path: "TriumvirateShadowSpellsForNPCs_DISTR.ini", kind: "added" },
            { path: "VanillaShoutsForNPCs_DISTR.ini", kind: "changed", delta: -2048 },
          ],
        },
        {
          modId: "mod-junipers",
          modName: "3D Junipers - Trees and Berries-43852-0-2-1687771639",
          unexplained: 3,
          canMirror: true,
          files: [
            { path: "meshes/_byoh/plants/byohhouseingrdjuniper01.nif", kind: "changed", delta: 24576 },
            { path: "meshes/plants/florajuniper01.nif", kind: "added" },
            { path: "meshes/plants/juniper01.nif", kind: "changed", delta: -2048 },
          ],
        },
        {
          modId: "mod-grid",
          modName: "Grid Inventory 188733 1.4.1 2026-08-22T09-05Z L5WQbqhQB",
          unexplained: 2,
          canMirror: false,
          files: [
            { path: "SKSE/Plugins/GridInventory_icons.pak", kind: "changed", delta: 24576 },
            { path: "SKSE/Plugins/GridInventory_ui.ini", kind: "added" },
          ],
        },
      ],
    } as never;

    write(
      "build-done",
      React.createElement(ToastProvider, {
        children: React.createElement(DonePanel, {
          result,
          onBuildAnother: () => undefined,
          onGoHome: () => undefined,
          onDecidePostProcessing: async () => undefined,
        } as never),
      } as never),
    );
  });

  it.skipIf(!on)("preview — what the plan will do", () => {
    write(
      "preview",
      React.createElement(PreviewStep, {
        bundle,
        onContinue: () => undefined,
        onCancel: () => undefined,
      } as never),
    );
  });

  it.skipIf(!on)("decisions — the mods needing a human answer", () => {
    // 27 of them on the real plan. This is the screen where a user with no
    // context has to make choices about mods they have never heard of.
    const base = bundle as unknown as { plan: Record<string, unknown> };
    const conflictBundle = {
      ...(bundle as unknown as Record<string, unknown>),
      plan: {
        ...base.plan,
        modResolutions: Array.from({ length: 27 }, (_, i) => ({
          compareKey: `ext:${i}`,
          name: `External Mod ${i}`,
          decision: {
            kind: "external-prompt-user",
            reason: "no bundled archive and no download link",
            fileName: `ExternalMod${i}.7z`,
          },
        })),
      },
    } as never;

    // DecisionsStep uses useApi() (not the optional variant), because picking
    // a local file needs a real Vortex to open a dialog. A minimal provider is
    // enough for a static render.
    write(
      "decisions",
      // `children` goes in the props object rather than as createElement's
      // third argument: ApiProvider declares it required, and the positional
      // form does not satisfy that.
      React.createElement(ApiProvider, {
        api: { getState: () => ({}) } as never,
        children: React.createElement(DecisionsStep, {
          state: {
            kind: "decisions",
            bundle: conflictBundle,
            conflictChoices: {},
            orphanChoices: {},
          },
          dispatch: () => undefined,
          onContinue: () => undefined,
        } as never),
      }),
    );
  });


  // The curator-side availability check. Rendered with a result that has
  // something wrong in it — a panel screenshotted in its happy state shows
  // the layout that never needed checking.
  // The curator's FIRST REAL RUN, verbatim: 2 blocked (both file-gone, both
  // with a replacement), 21 old-version, 8 unchecked. Invented round numbers
  // would have hidden the wording bug this reproduces — "2 of those… 2 of
  // these…" only looks wrong when the two counts are the same two mods.
  it.skipIf(!on)("build-availability — the curator's real first run", () => {
    const finding = (
      modId: number,
      fileId: number,
      name: string,
      status: string,
      replacement?: { fileId: number; version: string },
    ) => ({
      compareKey: `nexus:${modId}:${fileId}`,
      name,
      modId,
      fileId,
      status,
      ...(replacement !== undefined ? { replacement } : {}),
    });
    const findings = [
      finding(69882, 406478, "Reapers Robco Munitions Patches-69882-5-2-1759089401", "file-missing", { fileId: 409332, version: "6.2" }),
      finding(4598, 270951, "Unofficial Fallout 4 Patch-4598-2-1-5-1679096028", "file-missing", { fileId: 407774, version: "2.2.2a" }),
      ...Array.from({ length: 21 }, (_, i) =>
        finding(50000 + i, 300000 + i, `Old version mod ${i}`, "old-version"),
      ),
      ...Array.from({ length: 8 }, (_, i) =>
        finding(60000 + i, 310000 + i, `Unchecked mod ${i}`, "unknown"),
      ),
      ...Array.from({ length: 895 }, (_, i) =>
        finding(70000 + i, 320000 + i, `Fine mod ${i}`, "available"),
      ),
    ];
    write(
      "build-availability",
      React.createElement(AvailabilityPanel, {
        onCheck: () => undefined,
        onTreatAsExternal: () => undefined,
        externalModIds: new Set(["4598:270951"]),
        result: {
          checkedAt: new Date().toISOString(),
          findings,
          summary: summarizeAvailability(findings as never),
        },
      } as never),
    );
  });

  it.skipIf(!on)("confirm — the last screen before an hour of work", () => {
    write(
      "confirm",
      React.createElement(ConfirmStep, {
        state: {
          kind: "confirm",
          bundle,
          decisions: { fomodReplayMode: "silent" } as never,
          conflictChoices: {},
          orphanChoices: {},
        },
        onInstall: () => undefined,
        onBack: () => undefined,
        onSetFomodMode: () => undefined,
      } as never),
    );
  });

  // The modal is what the Install button opens, and it is the only place the
  // question is asked — so it is the screen that actually needs looking at.
  // Rendered via ConfirmStep rather than in isolation so the real counts,
  // real copy and real Modal chrome all participate.
  it.skipIf(!on)("confirm-asking — the modal, which cannot be dismissed into a default", () => {
    write(
      "confirm-asking",
      React.createElement(ConfirmStep, {
        state: {
          kind: "confirm",
          bundle,
          decisions: {} as never,
          conflictChoices: {},
          orphanChoices: {},
        },
        onInstall: () => undefined,
        onBack: () => undefined,
        onSetFomodMode: () => undefined,
        // Test-only: opens the modal at render time. Without it a static
        // render shows the closed state and the copy goes unlooked-at.
        __openModalForRender: true,
      } as never),
    );
  });

  it.skipIf(!on)("installing — mid-run", () => {
    write(
      "installing",
      React.createElement(InstallingStep, {
        state: {
          kind: "installing",
          bundle,
          decisions: {} as never,
          progress: {
            phase: "installing-mods",
            currentStep: 412,
            totalSteps: 963,
            message: '[412/963] Installing "Tumba Gunner Collection"...',
          },
        } as never,
        onCancel: () => undefined,
        cancelPending: false,
      }),
    );
  });

  it.skipIf(!on)("done — a install with everything to say", () => {
    // Deliberately the loud case: every notice present at once. This is what
    // a Proton tester's first run actually looks like, and the screen has to
    // stay readable in it.
    const result = {
      kind: "success",
      profileName: "Ivy 2 v1.0.10",
      installTargetMode: "fresh-profile",
      durationMs: 96 * 60_000 + 14_000,
      installedModIds: Array.from({ length: 958 }, (_, i) => `m${i}`),
      installedMods: Array.from({ length: 958 }, (_, i) => ({
        compareKey: `k${i}`,
        name: `Mod ${i}`,
        fromDecision: i < 931 ? "nexus-download" : "external-prompt-user",
      })),
      removedMods: [],
      carriedMods: [],
      skippedMods: [
        { compareKey: "s1", name: "Alex's Attach Points", reason: "no archive and no Nexus source" },
      ],
      verifications: [
        ...Array.from({ length: 940 }, (_, i) => ({
          kind: "ok",
          vortexModId: `v${i}`,
          compareKey: `k${i}`,
          name: `Mod ${i}`,
          level: "thorough",
          verifiedFileCount: 42,
          extraFileCount: 0,
        })),
        {
          kind: "fail",
          vortexModId: "v999",
          compareKey: "k999",
          name: "Ivy'sPantiesSettings",
          level: "thorough",
          expectedFileCount: 21,
          missingFileCount: 7,
          sizeMismatchCount: 0,
          hashMismatchCount: 0,
          examples: [{ bucket: "missing", path: "F4SE/Plugins/BakaMaxPapyrusOps.toml" }],
          retryAttempted: true,
        },
      ],
      pluginFlagNotice: [
        "Restored the collection's ESL (light) flag on 6 plugin(s). These do not use a regular load-order slot, which is what lets a collection this size load at all.",
      ],
      damagedArchiveNotice: [
        '"Point Lookout" — The archive on this machine is damaged — no reader can open it (no end of central directory record), and its bytes do not match what the collection was built from. This is a corrupted or incomplete download rather than anything wrong with the collection.',
      ],
      rulesPurgeNotice: [
        "The collection's conflict and load-order rules are now the only ones in place, so what loads is exactly what the curator tested. 14 mod rule(s) across 9 mod(s) were removed, and your LOOT rules were cleared.",
        "A copy of everything removed was saved to: C:/Users/x/AppData/Roaming/Vortex/event-horizon/rule-backups/rules-fallout4-2026-08-30T01-12-04-000Z.json",
      ],
      modTypeNotice: [
        "2 mod(s) installed as a different KIND of mod than the curator had, which means Vortex will deploy their files to a different folder. They are installed and their files are correct — they are in the wrong place, so the game may not load them.",
        '  • "F4SE": the curator had "dinput", this installed as a normal mod.',
        "Reinstalling the mod through Vortex usually re-detects the right kind. A script extender is the one that matters most: it must sit next to the game executable, not in Data.",
      ],
      pluginOrderNotice: [
        "Your plugin order differs from the curator's in 3 place(s).",
        "  • CompanionIvy.esm loads 4 positions later here.",
      ],
      stagingDriftNotice: [
        "2 mods on this machine changed since the collection last installed them, and they are unchanged in this version of the collection. That usually means something edited them in between — you, a tool, or the game itself. Nothing here is necessarily wrong.",
        "  - Enhanced Vanilla Water",
        "  - DriedBlood",
        "Reinstalling any of these returns it to the collection's version; leaving it keeps what is on disk. Event Horizon has changed nothing.",
      ],
      iniTweakNotice: [
        "3 INI tweak(s) are enabled across 2 mod(s). They are recorded in this collection, but the installer does not apply INI tweaks yet.",
      ],
      gameIniNotice: [
        "390 game setting(s) were written to Fallout4.ini, Fallout4Prefs.ini and Fallout4Custom.ini. 21 of your own settings were kept.",
      ],
      externalArchiveNotice: [
        '"Bodyslide" installed from a file you supplied that is not the one the collection was built from.',
      ],
      curatorReports: [
        "Event Horizon — mod could not be reproduced\n\nCollection: Ivy 2 v1.0.10\nMod: Ivy'sPantiesSettings\nMod id: external:9f2c...\n\nWhat happened\nAfter installing, this mod's files did not match what the collection recorded, and they do not match its archive either.\n\nMissing (7) — recorded, not installed:\n  - F4SE/Plugins/BakaMaxPapyrusOps.toml",
      ],
      rulesApplication: RULES,
      userlistApplication: USERLIST,
    } as never;

    write(
      "done-loud",
      React.createElement(DoneStep, {
        result,
        bundle,
        onStartOver: () => undefined,
        onGoCollections: () => undefined,
        onSwitchProfile: () => undefined,
      } as never),
    );
  });

  it.skipIf(!on)("done — the quiet, everything-worked case", () => {
    const result = {
      kind: "success",
      profileName: "Ivy 2 v1.0.10",
      installTargetMode: "fresh-profile",
      durationMs: 96 * 60_000 + 14_000,
      installedModIds: Array.from({ length: 963 }, (_, i) => `m${i}`),
      installedMods: Array.from({ length: 963 }, (_, i) => ({
        compareKey: `k${i}`,
        name: `Mod ${i}`,
        fromDecision: "nexus-download",
      })),
      removedMods: [],
      carriedMods: [],
      skippedMods: [],
      verifications: Array.from({ length: 963 }, (_, i) => ({
        kind: "ok",
        vortexModId: `v${i}`,
        compareKey: `k${i}`,
        name: `Mod ${i}`,
        level: "thorough",
        verifiedFileCount: 42,
        extraFileCount: 0,
      })),
      rulesApplication: RULES,
      userlistApplication: USERLIST,
    } as never;

    write(
      "done-quiet",
      React.createElement(DoneStep, {
        result,
        bundle,
        onStartOver: () => undefined,
        onGoCollections: () => undefined,
        onSwitchProfile: () => undefined,
      } as never),
    );
  });
});


