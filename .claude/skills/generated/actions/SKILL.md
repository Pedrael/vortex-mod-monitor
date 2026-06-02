---
name: actions
description: "Skill for the Actions area of vortex-mod-monitor. 69 symbols across 12 files."
---

# Actions

69 symbols | 12 files | Cohesion: 81%

## When to Use

- Working with code in `src/`
- Understanding how createBuildPackageAction, collectDistinctModTypes, captureDeploymentManifests work
- Modifying actions-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/actions/installCollectionAction.ts` | renderPlanDialog, formatPlanText, formatVerdict, formatInstallTarget, formatSummary (+26) |
| `src/actions/buildPackageAction.ts` | createBuildPackageAction, promptCuratorMetadata, validateCuratorInput, resolveVortexVersion, resolveGameVersion (+11) |
| `src/utils/utils.ts` | pickModArchiveFile, openFolder, openFile, pickTxtFile |
| `src/ui/pages/build/engine.ts` | externalMods, isNexusMod, resolveBundledArchives, readPluginsTxtIfPresent |
| `src/core/deploymentManifest.ts` | collectDistinctModTypes, normalizeManifest, captureDeploymentManifests |
| `src/core/comparePlugins.ts` | exportPluginsDiffReport, getLocalAppDataPath, getCurrentPluginsTxtPath |
| `src/actions/comparePluginsAction.ts` | action, createComparePluginsAction |
| `src/index.ts` | installEventHorizonIconSet, init |
| `src/ui/pages/install/steps.tsx` | handlePickFile |
| `src/core/archiveHashing.ts` | getModArchivePath |

## Entry Points

Start here when exploring this area:

- **`createBuildPackageAction`** (Function) — `src/actions/buildPackageAction.ts:107`
- **`collectDistinctModTypes`** (Function) — `src/core/deploymentManifest.ts:53`
- **`captureDeploymentManifests`** (Function) — `src/core/deploymentManifest.ts:133`
- **`pickModArchiveFile`** (Function) — `src/utils/utils.ts:91`
- **`getModArchivePath`** (Function) — `src/core/archiveHashing.ts:79`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createBuildPackageAction` | Function | `src/actions/buildPackageAction.ts` | 107 |
| `collectDistinctModTypes` | Function | `src/core/deploymentManifest.ts` | 53 |
| `captureDeploymentManifests` | Function | `src/core/deploymentManifest.ts` | 133 |
| `pickModArchiveFile` | Function | `src/utils/utils.ts` | 91 |
| `getModArchivePath` | Function | `src/core/archiveHashing.ts` | 79 |
| `externalMods` | Function | `src/ui/pages/build/engine.ts` | 294 |
| `action` | Function | `src/actions/buildPackageAction.ts` | 305 |
| `action` | Function | `src/actions/compareModsAction.ts` | 83 |
| `action` | Function | `src/actions/comparePluginsAction.ts` | 57 |
| `action` | Function | `src/actions/exportModsAction.ts` | 97 |
| `openFolder` | Function | `src/utils/utils.ts` | 13 |
| `openFile` | Function | `src/utils/utils.ts` | 16 |
| `createComparePluginsAction` | Function | `src/actions/comparePluginsAction.ts` | 13 |
| `exportPluginsDiffReport` | Function | `src/core/comparePlugins.ts` | 186 |
| `pickTxtFile` | Function | `src/utils/utils.ts` | 468 |
| `getCurrentPluginsTxtPath` | Function | `src/core/comparePlugins.ts` | 157 |
| `BundleResolutionError` | Class | `src/actions/buildPackageAction.ts` | 563 |
| `promptCuratorMetadata` | Function | `src/actions/buildPackageAction.ts` | 338 |
| `validateCuratorInput` | Function | `src/actions/buildPackageAction.ts` | 432 |
| `resolveVortexVersion` | Function | `src/actions/buildPackageAction.ts` | 450 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Init → ToPluginMap` | cross_community | 5 |
| `Init → NormalizePluginName` | cross_community | 5 |
| `Init → GetLocalAppDataPath` | cross_community | 4 |
| `CreateBuildPackageAction → ValidateCuratorInput` | intra_community | 3 |
| `CreateBuildPackageAction → AssignInstallOrder` | cross_community | 3 |
| `CreateExportModsAction → GetModArchivePath` | cross_community | 3 |
| `Init → GetActiveGameId` | cross_community | 3 |
| `Init → PickTxtFile` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Resolver | 5 calls |
| Manifest | 5 calls |
| Build | 3 calls |
| Installer | 2 calls |
| Cluster_52 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "createBuildPackageAction"})` — see callers and callees
2. `gitnexus_query({query: "actions"})` — find related execution flows
3. Read key files listed above for implementation details
