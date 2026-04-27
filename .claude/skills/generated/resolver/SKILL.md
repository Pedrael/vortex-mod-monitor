---
name: resolver
description: "Skill for the Resolver area of vortex-mod-monitor. 62 symbols across 13 files."
---

# Resolver

62 symbols | 13 files | Cohesion: 78%

## When to Use

- Working with code in `src/`
- Understanding how readReceipt, getActiveGameId, getActiveProfileId work
- Modifying resolver-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/resolver/resolveInstallPlan.ts` | resolveModResolutions, resolveSingleMod, resolveNexusMod, resolveExternalMod, findInstalledByNexusExact (+21) |
| `src/core/resolver/userState.ts` | buildUserSideState, pickInstallTarget, previousInstallFromReceipt, resolveVortexVersion, resolveGameVersion (+9) |
| `src/actions/installCollectionAction.ts` | createInstallCollectionAction, logPlanSummary, isPlanInstallable, profileExistsInState, resolveStaleReceipt (+1) |
| `src/core/getModsListForProfile.ts` | getActiveGameId, getActiveProfileId, getActiveProfileIdFromState |
| `src/ui/pages/install/engine.ts` | runLoadingPipeline, runLoadingPipelineWithReceipt, profileExistsInState |
| `src/index.ts` | installEventHorizonIconSet, init |
| `src/ui/pages/dashboard/data.ts` | readSystemStatus, formatGameLabel |
| `src/core/installLedger.ts` | readReceipt |
| `src/core/exportMods.ts` | exportModsToJsonFile |
| `src/core/archiveHashing.ts` | enrichModsWithArchiveHashes |

## Entry Points

Start here when exploring this area:

- **`readReceipt`** (Function) — `src/core/installLedger.ts:270`
- **`getActiveGameId`** (Function) — `src/core/getModsListForProfile.ts:166`
- **`getActiveProfileId`** (Function) — `src/core/getModsListForProfile.ts:171`
- **`getActiveProfileIdFromState`** (Function) — `src/core/getModsListForProfile.ts:181`
- **`exportModsToJsonFile`** (Function) — `src/core/exportMods.ts:6`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `readReceipt` | Function | `src/core/installLedger.ts` | 270 |
| `getActiveGameId` | Function | `src/core/getModsListForProfile.ts` | 166 |
| `getActiveProfileId` | Function | `src/core/getModsListForProfile.ts` | 171 |
| `getActiveProfileIdFromState` | Function | `src/core/getModsListForProfile.ts` | 181 |
| `exportModsToJsonFile` | Function | `src/core/exportMods.ts` | 6 |
| `enrichModsWithArchiveHashes` | Function | `src/core/archiveHashing.ts` | 176 |
| `createInstallCollectionAction` | Function | `src/actions/installCollectionAction.ts` | 107 |
| `createExportModsAction` | Function | `src/actions/exportModsAction.ts` | 15 |
| `buildUserSideState` | Function | `src/core/resolver/userState.ts` | 120 |
| `pickInstallTarget` | Function | `src/core/resolver/userState.ts` | 150 |
| `previousInstallFromReceipt` | Function | `src/core/resolver/userState.ts` | 175 |
| `resolveVortexVersion` | Function | `src/core/resolver/userState.ts` | 197 |
| `resolveGameVersion` | Function | `src/core/resolver/userState.ts` | 204 |
| `resolveDeploymentMethod` | Function | `src/core/resolver/userState.ts` | 227 |
| `resolveEnabledExtensions` | Function | `src/core/resolver/userState.ts` | 267 |
| `resolveProfileName` | Function | `src/core/resolver/userState.ts` | 297 |
| `runLoadingPipeline` | Function | `src/ui/pages/install/engine.ts` | 96 |
| `runLoadingPipelineWithReceipt` | Function | `src/ui/pages/install/engine.ts` | 210 |
| `readSystemStatus` | Function | `src/ui/pages/dashboard/data.ts` | 132 |
| `loadBuildContext` | Function | `src/ui/pages/build/engine.ts` | 210 |

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
| Actions | 10 calls |
| Manifest | 5 calls |
| Cluster_16 | 5 calls |
| Build | 4 calls |
| Installer | 3 calls |
| Pages | 2 calls |
| Errors | 1 calls |
| Cluster_13 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "readReceipt"})` — see callers and callees
2. `gitnexus_query({query: "resolver"})` — find related execution flows
3. Read key files listed above for implementation details
