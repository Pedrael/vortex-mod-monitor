---
name: gitnexus-area-resolver
description: "Skill for the Resolver area of Event-Horizon. 98 symbols across 22 files."
---

# Resolver

98 symbols | 22 files | Cohesion: 77%

## When to Use

- Working with code in `src/`
- Understanding how createCompareModsAction, createComparePluginsAction, createExportModsAction work
- Modifying resolver-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/resolver/resolveInstallPlan.ts` | bundledZipPath, extractExtension, findDownloadBySha, findInstalledByNexusExact, findInstalledByNexusFileMismatch (+23) |
| `src/core/getModsListForProfile.ts` | assignInstallOrder, getActiveGameId, getActiveProfileId, getActiveProfileIdFromState, belongsToGame (+10) |
| `src/core/resolver/userState.ts` | buildSuggestedProfileName, buildUserSideState, pickInstallTarget, previousInstallFromReceipt, readDisabledExtensionsMap (+9) |
| `src/actions/installCollectionAction.ts` | createInstallCollectionAction, formatError, isPlanInstallable, profileExistsInState, resolveStaleReceipt (+1) |
| `src/ui/pages/install/engine.ts` | profileExistsInState, runLoadingPipeline, runLoadingPipelineWithReceipt, warnIfSevenZipBroken |
| `src/utils/utils.ts` | exportDiffReport, pickEhcollFile, pickJsonFile, pickTxtFile |
| `src/core/resolver/collectAvailableDownloads.test.ts` | action, engine, pipelines, read |
| `src/core/resolver/gameVersionGuidance.ts` | compareVersions, parse, describe, gameVersionGuidance |
| `src/core/paths.ts` | getEventHorizonDir, getEventHorizonRoot, getVortexUserDataPath |
| `src/core/resolver/scanAvailableDownloads.ts` | downloadsDirFor, scanAvailableDownloads |

## Entry Points

Start here when exploring this area:

- **`createCompareModsAction`** (Function) — `src/actions/compareModsAction.ts:21`
- **`createComparePluginsAction`** (Function) — `src/actions/comparePluginsAction.ts:15`
- **`createExportModsAction`** (Function) — `src/actions/exportModsAction.ts:17`
- **`createInstallCollectionAction`** (Function) — `src/actions/installCollectionAction.ts:112`
- **`exportPluginsDiffReport`** (Function) — `src/core/comparePlugins.ts:186`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createCompareModsAction` | Function | `src/actions/compareModsAction.ts` | 21 |
| `createComparePluginsAction` | Function | `src/actions/comparePluginsAction.ts` | 15 |
| `createExportModsAction` | Function | `src/actions/exportModsAction.ts` | 17 |
| `createInstallCollectionAction` | Function | `src/actions/installCollectionAction.ts` | 112 |
| `exportPluginsDiffReport` | Function | `src/core/comparePlugins.ts` | 186 |
| `profileDriftSince` | Function | `src/core/curator/profileDrift.ts` | 51 |
| `exportModsToJsonFile` | Function | `src/core/exportMods.ts` | 7 |
| `getActiveGameId` | Function | `src/core/getModsListForProfile.ts` | 249 |
| `getActiveProfileId` | Function | `src/core/getModsListForProfile.ts` | 254 |
| `getActiveProfileIdFromState` | Function | `src/core/getModsListForProfile.ts` | 286 |
| `belongsToGame` | Function | `src/core/getModsListForProfile.ts` | 291 |
| `getModsForProfile` | Function | `src/core/getModsListForProfile.ts` | 541 |
| `deleteReceipt` | Function | `src/core/installLedger.ts` | 422 |
| `beginOp` | Function | `src/core/logging/ehLog.ts` | 153 |
| `getEventHorizonDir` | Function | `src/core/paths.ts` | 53 |
| `getEventHorizonRoot` | Function | `src/core/paths.ts` | 43 |
| `getVortexUserDataPath` | Function | `src/core/paths.ts` | 38 |
| `downloadsDirFor` | Function | `src/core/resolver/scanAvailableDownloads.ts` | 40 |
| `scanAvailableDownloads` | Function | `src/core/resolver/scanAvailableDownloads.ts` | 57 |
| `buildUserSideState` | Function | `src/core/resolver/userState.ts` | 120 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ExecutePromptUserChoice → GetEventHorizonDir` | cross_community | 10 |
| `RunInstallImpl → GetEventHorizonRoot` | cross_community | 10 |
| `ReadZipEntry → GetVortexUserDataPath` | cross_community | 10 |
| `PublishedDetailsPanel → GetEventHorizonDir` | cross_community | 10 |
| `Dashboard → GetEventHorizonRoot` | cross_community | 10 |
| `RunSelfChecks → GetVortexUserDataPath` | cross_community | 10 |
| `Act → GetEventHorizonDir` | cross_community | 10 |
| `LoadPublishedDetails → GetEventHorizonRoot` | cross_community | 10 |
| `SelfCheckMod → GetVortexUserDataPath` | cross_community | 10 |
| `RunLoadingPipeline → GetEventHorizonRoot` | cross_community | 10 |

## How to Explore

1. `context({name: "createCompareModsAction"})` — see callers and callees
2. `query({search_query: "resolver"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
