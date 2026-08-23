---
name: gitnexus-area-actions
description: "Skill for the Actions area of vortex-mod-monitor. 94 symbols across 15 files."
---

# Actions

94 symbols | 15 files | Cohesion: 81%

## When to Use

- Working with code in `src/`
- Understanding how createExportMo2InstanceAction, isMo2SupportedGameId, createBuildPackageAction work
- Modifying actions-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/actions/installCollectionAction.ts` | collectUserDecisions, formatDivergedConflictText, formatOrphanText, formatPromptUserText, pickConflictChoice (+24) |
| `src/actions/exportMo2InstanceAction.ts` | NonTransitiveConflictError, createExportMo2InstanceAction, formatError, resolveDeploymentMethod, resolveDiscoveredGameInstallPath (+13) |
| `src/actions/buildPackageAction.ts` | BundleResolutionError, buildOutputFileName, createBuildPackageAction, formatBytes, formatError (+13) |
| `src/core/comparePlugins.ts` | comparePluginsEntries, comparePluginsTxtFiles, normalizePluginName, parsePluginsTxt, toPluginMap (+3) |
| `src/utils/utils.ts` | pickModArchiveFile, openFile, openFolder, pickTxtFile |
| `src/actions/comparePluginsAction.ts` | action, action, createComparePluginsAction |
| `src/ui/pages/build/engine.ts` | isNexusMod, resolveBundledArchives, readPluginsTxtIfPresent |
| `src/actions/compareModsAction.ts` | action, action |
| `src/actions/exportModsAction.ts` | action, action |
| `src/index.ts` | init, installEventHorizonIconSet |

## Entry Points

Start here when exploring this area:

- **`createExportMo2InstanceAction`** (Function) — `src/actions/exportMo2InstanceAction.ts:79`
- **`isMo2SupportedGameId`** (Function) — `src/core/mo2/mo2Layout.ts:47`
- **`createBuildPackageAction`** (Function) — `src/actions/buildPackageAction.ts:107`
- **`pickModArchiveFile`** (Function) — `src/utils/utils.ts:87`
- **`action`** (Function) — `src/actions/buildPackageAction.ts:305`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `NonTransitiveConflictError` | Class | `src/actions/exportMo2InstanceAction.ts` | 408 |
| `createExportMo2InstanceAction` | Function | `src/actions/exportMo2InstanceAction.ts` | 79 |
| `isMo2SupportedGameId` | Function | `src/core/mo2/mo2Layout.ts` | 47 |
| `createBuildPackageAction` | Function | `src/actions/buildPackageAction.ts` | 107 |
| `pickModArchiveFile` | Function | `src/utils/utils.ts` | 87 |
| `action` | Function | `src/actions/buildPackageAction.ts` | 305 |
| `action` | Function | `src/actions/buildPackageAction.ts` | 313 |
| `action` | Function | `src/actions/compareModsAction.ts` | 83 |
| `action` | Function | `src/actions/comparePluginsAction.ts` | 57 |
| `action` | Function | `src/actions/exportMo2InstanceAction.ts` | 347 |
| `action` | Function | `src/actions/exportMo2InstanceAction.ts` | 371 |
| `action` | Function | `src/actions/exportModsAction.ts` | 97 |
| `openFile` | Function | `src/utils/utils.ts` | 12 |
| `action` | Function | `src/actions/buildPackageAction.ts` | 309 |
| `action` | Function | `src/actions/compareModsAction.ts` | 89 |
| `action` | Function | `src/actions/comparePluginsAction.ts` | 63 |
| `action` | Function | `src/actions/exportMo2InstanceAction.ts` | 343 |
| `action` | Function | `src/actions/exportMo2InstanceAction.ts` | 375 |
| `action` | Function | `src/actions/exportModsAction.ts` | 101 |
| `openFolder` | Function | `src/utils/utils.ts` | 9 |

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

1. `context({name: "createExportMo2InstanceAction"})` — see callers and callees
2. `query({search_query: "actions"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
