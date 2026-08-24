---
name: gitnexus-area-actions
description: "Skill for the Actions area of vortex-mod-monitor. 79 symbols across 15 files."
---

# Actions

79 symbols | 15 files | Cohesion: 74%

## When to Use

- Working with code in `src/`
- Understanding how createCompareModsAction, createComparePluginsAction, createExportModsAction work
- Modifying actions-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/actions/installCollectionAction.ts` | formatExternalDeps, formatInstallTarget, formatModBuckets, formatOrphans, formatPlanText (+24) |
| `src/actions/buildPackageAction.ts` | BundleResolutionError, buildOutputFileName, createBuildPackageAction, formatBytes, formatError (+13) |
| `src/utils/utils.ts` | exportDiffReport, pickJsonFile, pickTxtFile, openFile, openFolder |
| `src/core/getModsListForProfile.ts` | getActiveGameId, getActiveProfileId, getActiveProfileIdFromState, belongsToGame |
| `src/ui/pages/build/engine.ts` | loadBuildContext, isNexusMod, resolveBundledArchives, readPluginsTxtIfPresent |
| `src/actions/compareModsAction.ts` | createCompareModsAction, action, action |
| `src/actions/comparePluginsAction.ts` | createComparePluginsAction, action, action |
| `src/actions/exportModsAction.ts` | createExportModsAction, action, action |
| `src/core/comparePlugins.ts` | exportPluginsDiffReport, getCurrentPluginsTxtPath, getLocalAppDataPath |
| `src/ui/pages/dashboard/data.ts` | formatGameLabel, readSystemStatus |

## Entry Points

Start here when exploring this area:

- **`createCompareModsAction`** (Function) — `src/actions/compareModsAction.ts:21`
- **`createComparePluginsAction`** (Function) — `src/actions/comparePluginsAction.ts:15`
- **`createExportModsAction`** (Function) — `src/actions/exportModsAction.ts:17`
- **`exportPluginsDiffReport`** (Function) — `src/core/comparePlugins.ts:186`
- **`exportModsToJsonFile`** (Function) — `src/core/exportMods.ts:7`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createCompareModsAction` | Function | `src/actions/compareModsAction.ts` | 21 |
| `createComparePluginsAction` | Function | `src/actions/comparePluginsAction.ts` | 15 |
| `createExportModsAction` | Function | `src/actions/exportModsAction.ts` | 17 |
| `exportPluginsDiffReport` | Function | `src/core/comparePlugins.ts` | 186 |
| `exportModsToJsonFile` | Function | `src/core/exportMods.ts` | 7 |
| `getActiveGameId` | Function | `src/core/getModsListForProfile.ts` | 208 |
| `getActiveProfileId` | Function | `src/core/getModsListForProfile.ts` | 213 |
| `getActiveProfileIdFromState` | Function | `src/core/getModsListForProfile.ts` | 245 |
| `belongsToGame` | Function | `src/core/getModsListForProfile.ts` | 250 |
| `beginOp` | Function | `src/core/logging/ehLog.ts` | 153 |
| `getVortexUserDataPath` | Function | `src/core/paths.ts` | 38 |
| `loadBuildContext` | Function | `src/ui/pages/build/engine.ts` | 239 |
| `readSystemStatus` | Function | `src/ui/pages/dashboard/data.ts` | 133 |
| `exportDiffReport` | Function | `src/utils/utils.ts` | 449 |
| `pickJsonFile` | Function | `src/utils/utils.ts` | 47 |
| `pickTxtFile` | Function | `src/utils/utils.ts` | 468 |
| `createBuildPackageAction` | Function | `src/actions/buildPackageAction.ts` | 109 |
| `captureLoadOrder` | Function | `src/core/loadOrder.ts` | 40 |
| `getModArchivePath` | Function | `src/core/archiveHashing.ts` | 79 |
| `action` | Function | `src/actions/buildPackageAction.ts` | 323 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Init → GetVortexUserDataPath` | cross_community | 9 |
| `CreateBuildPackageAction → GetVortexUserDataPath` | cross_community | 8 |
| `LoadBuildContext → GetVortexUserDataPath` | cross_community | 8 |
| `RouteOutlet → BelongsToGame` | cross_community | 7 |
| `Fail → GetVortexUserDataPath` | cross_community | 7 |
| `Ok → GetVortexUserDataPath` | cross_community | 7 |
| `Step → GetVortexUserDataPath` | cross_community | 7 |
| `RunSelfChecks → GetVortexUserDataPath` | cross_community | 7 |
| `RouteOutlet → GetActiveGameId` | cross_community | 6 |
| `RouteOutlet → ResolveProfileName` | cross_community | 6 |

## How to Explore

1. `context({name: "createCompareModsAction"})` — see callers and callees
2. `query({search_query: "actions"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
