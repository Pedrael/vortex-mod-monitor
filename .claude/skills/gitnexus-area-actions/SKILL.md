---
name: gitnexus-area-actions
description: "Skill for the Actions area of Event-Horizon. 84 symbols across 22 files."
---

# Actions

84 symbols | 22 files | Cohesion: 73%

## When to Use

- Working with code in `src/`
- Understanding how createBuildPackageAction, matchEhcollFile, captureLoadOrder work
- Modifying actions-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/actions/installCollectionAction.ts` | collectUserDecisions, formatDivergedConflictText, formatOrphanText, formatPromptUserText, pickConflictChoice (+24) |
| `src/actions/buildPackageAction.ts` | BundleResolutionError, collectExternalMods, createBuildPackageAction, formatBytes, formatError (+11) |
| `src/utils/utils.ts` | exportDiffReport, pickJsonFile, pickTxtFile, pickModArchiveFile, openFile (+1) |
| `src/core/getModsListForProfile.ts` | getActiveGameId, getActiveProfileId, getActiveProfileIdFromState, belongsToGame |
| `src/core/manifest/packageFileName.ts` | buildOutputFileName, safePackageVersion, slugifyPackageName |
| `src/actions/compareModsAction.ts` | createCompareModsAction, action, action |
| `src/actions/comparePluginsAction.ts` | createComparePluginsAction, action, action |
| `src/actions/exportModsAction.ts` | createExportModsAction, action, action |
| `src/core/comparePlugins.ts` | exportPluginsDiffReport, getCurrentPluginsTxtPath, getLocalAppDataPath |
| `src/ui/pages/dashboard/data.ts` | formatGameLabel, readSystemStatus |

## Entry Points

Start here when exploring this area:

- **`createBuildPackageAction`** (Function) — `src/actions/buildPackageAction.ts:116`
- **`matchEhcollFile`** (Function) — `src/core/doctor/heal.ts:177`
- **`captureLoadOrder`** (Function) — `src/core/loadOrder.ts:40`
- **`toBuildManifestExternalMods`** (Function) — `src/core/manifest/collectionConfig.ts:364`
- **`applyHint`** (Function) — `src/core/manifest/externalHints.ts:229`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createBuildPackageAction` | Function | `src/actions/buildPackageAction.ts` | 116 |
| `matchEhcollFile` | Function | `src/core/doctor/heal.ts` | 177 |
| `captureLoadOrder` | Function | `src/core/loadOrder.ts` | 40 |
| `toBuildManifestExternalMods` | Function | `src/core/manifest/collectionConfig.ts` | 364 |
| `applyHint` | Function | `src/core/manifest/externalHints.ts` | 229 |
| `locateCollectionPackage` | Function | `src/core/manifest/locatePackage.ts` | 28 |
| `buildOutputFileName` | Function | `src/core/manifest/packageFileName.ts` | 32 |
| `safePackageVersion` | Function | `src/core/manifest/packageFileName.ts` | 27 |
| `slugifyPackageName` | Function | `src/core/manifest/packageFileName.ts` | 15 |
| `createCompareModsAction` | Function | `src/actions/compareModsAction.ts` | 21 |
| `createComparePluginsAction` | Function | `src/actions/comparePluginsAction.ts` | 15 |
| `createExportModsAction` | Function | `src/actions/exportModsAction.ts` | 17 |
| `exportPluginsDiffReport` | Function | `src/core/comparePlugins.ts` | 186 |
| `exportModsToJsonFile` | Function | `src/core/exportMods.ts` | 7 |
| `getActiveGameId` | Function | `src/core/getModsListForProfile.ts` | 242 |
| `getActiveProfileId` | Function | `src/core/getModsListForProfile.ts` | 247 |
| `getActiveProfileIdFromState` | Function | `src/core/getModsListForProfile.ts` | 279 |
| `belongsToGame` | Function | `src/core/getModsListForProfile.ts` | 284 |
| `beginOp` | Function | `src/core/logging/ehLog.ts` | 153 |
| `getVortexUserDataPath` | Function | `src/core/paths.ts` | 38 |

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
