---
name: gitnexus-area-actions
description: "Skill for the Actions area of vortex-mod-monitor. 78 symbols across 16 files."
---

# Actions

78 symbols | 16 files | Cohesion: 74%

## When to Use

- Working with code in `src/`
- Understanding how createBuildPackageAction, captureLoadOrder, reconcileExternalModsConfig work
- Modifying actions-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/actions/installCollectionAction.ts` | collectUserDecisions, formatDivergedConflictText, formatOrphanText, formatPromptUserText, pickConflictChoice (+24) |
| `src/actions/buildPackageAction.ts` | BundleResolutionError, buildOutputFileName, collectExternalMods, createBuildPackageAction, formatBytes (+13) |
| `src/utils/utils.ts` | exportDiffReport, pickJsonFile, pickTxtFile, pickModArchiveFile, openFile (+1) |
| `src/core/getModsListForProfile.ts` | getActiveGameId, getActiveProfileId, getActiveProfileIdFromState, belongsToGame |
| `src/actions/compareModsAction.ts` | createCompareModsAction, action, action |
| `src/actions/comparePluginsAction.ts` | createComparePluginsAction, action, action |
| `src/actions/exportModsAction.ts` | createExportModsAction, action, action |
| `src/core/comparePlugins.ts` | exportPluginsDiffReport, getCurrentPluginsTxtPath, getLocalAppDataPath |
| `src/ui/pages/dashboard/data.ts` | formatGameLabel, readSystemStatus |
| `src/core/loadOrder.ts` | captureLoadOrder |

## Entry Points

Start here when exploring this area:

- **`createBuildPackageAction`** (Function) — `src/actions/buildPackageAction.ts:109`
- **`captureLoadOrder`** (Function) — `src/core/loadOrder.ts:40`
- **`reconcileExternalModsConfig`** (Function) — `src/core/manifest/collectionConfig.ts:288`
- **`createCompareModsAction`** (Function) — `src/actions/compareModsAction.ts:21`
- **`createComparePluginsAction`** (Function) — `src/actions/comparePluginsAction.ts:15`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createBuildPackageAction` | Function | `src/actions/buildPackageAction.ts` | 109 |
| `captureLoadOrder` | Function | `src/core/loadOrder.ts` | 40 |
| `reconcileExternalModsConfig` | Function | `src/core/manifest/collectionConfig.ts` | 288 |
| `createCompareModsAction` | Function | `src/actions/compareModsAction.ts` | 21 |
| `createComparePluginsAction` | Function | `src/actions/comparePluginsAction.ts` | 15 |
| `createExportModsAction` | Function | `src/actions/exportModsAction.ts` | 17 |
| `exportPluginsDiffReport` | Function | `src/core/comparePlugins.ts` | 186 |
| `exportModsToJsonFile` | Function | `src/core/exportMods.ts` | 7 |
| `getActiveGameId` | Function | `src/core/getModsListForProfile.ts` | 219 |
| `getActiveProfileId` | Function | `src/core/getModsListForProfile.ts` | 224 |
| `getActiveProfileIdFromState` | Function | `src/core/getModsListForProfile.ts` | 256 |
| `belongsToGame` | Function | `src/core/getModsListForProfile.ts` | 261 |
| `beginOp` | Function | `src/core/logging/ehLog.ts` | 153 |
| `getVortexUserDataPath` | Function | `src/core/paths.ts` | 38 |
| `readSystemStatus` | Function | `src/ui/pages/dashboard/data.ts` | 133 |
| `exportDiffReport` | Function | `src/utils/utils.ts` | 454 |
| `pickJsonFile` | Function | `src/utils/utils.ts` | 70 |
| `pickTxtFile` | Function | `src/utils/utils.ts` | 473 |
| `pickModArchiveFile` | Function | `src/utils/utils.ts` | 113 |
| `action` | Function | `src/actions/buildPackageAction.ts` | 335 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `OnDidInstall → GetVortexUserDataPath` | cross_community | 9 |
| `Init → GetVortexUserDataPath` | cross_community | 9 |
| `CreateBuildPackageAction → GetVortexUserDataPath` | cross_community | 8 |
| `BuildWizard → GetVortexUserDataPath` | cross_community | 8 |
| `RouteOutlet → BelongsToGame` | cross_community | 7 |
| `ProbeNexusAccount → GetVortexUserDataPath` | cross_community | 7 |
| `ProbeInstallerApi → GetVortexUserDataPath` | cross_community | 7 |
| `RunSelfChecks → GetVortexUserDataPath` | cross_community | 7 |
| `CurrentFingerprint → GetVortexUserDataPath` | cross_community | 7 |
| `RouteOutlet → GetActiveGameId` | cross_community | 6 |

## How to Explore

1. `context({name: "createBuildPackageAction"})` — see callers and callees
2. `query({search_query: "actions"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
