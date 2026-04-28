---
name: build
description: "Skill for the Build area of vortex-mod-monitor. 75 symbols across 10 files."
---

# Build

75 symbols | 10 files | Cohesion: 68%

## When to Use

- Working with code in `src/`
- Understanding how validateCuratorInput, captureLoadOrder, collectDistinctModTypes work
- Modifying build-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/build/buildSession.ts` | enqueueBuild, releaseBuild, notifyStateChanged, patchForm, dismissDraftBanner (+14) |
| `src/ui/pages/build/BuildPage.tsx` | handleChange, handleDismissDraftBanner, onBuild, handleDiscardDraft, BuildWizard (+9) |
| `src/ui/pages/build/buildSessionRegistry.ts` | list, BuildSessionRegistry, getBuildSessionRegistry, acquireSlot, enqueueBuild (+6) |
| `src/ui/pages/build/BuildDashboard.tsx` | BuildDashboard, handleDiscardDraft, handleUpdatePublished, DraftsRootHint, bumpPatch (+5) |
| `src/ui/pages/build/engine.ts` | validateCuratorInput, BundleResolutionError, runBuildPipeline, checkAbort, resolveVortexVersion (+4) |
| `src/core/draftStorage.ts` | getDraftsRoot, listDrafts, saveDraft, deleteDraft, getAppDataPath |
| `src/core/deploymentManifest.ts` | collectDistinctModTypes, normalizeManifest, captureDeploymentManifests |
| `src/core/manifest/collectionConfig.ts` | reconcileExternalModsConfig, toBuildManifestExternalMods |
| `src/core/loadOrder.ts` | captureLoadOrder |
| `src/ui/runtime/nativeNotify.ts` | nativeNotify |

## Entry Points

Start here when exploring this area:

- **`validateCuratorInput`** (Function) — `src/ui/pages/build/engine.ts:593`
- **`captureLoadOrder`** (Function) — `src/core/loadOrder.ts:40`
- **`collectDistinctModTypes`** (Function) — `src/core/deploymentManifest.ts:53`
- **`captureDeploymentManifests`** (Function) — `src/core/deploymentManifest.ts:133`
- **`reconcileExternalModsConfig`** (Function) — `src/core/manifest/collectionConfig.ts:240`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BundleResolutionError` | Class | `src/ui/pages/build/engine.ts` | 209 |
| `validateCuratorInput` | Function | `src/ui/pages/build/engine.ts` | 593 |
| `captureLoadOrder` | Function | `src/core/loadOrder.ts` | 40 |
| `collectDistinctModTypes` | Function | `src/core/deploymentManifest.ts` | 53 |
| `captureDeploymentManifests` | Function | `src/core/deploymentManifest.ts` | 133 |
| `reconcileExternalModsConfig` | Function | `src/core/manifest/collectionConfig.ts` | 240 |
| `toBuildManifestExternalMods` | Function | `src/core/manifest/collectionConfig.ts` | 281 |
| `runBuildPipeline` | Function | `src/ui/pages/build/engine.ts` | 350 |
| `checkAbort` | Function | `src/ui/pages/build/engine.ts` | 359 |
| `getDraftsRoot` | Function | `src/core/draftStorage.ts` | 121 |
| `listDrafts` | Function | `src/core/draftStorage.ts` | 162 |
| `saveDraft` | Function | `src/core/draftStorage.ts` | 399 |
| `deleteDraft` | Function | `src/core/draftStorage.ts` | 431 |
| `getAppDataPath` | Function | `src/core/draftStorage.ts` | 457 |
| `BuildDashboard` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 87 |
| `handleDiscardDraft` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 194 |
| `handleUpdatePublished` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 233 |
| `nativeNotify` | Function | `src/ui/runtime/nativeNotify.ts` | 39 |
| `getBuildSessionRegistry` | Function | `src/ui/pages/build/buildSessionRegistry.ts` | 292 |
| `handleNewDraft` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 163 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `HandleUpdatePublished → EHRuntime` | cross_community | 7 |
| `HandleNewDraft → EHRuntime` | cross_community | 7 |
| `HandleNewDraft → Notify` | cross_community | 7 |
| `HandleOpenDraft → EHRuntime` | cross_community | 7 |
| `HandleOpenDraft → Notify` | cross_community | 7 |
| `HandleUpdatePublished → Notify` | cross_community | 6 |
| `HandleUpdatePublished → GetState` | cross_community | 6 |
| `OnBuild → AbortError` | cross_community | 6 |
| `OnBuild → GetCollectionConfigPath` | cross_community | 6 |
| `OnBuild → CreateDefaultConfig` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Manifest | 7 calls |
| Resolver | 7 calls |
| Pages | 6 calls |
| Cluster_12 | 5 calls |
| Runtime | 5 calls |
| Actions | 4 calls |
| Cluster_8 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "validateCuratorInput"})` — see callers and callees
2. `gitnexus_query({query: "build"})` — find related execution flows
3. Read key files listed above for implementation details
