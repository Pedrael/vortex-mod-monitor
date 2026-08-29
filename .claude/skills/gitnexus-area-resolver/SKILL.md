---
name: gitnexus-area-resolver
description: "Skill for the Resolver area of vortex-mod-monitor. 69 symbols across 11 files."
---

# Resolver

69 symbols | 11 files | Cohesion: 76%

## When to Use

- Working with code in `src/`
- Understanding how createInstallCollectionAction, enrichModsWithArchiveHashes, buildUserSideState work
- Modifying resolver-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/resolver/resolveInstallPlan.ts` | bundledZipPath, extractExtension, findDownloadBySha, findInstalledByNexusExact, findInstalledByNexusFileMismatch (+23) |
| `src/core/resolver/userState.ts` | buildSuggestedProfileName, buildUserSideState, pickInstallTarget, previousInstallFromReceipt, readDisabledExtensionsMap (+9) |
| `src/actions/installCollectionAction.ts` | createInstallCollectionAction, formatError, isPlanInstallable, logPlanSummary, profileExistsInState (+1) |
| `src/ui/pages/install/engine.ts` | downloadsDirFor, profileExistsInState, runLoadingPipeline, runLoadingPipelineWithReceipt, scanAvailableDownloads (+1) |
| `src/core/resolver/gameVersionGuidance.ts` | compareVersions, parse, describe, gameVersionGuidance |
| `src/core/archiveHashing.ts` | enrichModsWithArchiveHashes, hashFileSha256, cleanup |
| `src/core/resolver/collectAvailableDownloads.ts` | belongsToGame, collectAvailableDownloads, readDownloadFiles |
| `test/e2e/installDriver.e2e.test.ts` | install, userState |
| `src/utils/utils.ts` | pickEhcollFile |
| `src/core/archiveHashCache.ts` | archiveFileCacheKey |

## Entry Points

Start here when exploring this area:

- **`createInstallCollectionAction`** (Function) — `src/actions/installCollectionAction.ts:109`
- **`enrichModsWithArchiveHashes`** (Function) — `src/core/archiveHashing.ts:153`
- **`buildUserSideState`** (Function) — `src/core/resolver/userState.ts:120`
- **`pickInstallTarget`** (Function) — `src/core/resolver/userState.ts:150`
- **`previousInstallFromReceipt`** (Function) — `src/core/resolver/userState.ts:175`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createInstallCollectionAction` | Function | `src/actions/installCollectionAction.ts` | 109 |
| `enrichModsWithArchiveHashes` | Function | `src/core/archiveHashing.ts` | 153 |
| `buildUserSideState` | Function | `src/core/resolver/userState.ts` | 120 |
| `pickInstallTarget` | Function | `src/core/resolver/userState.ts` | 150 |
| `previousInstallFromReceipt` | Function | `src/core/resolver/userState.ts` | 175 |
| `resolveDeploymentMethod` | Function | `src/core/resolver/userState.ts` | 227 |
| `resolveEnabledExtensions` | Function | `src/core/resolver/userState.ts` | 267 |
| `resolveGameVersion` | Function | `src/core/resolver/userState.ts` | 204 |
| `resolveProfileName` | Function | `src/core/resolver/userState.ts` | 297 |
| `resolveVortexVersion` | Function | `src/core/resolver/userState.ts` | 197 |
| `runLoadingPipeline` | Function | `src/ui/pages/install/engine.ts` | 99 |
| `runLoadingPipelineWithReceipt` | Function | `src/ui/pages/install/engine.ts` | 258 |
| `warnIfSevenZipBroken` | Function | `src/ui/pages/install/engine.ts` | 462 |
| `pickEhcollFile` | Function | `src/utils/utils.ts` | 98 |
| `resolveInstallPlan` | Function | `src/core/resolver/resolveInstallPlan.ts` | 92 |
| `resolveCompatibility` | Function | `src/core/resolver/resolveInstallPlan.ts` | 175 |
| `archiveFileCacheKey` | Function | `src/core/archiveHashCache.ts` | 73 |
| `hashFileSha256` | Function | `src/core/archiveHashing.ts` | 38 |
| `cleanup` | Function | `src/core/archiveHashing.ts` | 58 |
| `checkArchiveIdentity` | Function | `src/core/installer/checkArchiveIdentity.ts` | 59 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RunLoadingPipeline → ZipReadError` | cross_community | 8 |
| `RouteOutlet → ResolveProfileName` | cross_community | 6 |
| `RouteOutlet → ResolveVortexVersion` | cross_community | 6 |
| `RunLoadingPipeline → FindZip64Extra` | cross_community | 6 |
| `ExecutePromptUserChoice → Cleanup` | cross_community | 4 |
| `RunLoadingPipelineWithReceipt → NormalizeRuleReference` | cross_community | 4 |
| `RunLoadingPipelineWithReceipt → RulesSortKey` | cross_community | 4 |
| `RunLoadingPipeline → IsDirectoryEntry` | cross_community | 4 |
| `RunLoadingPipeline → NormalizePath` | cross_community | 4 |
| `ExecutePromptUserChoice → AbortError` | cross_community | 4 |

## How to Explore

1. `context({name: "createInstallCollectionAction"})` — see callers and callees
2. `query({search_query: "resolver"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
