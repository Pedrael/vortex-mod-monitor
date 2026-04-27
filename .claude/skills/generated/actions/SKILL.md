---
name: actions
description: "Skill for the Actions area of vortex-mod-monitor. 55 symbols across 7 files."
---

# Actions

55 symbols | 7 files | Cohesion: 73%

## When to Use

- Working with code in `src/`
- Understanding how createBuildPackageAction, openFolder, pickTxtFile work
- Modifying actions-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/actions/installCollectionAction.ts` | renderPlanDialog, formatPlanText, formatVerdict, formatInstallTarget, formatSummary (+24) |
| `src/actions/buildPackageAction.ts` | createBuildPackageAction, promptCuratorMetadata, validateCuratorInput, resolveVortexVersion, resolveGameVersion (+10) |
| `src/utils/utils.ts` | openFolder, pickTxtFile, openFile, pickJsonFile, exportDiffReport |
| `src/core/comparePlugins.ts` | exportPluginsDiffReport, getLocalAppDataPath, getCurrentPluginsTxtPath |
| `src/actions/comparePluginsAction.ts` | createComparePluginsAction |
| `src/actions/compareModsAction.ts` | createCompareModsAction |
| `src/ui/pages/build/engine.ts` | readPluginsTxtIfPresent |

## Entry Points

Start here when exploring this area:

- **`createBuildPackageAction`** (Function) — `src/actions/buildPackageAction.ts:106`
- **`openFolder`** (Function) — `src/utils/utils.ts:8`
- **`pickTxtFile`** (Function) — `src/utils/utils.ts:410`
- **`exportPluginsDiffReport`** (Function) — `src/core/comparePlugins.ts:186`
- **`createComparePluginsAction`** (Function) — `src/actions/comparePluginsAction.ts:13`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createBuildPackageAction` | Function | `src/actions/buildPackageAction.ts` | 106 |
| `openFolder` | Function | `src/utils/utils.ts` | 8 |
| `pickTxtFile` | Function | `src/utils/utils.ts` | 410 |
| `exportPluginsDiffReport` | Function | `src/core/comparePlugins.ts` | 186 |
| `createComparePluginsAction` | Function | `src/actions/comparePluginsAction.ts` | 13 |
| `openFile` | Function | `src/utils/utils.ts` | 11 |
| `pickJsonFile` | Function | `src/utils/utils.ts` | 42 |
| `exportDiffReport` | Function | `src/utils/utils.ts` | 391 |
| `createCompareModsAction` | Function | `src/actions/compareModsAction.ts` | 19 |
| `getCurrentPluginsTxtPath` | Function | `src/core/comparePlugins.ts` | 157 |
| `BundleResolutionError` | Class | `src/actions/buildPackageAction.ts` | 549 |
| `promptCuratorMetadata` | Function | `src/actions/buildPackageAction.ts` | 324 |
| `validateCuratorInput` | Function | `src/actions/buildPackageAction.ts` | 418 |
| `resolveVortexVersion` | Function | `src/actions/buildPackageAction.ts` | 436 |
| `resolveGameVersion` | Function | `src/actions/buildPackageAction.ts` | 447 |
| `resolveDeploymentMethod` | Function | `src/actions/buildPackageAction.ts` | 473 |
| `buildOutputFileName` | Function | `src/actions/buildPackageAction.ts` | 527 |
| `slugify` | Function | `src/actions/buildPackageAction.ts` | 533 |
| `collectExternalMods` | Function | `src/actions/buildPackageAction.ts` | 570 |
| `isNexusMod` | Function | `src/actions/buildPackageAction.ts` | 578 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CreateBuildPackageAction → ValidateCuratorInput` | intra_community | 3 |
| `Init → PickJsonFile` | cross_community | 3 |
| `Init → PickTxtFile` | cross_community | 3 |
| `CreateComparePluginsAction → GetLocalAppDataPath` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Resolver | 10 calls |
| Manifest | 6 calls |
| Build | 4 calls |
| Cluster_13 | 2 calls |
| Install | 1 calls |
| Installer | 1 calls |
| Cluster_9 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "createBuildPackageAction"})` — see callers and callees
2. `gitnexus_query({query: "actions"})` — find related execution flows
3. Read key files listed above for implementation details
