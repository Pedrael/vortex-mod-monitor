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

- **`createBuildPackageAction`** (Function) — `src/actions/buildPackageAction.ts:105`
- **`openFolder`** (Function) — `src/utils/utils.ts:7`
- **`pickTxtFile`** (Function) — `src/utils/utils.ts:392`
- **`exportPluginsDiffReport`** (Function) — `src/core/comparePlugins.ts:186`
- **`createComparePluginsAction`** (Function) — `src/actions/comparePluginsAction.ts:13`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createBuildPackageAction` | Function | `src/actions/buildPackageAction.ts` | 105 |
| `openFolder` | Function | `src/utils/utils.ts` | 7 |
| `pickTxtFile` | Function | `src/utils/utils.ts` | 392 |
| `exportPluginsDiffReport` | Function | `src/core/comparePlugins.ts` | 186 |
| `createComparePluginsAction` | Function | `src/actions/comparePluginsAction.ts` | 13 |
| `openFile` | Function | `src/utils/utils.ts` | 10 |
| `pickJsonFile` | Function | `src/utils/utils.ts` | 41 |
| `exportDiffReport` | Function | `src/utils/utils.ts` | 373 |
| `createCompareModsAction` | Function | `src/actions/compareModsAction.ts` | 19 |
| `getCurrentPluginsTxtPath` | Function | `src/core/comparePlugins.ts` | 157 |
| `BundleResolutionError` | Class | `src/actions/buildPackageAction.ts` | 543 |
| `promptCuratorMetadata` | Function | `src/actions/buildPackageAction.ts` | 318 |
| `validateCuratorInput` | Function | `src/actions/buildPackageAction.ts` | 412 |
| `resolveVortexVersion` | Function | `src/actions/buildPackageAction.ts` | 430 |
| `resolveGameVersion` | Function | `src/actions/buildPackageAction.ts` | 441 |
| `resolveDeploymentMethod` | Function | `src/actions/buildPackageAction.ts` | 467 |
| `buildOutputFileName` | Function | `src/actions/buildPackageAction.ts` | 521 |
| `slugify` | Function | `src/actions/buildPackageAction.ts` | 527 |
| `collectExternalMods` | Function | `src/actions/buildPackageAction.ts` | 564 |
| `isNexusMod` | Function | `src/actions/buildPackageAction.ts` | 572 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `FormatPlanText → Pad` | intra_community | 4 |
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
| Cluster_15 | 2 calls |
| Install | 1 calls |
| Installer | 1 calls |

## How to Explore

1. `gitnexus_context({name: "createBuildPackageAction"})` — see callers and callees
2. `gitnexus_query({query: "actions"})` — find related execution flows
3. Read key files listed above for implementation details
