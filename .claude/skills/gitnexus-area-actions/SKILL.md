---
name: gitnexus-area-actions
description: "Skill for the Actions area of vortex-mod-monitor. 67 symbols across 11 files."
---

# Actions

67 symbols | 11 files | Cohesion: 80%

## When to Use

- Working with code in `src/`
- Understanding how createBuildPackageAction, captureLoadOrder, getModArchivePath work
- Modifying actions-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/actions/installCollectionAction.ts` | formatExternalDeps, formatInstallTarget, formatModBuckets, formatOrphans, formatPlanText (+24) |
| `src/actions/buildPackageAction.ts` | BundleResolutionError, buildOutputFileName, createBuildPackageAction, formatBytes, formatError (+13) |
| `src/ui/pages/build/engine.ts` | isNexusMod, resolveBundledArchives, readPluginsTxtIfPresent |
| `src/actions/comparePluginsAction.ts` | action, action, createComparePluginsAction |
| `src/utils/utils.ts` | openFile, openFolder, pickTxtFile |
| `src/core/comparePlugins.ts` | exportPluginsDiffReport, getCurrentPluginsTxtPath, getLocalAppDataPath |
| `src/actions/compareModsAction.ts` | action, action |
| `src/actions/exportModsAction.ts` | action, action |
| `src/index.ts` | init, installEventHorizonIconSet |
| `src/core/loadOrder.ts` | captureLoadOrder |

## Entry Points

Start here when exploring this area:

- **`createBuildPackageAction`** (Function) — `src/actions/buildPackageAction.ts:107`
- **`captureLoadOrder`** (Function) — `src/core/loadOrder.ts:40`
- **`getModArchivePath`** (Function) — `src/core/archiveHashing.ts:79`
- **`action`** (Function) — `src/actions/buildPackageAction.ts:305`
- **`action`** (Function) — `src/actions/buildPackageAction.ts:313`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createBuildPackageAction` | Function | `src/actions/buildPackageAction.ts` | 107 |
| `captureLoadOrder` | Function | `src/core/loadOrder.ts` | 40 |
| `getModArchivePath` | Function | `src/core/archiveHashing.ts` | 79 |
| `action` | Function | `src/actions/buildPackageAction.ts` | 305 |
| `action` | Function | `src/actions/buildPackageAction.ts` | 313 |
| `action` | Function | `src/actions/compareModsAction.ts` | 83 |
| `action` | Function | `src/actions/comparePluginsAction.ts` | 57 |
| `action` | Function | `src/actions/exportModsAction.ts` | 97 |
| `openFile` | Function | `src/utils/utils.ts` | 12 |
| `action` | Function | `src/actions/buildPackageAction.ts` | 309 |
| `action` | Function | `src/actions/compareModsAction.ts` | 89 |
| `action` | Function | `src/actions/comparePluginsAction.ts` | 63 |
| `action` | Function | `src/actions/exportModsAction.ts` | 101 |
| `openFolder` | Function | `src/utils/utils.ts` | 9 |
| `createComparePluginsAction` | Function | `src/actions/comparePluginsAction.ts` | 13 |
| `exportPluginsDiffReport` | Function | `src/core/comparePlugins.ts` | 186 |
| `pickTxtFile` | Function | `src/utils/utils.ts` | 412 |
| `getCurrentPluginsTxtPath` | Function | `src/core/comparePlugins.ts` | 157 |
| `BundleResolutionError` | Class | `src/actions/buildPackageAction.ts` | 563 |
| `buildOutputFileName` | Function | `src/actions/buildPackageAction.ts` | 541 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Init → ToPluginMap` | cross_community | 5 |
| `Init → NormalizePluginName` | cross_community | 5 |
| `CreateBuildPackageAction → NormalizeRuleReference` | cross_community | 4 |
| `CreateBuildPackageAction → RulesSortKey` | cross_community | 4 |
| `Init → GetLocalAppDataPath` | cross_community | 4 |
| `CreateBuildPackageAction → ValidateCuratorInput` | intra_community | 3 |
| `CreateBuildPackageAction → NormalizeCollectionIds` | cross_community | 3 |
| `CreateBuildPackageAction → NormalizeFomodSelections` | cross_community | 3 |
| `CreateBuildPackageAction → PickInstallerChoices` | cross_community | 3 |
| `CreateExportModsAction → GetModArchivePath` | cross_community | 3 |

## How to Explore

1. `context({name: "createBuildPackageAction"})` — see callers and callees
2. `query({search_query: "actions"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
