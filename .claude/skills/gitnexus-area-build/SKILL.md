---
name: gitnexus-area-build
description: "Skill for the Build area of Event-Horizon. 252 symbols across 50 files."
---

# Build

252 symbols | 50 files | Cohesion: 72%

## When to Use

- Working with code in `src/`
- Understanding how describeExternalDrift, applyDependencyOverrides, countBy work
- Modifying build-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/build/BuildPage.tsx` | handleChange, handleDismissDraftBanner, BuildWizard, GameMismatchBanner, Header (+32) |
| `src/ui/pages/build/buildSession.ts` | onProgress, onProgress, onProgress, onProgress, _updateQueuePosition (+27) |
| `src/ui/pages/build/engine.ts` | BundleResolutionError, applyPostProcessedDeclarations, buildOutputFileName, declarationsFor, resolveDeploymentMethod (+20) |
| `src/ui/pages/build/buildSessionRegistry.ts` | BuildSessionRegistry, getBuildSessionRegistry, ensure, get, makeHooks (+13) |
| `src/ui/pages/build/BuildDashboard.tsx` | slugsInUse, registry, handleDiscardDraft, handleCleanupUnbuilt, handleDeletePublished (+12) |
| `src/core/build/nexusAvailability.ts` | categoryOf, checkNexusAvailability, classifyFile, currentMainFile, fileIdOf (+6) |
| `src/core/archiveHashCache.ts` | archiveHashCacheKey, emptyArchiveHashCache, isHex64, loadArchiveHashCache, rememberArchiveHash (+4) |
| `src/core/draftStorage.ts` | getDraftPath, isPlainObject, loadDraft, migrateV1Payload, readDraftFile (+4) |
| `src/core/build/nexusAvailability.test.ts` | entry, f, f, f, entries (+3) |
| `src/ui/pages/build/persistOverrides.ts` | flush, save, writeNow, configWithOverrides, createOverridePersister |

## Entry Points

Start here when exploring this area:

- **`describeExternalDrift`** (Function) — `src/core/manifest/bundleFromStaging.ts:357`
- **`applyDependencyOverrides`** (Function) — `src/core/manifest/externalDependencies.ts:505`
- **`countBy`** (Function) — `src/core/manifest/externalHints.ts:323`
- **`describeUndeclared`** (Function) — `src/core/manifest/externalHints.ts:407`
- **`modsFromState`** (Function) — `src/core/manifest/externalHints.ts:256`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BundleResolutionError` | Class | `src/ui/pages/build/engine.ts` | 491 |
| `describeExternalDrift` | Function | `src/core/manifest/bundleFromStaging.ts` | 357 |
| `applyDependencyOverrides` | Function | `src/core/manifest/externalDependencies.ts` | 505 |
| `countBy` | Function | `src/core/manifest/externalHints.ts` | 323 |
| `describeUndeclared` | Function | `src/core/manifest/externalHints.ts` | 407 |
| `modsFromState` | Function | `src/core/manifest/externalHints.ts` | 256 |
| `describeMachineKept` | Function | `src/core/manifest/gameIni.ts` | 251 |
| `slugsInUse` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 293 |
| `applyPostProcessedDeclarations` | Function | `src/ui/pages/build/engine.ts` | 450 |
| `runBuildPipeline` | Function | `src/ui/pages/build/engine.ts` | 989 |
| `checkAbort` | Function | `src/ui/pages/build/engine.ts` | 1004 |
| `slugify` | Function | `src/ui/pages/build/engine.ts` | 2063 |
| `setPluginLightFlag` | Function | `src/core/manifest/pluginFlags.ts` | 101 |
| `flush` | Function | `src/ui/pages/build/persistOverrides.ts` | 80 |
| `save` | Function | `src/ui/pages/build/persistOverrides.ts` | 72 |
| `writeNow` | Function | `src/ui/pages/build/persistOverrides.ts` | 58 |
| `StepDots` | Function | `src/ui/components/StepDots.tsx` | 31 |
| `overrideForChoice` | Function | `src/ui/pages/build/postProcessingDecision.ts` | 59 |
| `ConcurrentOpBanner` | Function | `src/ui/runtime/ConcurrentOpBanner.tsx` | 17 |
| `nativeNotify` | Function | `src/ui/runtime/nativeNotify.ts` | 39 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `PublishedDetailsPanel → ZipReadError` | cross_community | 9 |
| `BuildWizard → GetVortexUserDataPath` | cross_community | 8 |
| `PublishedDetailsPanel → FindZip64Extra` | cross_community | 7 |
| `LoadPublishedDetails → ZipReadError` | cross_community | 7 |
| `BuildPage → NotifyStateChanged` | cross_community | 6 |
| `Heal → EHRuntime` | cross_community | 6 |
| `PublishedDetailsPanel → GetVortexUserDataPath` | cross_community | 6 |
| `PublishedDetailsPanel → ReadEhcollError` | cross_community | 5 |
| `BuildPage → IsPlainObject` | cross_community | 5 |
| `BuildPage → MigrateV1Payload` | cross_community | 5 |

## How to Explore

1. `context({name: "describeExternalDrift"})` — see callers and callees
2. `query({search_query: "build"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
