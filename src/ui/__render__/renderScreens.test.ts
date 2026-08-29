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
import { DoneStep, InstallingStep } from "../pages/install/steps";

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
  mods: Array.from({ length: 963 }, (_, i) => ({ name: `Mod ${i}` })),
  plugins: { order: Array.from({ length: 817 }, (_, i) => ({ name: `p${i}.esp` })) },
  rules: Array.from({ length: 291 }, () => ({})),
};

const bundle = {
  plan: {
    manifest,
    installTarget: { kind: "fresh-profile", profileName: "Ivy 2 v1.0.10" },
    summary: {
      totalMods: 963,
      alreadyInstalled: 0,
      willInstallSilently: 931,
      needsUserConfirmation: 27,
      missing: 5,
      orphans: 0,
    },
    resolutions: [],
    orphanedMods: [],
  },
  sourcePath: "C:/Users/x/AppData/Roaming/Vortex/event-horizon/collections/ivy-2-1.0.10.ehcoll",
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
