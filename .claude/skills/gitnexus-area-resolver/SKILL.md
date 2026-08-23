---
name: gitnexus-area-resolver
description: "Skill for the Resolver area of vortex-mod-monitor. 75 symbols across 13 files."
---

# Resolver

75 symbols | 13 files | Cohesion: 83%

## When to Use

- Working with code in `src/`
- Understanding how createCompareModsAction, createExportModsAction, createInstallCollectionAction work
- Modifying resolver-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/resolver/resolveInstallPlan.ts` | bundledZipPath, extractExtension, findDownloadBySha, findInstalledByNexusExact, findInstalledByNexusFileMismatch (+22) |
| `src/core/getModsListForProfile.ts` | assignInstallOrder, getActiveGameId, getActiveProfileId, getActiveProfileIdFromState, getModsForProfile (+9) |
| `src/core/resolver/userState.ts` | buildSuggestedProfileName, buildUserSideState, pickInstallTarget, previousInstallFromReceipt, readDisabledExtensionsMap (+9) |
| `src/actions/installCollectionAction.ts` | createInstallCollectionAction, formatError, isPlanInstallable, logPlanSummary, profileExistsInState (+1) |
| `src/ui/pages/install/engine.ts` | profileExistsInState, runLoadingPipeline, runLoadingPipelineWithReceipt |
| `src/utils/utils.ts` | exportDiffReport, pickEhcollFile, pickJsonFile |
| `src/ui/pages/dashboard/data.ts` | formatGameLabel, readSystemStatus |
| `src/actions/compareModsAction.ts` | createCompareModsAction |
| `src/actions/exportModsAction.ts` | createExportModsAction |
| `src/core/archiveHashing.ts` | enrichModsWithArchiveHashes |

## Entry Points

Start here when exploring this area:

- **`createCompareModsAction`** (Function) — `src/actions/compareModsAction.ts:19`
- **`createExportModsAction`** (Function) — `src/actions/exportModsAction.ts:15`
- **`createInstallCollectionAction`** (Function) — `src/actions/installCollectionAction.ts:107`
- **`enrichModsWithArchiveHashes`** (Function) — `src/core/archiveHashing.ts:141`
- **`exportModsToJsonFile`** (Function) — `src/core/exportMods.ts:7`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createCompareModsAction` | Function | `src/actions/compareModsAction.ts` | 19 |
| `createExportModsAction` | Function | `src/actions/exportModsAction.ts` | 15 |
| `createInstallCollectionAction` | Function | `src/actions/installCollectionAction.ts` | 107 |
| `enrichModsWithArchiveHashes` | Function | `src/core/archiveHashing.ts` | 141 |
| `exportModsToJsonFile` | Function | `src/core/exportMods.ts` | 7 |
| `getActiveGameId` | Function | `src/core/getModsListForProfile.ts` | 208 |
| `getActiveProfileId` | Function | `src/core/getModsListForProfile.ts` | 213 |
| `getActiveProfileIdFromState` | Function | `src/core/getModsListForProfile.ts` | 223 |
| `getModsForProfile` | Function | `src/core/getModsListForProfile.ts` | 465 |
| `readReceipt` | Function | `src/core/installLedger.ts` | 336 |
| `buildUserSideState` | Function | `src/core/resolver/userState.ts` | 120 |
| `pickInstallTarget` | Function | `src/core/resolver/userState.ts` | 150 |
| `previousInstallFromReceipt` | Function | `src/core/resolver/userState.ts` | 175 |
| `resolveDeploymentMethod` | Function | `src/core/resolver/userState.ts` | 227 |
| `resolveEnabledExtensions` | Function | `src/core/resolver/userState.ts` | 267 |
| `resolveGameVersion` | Function | `src/core/resolver/userState.ts` | 204 |
| `resolveProfileName` | Function | `src/core/resolver/userState.ts` | 297 |
| `resolveVortexVersion` | Function | `src/core/resolver/userState.ts` | 197 |
| `loadBuildContext` | Function | `src/ui/pages/build/engine.ts` | 236 |
| `readSystemStatus` | Function | `src/ui/pages/dashboard/data.ts` | 132 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ResolveInstallPlan → ExtractExtension` | cross_community | 6 |
| `RouteOutlet → GetActiveGameId` | cross_community | 6 |
| `RouteOutlet → GetActiveProfileIdFromState` | cross_community | 6 |
| `RouteOutlet → ResolveProfileName` | cross_community | 6 |
| `RouteOutlet → ResolveVortexVersion` | cross_community | 6 |
| `ResolveInstallPlan → ParseSemver` | cross_community | 5 |
| `ResolveInstallPlan → FindDownloadBySha` | cross_community | 5 |
| `ResolveInstallPlan → FindInstalledBySha` | cross_community | 5 |
| `ResolveInstallPlan → FindInstalledByStagingSetHash` | cross_community | 5 |
| `ResolveInstallPlan → FindInstalledByNexusExact` | cross_community | 5 |

## How to Explore

1. `context({name: "createCompareModsAction"})` — see callers and callees
2. `query({search_query: "resolver"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
