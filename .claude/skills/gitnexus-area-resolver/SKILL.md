---
name: gitnexus-area-resolver
description: "Skill for the Resolver area of vortex-mod-monitor. 64 symbols across 8 files."
---

# Resolver

64 symbols | 8 files | Cohesion: 79%

## When to Use

- Working with code in `src/`
- Understanding how createInstallCollectionAction, enrichModsWithArchiveHashes, getModsForProfile work
- Modifying resolver-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/resolver/resolveInstallPlan.ts` | bundledZipPath, extractExtension, findDownloadBySha, findInstalledByNexusExact, findInstalledByNexusFileMismatch (+22) |
| `src/core/resolver/userState.ts` | buildSuggestedProfileName, buildUserSideState, pickInstallTarget, previousInstallFromReceipt, readDisabledExtensionsMap (+9) |
| `src/core/getModsListForProfile.ts` | assignInstallOrder, getModsForProfile, hasAnySelectedFomodChoices, normalizeCollectionIds, normalizeFomodSelections (+6) |
| `src/actions/installCollectionAction.ts` | createInstallCollectionAction, formatError, isPlanInstallable, logPlanSummary, profileExistsInState (+1) |
| `src/ui/pages/install/engine.ts` | profileExistsInState, runLoadingPipeline, runLoadingPipelineWithReceipt |
| `src/core/archiveHashing.ts` | enrichModsWithArchiveHashes |
| `src/core/installLedger.ts` | readReceipt |
| `src/utils/utils.ts` | pickEhcollFile |

## Entry Points

Start here when exploring this area:

- **`createInstallCollectionAction`** (Function) — `src/actions/installCollectionAction.ts:109`
- **`enrichModsWithArchiveHashes`** (Function) — `src/core/archiveHashing.ts:141`
- **`getModsForProfile`** (Function) — `src/core/getModsListForProfile.ts:500`
- **`readReceipt`** (Function) — `src/core/installLedger.ts:336`
- **`buildUserSideState`** (Function) — `src/core/resolver/userState.ts:120`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createInstallCollectionAction` | Function | `src/actions/installCollectionAction.ts` | 109 |
| `enrichModsWithArchiveHashes` | Function | `src/core/archiveHashing.ts` | 141 |
| `getModsForProfile` | Function | `src/core/getModsListForProfile.ts` | 500 |
| `readReceipt` | Function | `src/core/installLedger.ts` | 336 |
| `buildUserSideState` | Function | `src/core/resolver/userState.ts` | 120 |
| `pickInstallTarget` | Function | `src/core/resolver/userState.ts` | 150 |
| `previousInstallFromReceipt` | Function | `src/core/resolver/userState.ts` | 175 |
| `resolveDeploymentMethod` | Function | `src/core/resolver/userState.ts` | 227 |
| `resolveEnabledExtensions` | Function | `src/core/resolver/userState.ts` | 267 |
| `resolveGameVersion` | Function | `src/core/resolver/userState.ts` | 204 |
| `resolveProfileName` | Function | `src/core/resolver/userState.ts` | 297 |
| `resolveVortexVersion` | Function | `src/core/resolver/userState.ts` | 197 |
| `runLoadingPipeline` | Function | `src/ui/pages/install/engine.ts` | 98 |
| `runLoadingPipelineWithReceipt` | Function | `src/ui/pages/install/engine.ts` | 231 |
| `pickEhcollFile` | Function | `src/utils/utils.ts` | 58 |
| `resolveInstallPlan` | Function | `src/core/resolver/resolveInstallPlan.ts` | 91 |
| `formatError` | Function | `src/actions/installCollectionAction.ts` | 1329 |
| `isPlanInstallable` | Function | `src/actions/installCollectionAction.ts` | 629 |
| `logPlanSummary` | Function | `src/actions/installCollectionAction.ts` | 309 |
| `profileExistsInState` | Function | `src/actions/installCollectionAction.ts` | 996 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ResolveInstallPlan → ExtractExtension` | cross_community | 6 |
| `RouteOutlet → ResolveProfileName` | cross_community | 6 |
| `RouteOutlet → ResolveVortexVersion` | cross_community | 6 |
| `ResolveInstallPlan → ParseSemver` | cross_community | 5 |
| `ResolveInstallPlan → FindDownloadBySha` | cross_community | 5 |
| `ResolveInstallPlan → FindInstalledBySha` | cross_community | 5 |
| `ResolveInstallPlan → FindInstalledByStagingSetHash` | cross_community | 5 |
| `ResolveInstallPlan → FindInstalledByNexusExact` | cross_community | 5 |
| `ResolveInstallPlan → FindInstalledByNexusFileMismatch` | cross_community | 5 |
| `ResolveInstallPlan → FindInstalledByNexusModId` | cross_community | 5 |

## How to Explore

1. `context({name: "createInstallCollectionAction"})` — see callers and callees
2. `query({search_query: "resolver"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
