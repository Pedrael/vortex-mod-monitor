---
name: resolver
description: "Skill for the Resolver area of vortex-mod-monitor. 60 symbols across 11 files."
---

# Resolver

60 symbols | 11 files | Cohesion: 79%

## When to Use

- Working with code in `src/`
- Understanding how createInstallCollectionAction, createExportModsAction, getActiveGameId work
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
| `src/actions/exportModsAction.ts` | createExportModsAction |
| `src/core/exportMods.ts` | exportModsToJsonFile |
| `src/core/archiveHashing.ts` | enrichModsWithArchiveHashes |

## Entry Points

Start here when exploring this area:

- **`createInstallCollectionAction`** (Function) — `src/actions/installCollectionAction.ts:107`
- **`createExportModsAction`** (Function) — `src/actions/exportModsAction.ts:15`
- **`getActiveGameId`** (Function) — `src/core/getModsListForProfile.ts:166`
- **`getActiveProfileId`** (Function) — `src/core/getModsListForProfile.ts:171`
- **`getActiveProfileIdFromState`** (Function) — `src/core/getModsListForProfile.ts:181`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createInstallCollectionAction` | Function | `src/actions/installCollectionAction.ts` | 107 |
| `createExportModsAction` | Function | `src/actions/exportModsAction.ts` | 15 |
| `getActiveGameId` | Function | `src/core/getModsListForProfile.ts` | 166 |
| `getActiveProfileId` | Function | `src/core/getModsListForProfile.ts` | 171 |
| `getActiveProfileIdFromState` | Function | `src/core/getModsListForProfile.ts` | 181 |
| `exportModsToJsonFile` | Function | `src/core/exportMods.ts` | 6 |
| `enrichModsWithArchiveHashes` | Function | `src/core/archiveHashing.ts` | 175 |
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
| `loadBuildContext` | Function | `src/ui/pages/build/engine.ts` | 191 |
| `resolveInstallPlan` | Function | `src/core/resolver/resolveInstallPlan.ts` | 91 |

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
| Installer | 9 calls |
| Manifest | 7 calls |
| Cluster_20 | 5 calls |
| Build | 4 calls |
| Pages | 2 calls |

## How to Explore

1. `gitnexus_context({name: "createInstallCollectionAction"})` — see callers and callees
2. `gitnexus_query({query: "resolver"})` — find related execution flows
3. Read key files listed above for implementation details
