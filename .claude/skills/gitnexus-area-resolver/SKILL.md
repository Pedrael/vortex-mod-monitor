---
name: gitnexus-area-resolver
description: "Skill for the Resolver area of Event-Horizon. 65 symbols across 8 files."
---

# Resolver

65 symbols | 8 files | Cohesion: 80%

## When to Use

- Working with code in `src/`
- Understanding how createInstallCollectionAction, downloadsDirFor, scanAvailableDownloads work
- Modifying resolver-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/resolver/resolveInstallPlan.ts` | bundledZipPath, extractExtension, findDownloadBySha, findInstalledByNexusExact, findInstalledByNexusFileMismatch (+23) |
| `src/core/resolver/userState.ts` | buildSuggestedProfileName, buildUserSideState, pickInstallTarget, previousInstallFromReceipt, readDisabledExtensionsMap (+9) |
| `src/actions/installCollectionAction.ts` | createInstallCollectionAction, formatError, isPlanInstallable, logPlanSummary, profileExistsInState (+1) |
| `src/ui/pages/install/engine.ts` | profileExistsInState, runLoadingPipeline, checkAbort, runLoadingPipelineWithReceipt, checkAbort (+1) |
| `src/core/resolver/collectAvailableDownloads.test.ts` | action, engine, pipelines, read |
| `src/core/resolver/gameVersionGuidance.ts` | compareVersions, parse, describe, gameVersionGuidance |
| `src/core/resolver/scanAvailableDownloads.ts` | downloadsDirFor, scanAvailableDownloads |
| `src/utils/utils.ts` | pickEhcollFile |

## Entry Points

Start here when exploring this area:

- **`createInstallCollectionAction`** (Function) — `src/actions/installCollectionAction.ts:111`
- **`downloadsDirFor`** (Function) — `src/core/resolver/scanAvailableDownloads.ts:40`
- **`scanAvailableDownloads`** (Function) — `src/core/resolver/scanAvailableDownloads.ts:57`
- **`buildUserSideState`** (Function) — `src/core/resolver/userState.ts:120`
- **`pickInstallTarget`** (Function) — `src/core/resolver/userState.ts:150`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createInstallCollectionAction` | Function | `src/actions/installCollectionAction.ts` | 111 |
| `downloadsDirFor` | Function | `src/core/resolver/scanAvailableDownloads.ts` | 40 |
| `scanAvailableDownloads` | Function | `src/core/resolver/scanAvailableDownloads.ts` | 57 |
| `buildUserSideState` | Function | `src/core/resolver/userState.ts` | 120 |
| `pickInstallTarget` | Function | `src/core/resolver/userState.ts` | 150 |
| `previousInstallFromReceipt` | Function | `src/core/resolver/userState.ts` | 175 |
| `resolveDeploymentMethod` | Function | `src/core/resolver/userState.ts` | 227 |
| `resolveEnabledExtensions` | Function | `src/core/resolver/userState.ts` | 267 |
| `resolveGameVersion` | Function | `src/core/resolver/userState.ts` | 204 |
| `resolveProfileName` | Function | `src/core/resolver/userState.ts` | 297 |
| `resolveVortexVersion` | Function | `src/core/resolver/userState.ts` | 197 |
| `runLoadingPipeline` | Function | `src/ui/pages/install/engine.ts` | 116 |
| `checkAbort` | Function | `src/ui/pages/install/engine.ts` | 123 |
| `runLoadingPipelineWithReceipt` | Function | `src/ui/pages/install/engine.ts` | 295 |
| `checkAbort` | Function | `src/ui/pages/install/engine.ts` | 316 |
| `warnIfSevenZipBroken` | Function | `src/ui/pages/install/engine.ts` | 437 |
| `pickEhcollFile` | Function | `src/utils/utils.ts` | 98 |
| `resolveCompatibility` | Function | `src/core/resolver/resolveInstallPlan.ts` | 175 |
| `resolveInstallPlan` | Function | `src/core/resolver/resolveInstallPlan.ts` | 92 |
| `compareVersions` | Function | `src/core/resolver/gameVersionGuidance.ts` | 167 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RunLoadingPipeline → ZipReadError` | cross_community | 8 |
| `RouteOutlet → ResolveProfileName` | cross_community | 6 |
| `RouteOutlet → ResolveVortexVersion` | cross_community | 6 |
| `RunLoadingPipeline → FindZip64Extra` | cross_community | 6 |
| `RunLoadingPipelineWithReceipt → NormalizeRuleReference` | cross_community | 4 |
| `RunLoadingPipelineWithReceipt → RulesSortKey` | cross_community | 4 |
| `RunLoadingPipeline → IsDirectoryEntry` | cross_community | 4 |
| `RunLoadingPipeline → NormalizePath` | cross_community | 4 |
| `RunLoadingPipeline → ReadEhcollError` | cross_community | 4 |
| `RunLoadingPipelineWithReceipt → BelongsToGame` | cross_community | 3 |

## How to Explore

1. `context({name: "createInstallCollectionAction"})` — see callers and callees
2. `query({search_query: "resolver"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
