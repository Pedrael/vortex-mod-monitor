---
name: build
description: "Skill for the Build area of vortex-mod-monitor. 48 symbols across 9 files."
---

# Build

48 symbols | 9 files | Cohesion: 72%

## When to Use

- Working with code in `src/`
- Understanding how deleteDraft, getAppDataPath, validateCuratorInput work
- Modifying build-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/build/buildSession.ts` | patchForm, dismissDraftBanner, discardDraft, setValidationError, begin (+9) |
| `src/ui/pages/build/BuildPage.tsx` | handleChange, handleDiscardDraft, handleDismissDraftBanner, onBuild, BuildWizard (+9) |
| `src/ui/pages/build/engine.ts` | validateCuratorInput, BundleResolutionError, runBuildPipeline, checkAbort, resolveVortexVersion (+4) |
| `src/ui/runtime/ehRuntime.ts` | setBuildBusy, setInstallBusy, notify |
| `src/core/deploymentManifest.ts` | collectDistinctModTypes, normalizeManifest, captureDeploymentManifests |
| `src/core/draftStorage.ts` | deleteDraft, getAppDataPath |
| `src/core/loadOrder.ts` | captureLoadOrder |
| `src/core/manifest/collectionConfig.ts` | toBuildManifestExternalMods |
| `src/ui/runtime/nativeNotify.ts` | nativeNotify |

## Entry Points

Start here when exploring this area:

- **`deleteDraft`** (Function) — `src/core/draftStorage.ts:192`
- **`getAppDataPath`** (Function) — `src/core/draftStorage.ts:218`
- **`validateCuratorInput`** (Function) — `src/ui/pages/build/engine.ts:562`
- **`captureLoadOrder`** (Function) — `src/core/loadOrder.ts:40`
- **`collectDistinctModTypes`** (Function) — `src/core/deploymentManifest.ts:53`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BundleResolutionError` | Class | `src/ui/pages/build/engine.ts` | 209 |
| `deleteDraft` | Function | `src/core/draftStorage.ts` | 192 |
| `getAppDataPath` | Function | `src/core/draftStorage.ts` | 218 |
| `validateCuratorInput` | Function | `src/ui/pages/build/engine.ts` | 562 |
| `captureLoadOrder` | Function | `src/core/loadOrder.ts` | 40 |
| `collectDistinctModTypes` | Function | `src/core/deploymentManifest.ts` | 53 |
| `captureDeploymentManifests` | Function | `src/core/deploymentManifest.ts` | 133 |
| `toBuildManifestExternalMods` | Function | `src/core/manifest/collectionConfig.ts` | 249 |
| `runBuildPipeline` | Function | `src/ui/pages/build/engine.ts` | 350 |
| `checkAbort` | Function | `src/ui/pages/build/engine.ts` | 359 |
| `nativeNotify` | Function | `src/ui/runtime/nativeNotify.ts` | 39 |
| `getBuildSession` | Function | `src/ui/pages/build/buildSession.ts` | 513 |
| `BuildSession` | Class | `src/ui/pages/build/buildSession.ts` | 184 |
| `isAbortError` | Function | `src/ui/pages/build/buildSession.ts` | 530 |
| `handleChange` | Function | `src/ui/pages/build/BuildPage.tsx` | 279 |
| `handleDiscardDraft` | Function | `src/ui/pages/build/BuildPage.tsx` | 283 |
| `handleDismissDraftBanner` | Function | `src/ui/pages/build/BuildPage.tsx` | 292 |
| `onBuild` | Function | `src/ui/pages/build/BuildPage.tsx` | 296 |
| `normalizeManifest` | Function | `src/core/deploymentManifest.ts` | 73 |
| `resolveVortexVersion` | Function | `src/ui/pages/build/engine.ts` | 659 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ReceiptDetailModal → Notify` | cross_community | 7 |
| `ApplyGroupRule → Notify` | cross_community | 6 |
| `ApplyGroupDefinition → Notify` | cross_community | 6 |
| `ApplyPluginGroup → Notify` | cross_community | 6 |
| `DecisionsStep → Notify` | cross_community | 5 |
| `OnBuild → EHRuntime` | cross_community | 5 |
| `OnBuild → Notify` | intra_community | 5 |
| `OnBuild → AbortError` | cross_community | 5 |
| `OnBuild → GetCollectionConfigPath` | cross_community | 5 |
| `OnBuild → CreateDefaultConfig` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Manifest | 4 calls |
| Pages | 4 calls |
| Cluster_22 | 3 calls |
| Resolver | 3 calls |
| Actions | 3 calls |
| Installer | 2 calls |
| Cluster_14 | 1 calls |
| Runtime | 1 calls |

## How to Explore

1. `gitnexus_context({name: "deleteDraft"})` — see callers and callees
2. `gitnexus_query({query: "build"})` — find related execution flows
3. Read key files listed above for implementation details
