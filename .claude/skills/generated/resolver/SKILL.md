---
name: resolver
description: "Skill for the Resolver area of vortex-mod-monitor. 70 symbols across 17 files."
---

# Resolver

70 symbols | 17 files | Cohesion: 80%

## When to Use

- Working with code in `src/`
- Understanding how openFolder, openFile, pickJsonFile work
- Modifying resolver-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/resolver/resolveInstallPlan.ts` | resolveModResolutions, resolveSingleMod, resolveNexusMod, resolveExternalMod, findInstalledByNexusExact (+21) |
| `src/core/resolver/userState.ts` | buildUserSideState, pickInstallTarget, previousInstallFromReceipt, resolveVortexVersion, resolveGameVersion (+9) |
| `src/actions/installCollectionAction.ts` | createInstallCollectionAction, logPlanSummary, isPlanInstallable, profileExistsInState, resolveStaleReceipt (+1) |
| `src/utils/utils.ts` | openFolder, openFile, pickJsonFile, exportDiffReport, pickTxtFile |
| `src/core/getModsListForProfile.ts` | getActiveGameId, getActiveProfileId, getActiveProfileIdFromState |
| `src/ui/pages/install/engine.ts` | runLoadingPipeline, runLoadingPipelineWithReceipt, profileExistsInState |
| `src/index.ts` | installEventHorizonIconSet, init |
| `src/ui/pages/dashboard/data.ts` | readSystemStatus, formatGameLabel |
| `src/actions/exportModsAction.ts` | createExportModsAction |
| `src/actions/comparePluginsAction.ts` | createComparePluginsAction |

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
| `createInstallCollectionAction` | Function | `src/actions/installCollectionAction.ts` | 107 |
| `createExportModsAction` | Function | `src/actions/exportModsAction.ts` | 15 |
| `createComparePluginsAction` | Function | `src/actions/comparePluginsAction.ts` | 13 |
| `createCompareModsAction` | Function | `src/actions/compareModsAction.ts` | 19 |
| `readReceipt` | Function | `src/core/installLedger.ts` | 336 |
| `getActiveGameId` | Function | `src/core/getModsListForProfile.ts` | 191 |
| `getActiveProfileId` | Function | `src/core/getModsListForProfile.ts` | 196 |
| `getActiveProfileIdFromState` | Function | `src/core/getModsListForProfile.ts` | 206 |
| `exportModsToJsonFile` | Function | `src/core/exportMods.ts` | 6 |
| `exportPluginsDiffReport` | Function | `src/core/comparePlugins.ts` | 186 |
| `enrichModsWithArchiveHashes` | Function | `src/core/archiveHashing.ts` | 133 |
| `buildUserSideState` | Function | `src/core/resolver/userState.ts` | 120 |
| `pickInstallTarget` | Function | `src/core/resolver/userState.ts` | 150 |
| `previousInstallFromReceipt` | Function | `src/core/resolver/userState.ts` | 175 |
| `resolveVortexVersion` | Function | `src/core/resolver/userState.ts` | 197 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ResolveInstallPlan → ExtractExtension` | cross_community | 6 |
| `Begin → NormalizeRuleReference` | cross_community | 5 |
| `Begin → RulesSortKey` | cross_community | 5 |
| `PickFile → ReadEhcollError` | cross_community | 5 |
| `ResolveInstallPlan → ParseSemver` | cross_community | 5 |
| `ResolveInstallPlan → FindInstalledByNexusExact` | cross_community | 5 |
| `ResolveInstallPlan → FindDownloadBySha` | cross_community | 5 |
| `ResolveInstallPlan → FindInstalledByNexusModId` | cross_community | 5 |
| `ResolveInstallPlan → FindInstalledByNexusFileMismatch` | cross_community | 5 |
| `ResolveInstallPlan → FindInstalledBySha` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Actions | 8 calls |
| Manifest | 6 calls |
| Cluster_21 | 6 calls |
| Installer | 4 calls |
| Build | 3 calls |
| Pages | 2 calls |
| Cluster_16 | 1 calls |
| Cluster_18 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "openFolder"})` — see callers and callees
2. `gitnexus_query({query: "resolver"})` — find related execution flows
3. Read key files listed above for implementation details
