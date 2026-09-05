---
name: gitnexus-area-resolver
description: "Skill for the Resolver area of Event-Horizon. 97 symbols across 21 files."
---

# Resolver

97 symbols | 21 files | Cohesion: 80%

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
| `src/actions/installCollectionAction.ts` | createInstallCollectionAction, formatError, isPlanInstallable, logPlanSummary, profileExistsInState (+2) |
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
- **`createInstallCollectionAction`** (Function) — `src/actions/installCollectionAction.ts:111`
- **`exportPluginsDiffReport`** (Function) — `src/core/comparePlugins.ts:186`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createCompareModsAction` | Function | `src/actions/compareModsAction.ts` | 21 |
| `createComparePluginsAction` | Function | `src/actions/comparePluginsAction.ts` | 15 |
| `createExportModsAction` | Function | `src/actions/exportModsAction.ts` | 17 |
| `createInstallCollectionAction` | Function | `src/actions/installCollectionAction.ts` | 111 |
| `exportPluginsDiffReport` | Function | `src/core/comparePlugins.ts` | 186 |
| `exportModsToJsonFile` | Function | `src/core/exportMods.ts` | 7 |
| `getActiveGameId` | Function | `src/core/getModsListForProfile.ts` | 249 |
| `getActiveProfileId` | Function | `src/core/getModsListForProfile.ts` | 254 |
| `getActiveProfileIdFromState` | Function | `src/core/getModsListForProfile.ts` | 286 |
| `belongsToGame` | Function | `src/core/getModsListForProfile.ts` | 291 |
| `getModsForProfile` | Function | `src/core/getModsListForProfile.ts` | 541 |
| `deleteReceipt` | Function | `src/core/installLedger.ts` | 396 |
| `beginOp` | Function | `src/core/logging/ehLog.ts` | 153 |
| `getEventHorizonDir` | Function | `src/core/paths.ts` | 53 |
| `getEventHorizonRoot` | Function | `src/core/paths.ts` | 43 |
| `getVortexUserDataPath` | Function | `src/core/paths.ts` | 38 |
| `downloadsDirFor` | Function | `src/core/resolver/scanAvailableDownloads.ts` | 40 |
| `scanAvailableDownloads` | Function | `src/core/resolver/scanAvailableDownloads.ts` | 57 |
| `buildUserSideState` | Function | `src/core/resolver/userState.ts` | 120 |
| `pickInstallTarget` | Function | `src/core/resolver/userState.ts` | 150 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `InstallNexusViaApi → GetEventHorizonRoot` | cross_community | 10 |
| `ExecuteDecision → GetEventHorizonDir` | cross_community | 10 |
| `Act → GetEventHorizonDir` | cross_community | 10 |
| `Init → GetVortexUserDataPath` | cross_community | 9 |
| `CreateBuildPackageAction → GetVortexUserDataPath` | cross_community | 8 |
| `RunLoadingPipeline → ZipReadError` | cross_community | 8 |
| `BuildWizard → GetVortexUserDataPath` | cross_community | 8 |
| `RouteOutlet → BelongsToGame` | cross_community | 7 |
| `RunSelfChecks → GetVortexUserDataPath` | cross_community | 7 |
| `CurrentFingerprint → GetVortexUserDataPath` | cross_community | 7 |

## How to Explore

1. `context({name: "createCompareModsAction"})` — see callers and callees
2. `query({search_query: "resolver"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
