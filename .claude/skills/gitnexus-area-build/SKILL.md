---
name: gitnexus-area-build
description: "Skill for the Build area of Event-Horizon. 204 symbols across 34 files."
---

# Build

204 symbols | 34 files | Cohesion: 76%

## When to Use

- Working with code in `src/`
- Understanding how deleteDraft, getAppDataPath, getDraftPath work
- Modifying build-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/build/buildSession.ts` | begin, discardDraft, resumeIfDraftExists, onProgress, onProgress (+22) |
| `src/ui/pages/build/BuildPage.tsx` | handle, handleDiscardDraft, handleChange, handleDismissDraftBanner, ExternalModsTable (+21) |
| `src/ui/pages/build/engine.ts` | BundleResolutionError, buildOutputFileName, resolveDeploymentMethod, resolveVortexVersion, runBuildPipeline (+16) |
| `src/ui/pages/build/buildSessionRegistry.ts` | BuildSessionRegistry, getBuildSessionRegistry, ensure, get, makeHooks (+13) |
| `src/ui/pages/build/BuildDashboard.tsx` | handleDiscardDraft, slugsInUse, registry, handleCleanupUnbuilt, handleDeletePublished (+12) |
| `src/core/build/nexusAvailability.ts` | categoryOf, checkNexusAvailability, classifyFile, currentMainFile, fileIdOf (+6) |
| `src/core/draftStorage.ts` | deleteDraft, getAppDataPath, getDraftPath, isPlainObject, loadDraft (+4) |
| `src/core/archiveHashCache.ts` | archiveHashCacheKey, emptyArchiveHashCache, isHex64, loadArchiveHashCache, rememberArchiveHash (+4) |
| `src/core/build/nexusAvailability.test.ts` | entry, f, f, f, entries (+3) |
| `src/ui/pages/build/persistOverrides.ts` | flush, save, writeNow, configWithOverrides, createOverridePersister |

## Entry Points

Start here when exploring this area:

- **`deleteDraft`** (Function) — `src/core/draftStorage.ts:431`
- **`getAppDataPath`** (Function) — `src/core/draftStorage.ts:457`
- **`getDraftPath`** (Function) — `src/core/draftStorage.ts:101`
- **`loadDraft`** (Function) — `src/core/draftStorage.ts:142`
- **`saveDraft`** (Function) — `src/core/draftStorage.ts:399`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BundleResolutionError` | Class | `src/ui/pages/build/engine.ts` | 318 |
| `deleteDraft` | Function | `src/core/draftStorage.ts` | 431 |
| `getAppDataPath` | Function | `src/core/draftStorage.ts` | 457 |
| `getDraftPath` | Function | `src/core/draftStorage.ts` | 101 |
| `loadDraft` | Function | `src/core/draftStorage.ts` | 142 |
| `saveDraft` | Function | `src/core/draftStorage.ts` | 399 |
| `handleDiscardDraft` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 392 |
| `captureDeploymentManifests` | Function | `src/core/deploymentManifest.ts` | 133 |
| `collectDistinctModTypes` | Function | `src/core/deploymentManifest.ts` | 53 |
| `describeExternalDrift` | Function | `src/core/manifest/bundleFromStaging.ts` | 351 |
| `applyDependencyOverrides` | Function | `src/core/manifest/externalDependencies.ts` | 360 |
| `describeUndeclared` | Function | `src/core/manifest/externalHints.ts` | 407 |
| `describeMachineKept` | Function | `src/core/manifest/gameIni.ts` | 251 |
| `slugsInUse` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 285 |
| `runBuildPipeline` | Function | `src/ui/pages/build/engine.ts` | 772 |
| `slugify` | Function | `src/ui/pages/build/engine.ts` | 1827 |
| `setPluginLightFlag` | Function | `src/core/manifest/pluginFlags.ts` | 101 |
| `flush` | Function | `src/ui/pages/build/persistOverrides.ts` | 80 |
| `save` | Function | `src/ui/pages/build/persistOverrides.ts` | 72 |
| `writeNow` | Function | `src/ui/pages/build/persistOverrides.ts` | 58 |

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

1. `context({name: "deleteDraft"})` — see callers and callees
2. `query({search_query: "build"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
