---
name: resolver
description: "Skill for the Resolver area of vortex-mod-monitor. 73 symbols across 16 files."
---

# Resolver

73 symbols | 16 files | Cohesion: 76%

## When to Use

- Working with code in `src/`
- Understanding how openFolder, openFile, pickJsonFile work
- Modifying resolver-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/resolver/resolveInstallPlan.ts` | resolveInstallPlan, enforceInstallTargetInvariant, resolveOrphanedMods, resolveExternalDependencies, resolveSingleExternalDependency (+22) |
| `src/core/resolver/userState.ts` | buildUserSideState, pickInstallTarget, previousInstallFromReceipt, resolveVortexVersion, resolveGameVersion (+9) |
| `src/actions/installCollectionAction.ts` | createInstallCollectionAction, logPlanSummary, isPlanInstallable, profileExistsInState, resolveStaleReceipt (+1) |
| `src/utils/utils.ts` | openFolder, openFile, pickJsonFile, exportDiffReport, pickTxtFile |
| `src/core/getModsListForProfile.ts` | getActiveGameId, getActiveProfileId, getActiveProfileIdFromState |
| `src/ui/pages/install/engine.ts` | runLoadingPipeline, runLoadingPipelineWithReceipt, profileExistsInState |
| `src/ui/pages/build/engine.ts` | loadBuildContext, isNexusMod, resolveBundledArchives |
| `src/index.ts` | installEventHorizonIconSet, init |
| `src/core/archiveHashing.ts` | getModArchivePath, enrichModsWithArchiveHashes |
| `src/ui/pages/dashboard/data.ts` | readSystemStatus, formatGameLabel |

## Entry Points

Start here when exploring this area:

- **`openFolder`** (Function) — `src/utils/utils.ts:8`
- **`openFile`** (Function) — `src/utils/utils.ts:11`
- **`pickJsonFile`** (Function) — `src/utils/utils.ts:42`
- **`exportDiffReport`** (Function) — `src/utils/utils.ts:391`
- **`pickTxtFile`** (Function) — `src/utils/utils.ts:410`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `openFolder` | Function | `src/utils/utils.ts` | 8 |
| `openFile` | Function | `src/utils/utils.ts` | 11 |
| `pickJsonFile` | Function | `src/utils/utils.ts` | 42 |
| `exportDiffReport` | Function | `src/utils/utils.ts` | 391 |
| `pickTxtFile` | Function | `src/utils/utils.ts` | 410 |
| `getActiveGameId` | Function | `src/core/getModsListForProfile.ts` | 208 |
| `getActiveProfileId` | Function | `src/core/getModsListForProfile.ts` | 213 |
| `getActiveProfileIdFromState` | Function | `src/core/getModsListForProfile.ts` | 223 |
| `exportModsToJsonFile` | Function | `src/core/exportMods.ts` | 6 |
| `exportPluginsDiffReport` | Function | `src/core/comparePlugins.ts` | 186 |
| `getModArchivePath` | Function | `src/core/archiveHashing.ts` | 79 |
| `enrichModsWithArchiveHashes` | Function | `src/core/archiveHashing.ts` | 141 |
| `createInstallCollectionAction` | Function | `src/actions/installCollectionAction.ts` | 107 |
| `createExportModsAction` | Function | `src/actions/exportModsAction.ts` | 15 |
| `createComparePluginsAction` | Function | `src/actions/comparePluginsAction.ts` | 13 |
| `createCompareModsAction` | Function | `src/actions/compareModsAction.ts` | 19 |
| `buildUserSideState` | Function | `src/core/resolver/userState.ts` | 120 |
| `pickInstallTarget` | Function | `src/core/resolver/userState.ts` | 150 |
| `previousInstallFromReceipt` | Function | `src/core/resolver/userState.ts` | 175 |
| `resolveVortexVersion` | Function | `src/core/resolver/userState.ts` | 197 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `HandleUpdatePublished → GetState` | cross_community | 6 |
| `HandleNewDraft → GetState` | cross_community | 6 |
| `HandleOpenDraft → GetState` | cross_community | 6 |
| `ResolveInstallPlan → ExtractExtension` | cross_community | 6 |
| `OnBuild → GetState` | cross_community | 5 |
| `HandleDiscardDraft → GetState` | cross_community | 5 |
| `Begin → NormalizeRuleReference` | cross_community | 5 |
| `PickFile → ReadEhcollError` | cross_community | 5 |
| `MakeHooks → GetState` | cross_community | 5 |
| `ResolveInstallPlan → ParseSemver` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Manifest | 13 calls |
| Actions | 8 calls |
| Cluster_11 | 6 calls |
| Build | 4 calls |
| Pages | 2 calls |
| Installer | 2 calls |

## How to Explore

1. `gitnexus_context({name: "openFolder"})` — see callers and callees
2. `gitnexus_query({query: "resolver"})` — find related execution flows
3. Read key files listed above for implementation details
