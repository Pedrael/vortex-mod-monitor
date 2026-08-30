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
import { DonePanel } from "../pages/build/BuildPage";

const OUT = path.join(
  "C:",
  "Users",
  "DuduPhudu",
  "AppData",
  "Local",
  "Temp",
  "claude",
  "C--Users-DuduPhudu-Documents-Projects-vortex-mod-monitor",
  "14324b8e-dcc0-4943-aa2c-69a8476e5edf",
  "scratchpad",
  "ui",
);

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
  mods: Array.from({ length: 963 }, (_, i) => ({
    name: `Mod ${i}`,
    install:
      i < 115
        ? { fomodSelections: [{ name: "step", groups: [{ name: "g", choices: [{ name: "c", idx: 1 }] }] }] }
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

describe("render", () => {
  const on = process.env.EH_RENDER === "1";

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
    } as never;

    write(
      "build-done",
      React.createElement(ToastProvider, {
        children: React.createElement(DonePanel, {
          result,
          onBuildAnother: () => undefined,
          onGoHome: () => undefined,
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

  it.skipIf(!on)("confirm — the last screen before an hour of work", () => {
    write(
      "confirm",
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


