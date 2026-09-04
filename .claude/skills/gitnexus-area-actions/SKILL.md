---
name: gitnexus-area-actions
description: "Skill for the Actions area of Event-Horizon. 85 symbols across 23 files."
---

# Actions

85 symbols | 23 files | Cohesion: 72%

## When to Use

- Working with code in `src/`
- Understanding how createBuildPackageAction, captureDeploymentManifests, collectDistinctModTypes work
- Modifying actions-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/actions/installCollectionAction.ts` | collectUserDecisions, formatDivergedConflictText, formatOrphanText, formatPromptUserText, pickConflictChoice (+24) |
| `src/actions/buildPackageAction.ts` | BundleResolutionError, createBuildPackageAction, formatBytes, formatError, promptCuratorMetadata (+8) |
| `src/utils/utils.ts` | exportDiffReport, pickJsonFile, pickTxtFile, pickModArchiveFile, openFile (+1) |
| `src/core/getModsListForProfile.ts` | getActiveGameId, getActiveProfileId, getActiveProfileIdFromState, belongsToGame |
| `src/core/deploymentManifest.ts` | captureDeploymentManifests, collectDistinctModTypes, normalizeManifest |
| `src/core/manifest/packageFileName.ts` | buildOutputFileName, safePackageVersion, slugifyPackageName |
| `src/actions/compareModsAction.ts` | createCompareModsAction, action, action |
| `src/actions/comparePluginsAction.ts` | createComparePluginsAction, action, action |
| `src/actions/exportModsAction.ts` | createExportModsAction, action, action |
| `src/core/comparePlugins.ts` | exportPluginsDiffReport, getCurrentPluginsTxtPath, getLocalAppDataPath |

## Entry Points

Start here when exploring this area:

- **`createBuildPackageAction`** (Function) — `src/actions/buildPackageAction.ts:117`
- **`captureDeploymentManifests`** (Function) — `src/core/deploymentManifest.ts:133`
- **`collectDistinctModTypes`** (Function) — `src/core/deploymentManifest.ts:53`
- **`matchEhcollFile`** (Function) — `src/core/doctor/heal.ts:177`
- **`captureLoadOrder`** (Function) — `src/core/loadOrder.ts:40`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createBuildPackageAction` | Function | `src/actions/buildPackageAction.ts` | 117 |
| `captureDeploymentManifests` | Function | `src/core/deploymentManifest.ts` | 133 |
| `collectDistinctModTypes` | Function | `src/core/deploymentManifest.ts` | 53 |
| `matchEhcollFile` | Function | `src/core/doctor/heal.ts` | 177 |
| `captureLoadOrder` | Function | `src/core/loadOrder.ts` | 40 |
| `reconcileExternalModsConfig` | Function | `src/core/manifest/collectionConfig.ts` | 323 |
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
