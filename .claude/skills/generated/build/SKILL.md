---
name: build
description: "Skill for the Build area of vortex-mod-monitor. 45 symbols across 8 files."
---

# Build

45 symbols | 8 files | Cohesion: 71%

## When to Use

- Working with code in `src/`
- Understanding how deleteDraft, getAppDataPath, validateCuratorInput work
- Modifying build-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/build/buildSession.ts` | patchForm, dismissDraftBanner, discardDraft, setValidationError, begin (+9) |
| `src/ui/pages/build/BuildPage.tsx` | handleChange, handleDiscardDraft, handleDismissDraftBanner, onBuild, BuildWizard (+9) |
| `src/ui/pages/build/engine.ts` | validateCuratorInput, BundleResolutionError, runBuildPipeline, resolveVortexVersion, resolveGameVersion (+3) |
| `src/core/deploymentManifest.ts` | collectDistinctModTypes, normalizeManifest, captureDeploymentManifests |
| `src/core/draftStorage.ts` | deleteDraft, getAppDataPath |
| `src/core/manifest/collectionConfig.ts` | reconcileExternalModsConfig, toBuildManifestExternalMods |
| `src/core/loadOrder.ts` | captureLoadOrder |
| `src/ui/runtime/nativeNotify.ts` | nativeNotify |

## Entry Points

Start here when exploring this area:

- **`deleteDraft`** (Function) — `src/core/draftStorage.ts:192`
- **`getAppDataPath`** (Function) — `src/core/draftStorage.ts:218`
- **`validateCuratorInput`** (Function) — `src/ui/pages/build/engine.ts:488`
- **`captureLoadOrder`** (Function) — `src/core/loadOrder.ts:40`
- **`collectDistinctModTypes`** (Function) — `src/core/deploymentManifest.ts:53`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BundleResolutionError` | Class | `src/ui/pages/build/engine.ts` | 183 |
| `deleteDraft` | Function | `src/core/draftStorage.ts` | 192 |
| `getAppDataPath` | Function | `src/core/draftStorage.ts` | 218 |
| `validateCuratorInput` | Function | `src/ui/pages/build/engine.ts` | 488 |
| `captureLoadOrder` | Function | `src/core/loadOrder.ts` | 40 |
| `collectDistinctModTypes` | Function | `src/core/deploymentManifest.ts` | 53 |
| `captureDeploymentManifests` | Function | `src/core/deploymentManifest.ts` | 133 |
| `reconcileExternalModsConfig` | Function | `src/core/manifest/collectionConfig.ts` | 208 |
| `toBuildManifestExternalMods` | Function | `src/core/manifest/collectionConfig.ts` | 249 |
| `runBuildPipeline` | Function | `src/ui/pages/build/engine.ts` | 324 |
| `nativeNotify` | Function | `src/ui/runtime/nativeNotify.ts` | 39 |
| `getBuildSession` | Function | `src/ui/pages/build/buildSession.ts` | 493 |
| `BuildSession` | Class | `src/ui/pages/build/buildSession.ts` | 170 |
| `isAbortError` | Function | `src/ui/pages/build/buildSession.ts` | 510 |
| `handleChange` | Function | `src/ui/pages/build/BuildPage.tsx` | 276 |
| `handleDiscardDraft` | Function | `src/ui/pages/build/BuildPage.tsx` | 280 |
| `handleDismissDraftBanner` | Function | `src/ui/pages/build/BuildPage.tsx` | 289 |
| `onBuild` | Function | `src/ui/pages/build/BuildPage.tsx` | 293 |
| `normalizeManifest` | Function | `src/core/deploymentManifest.ts` | 73 |
| `resolveVortexVersion` | Function | `src/ui/pages/build/engine.ts` | 585 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `OnBuild → EHRuntime` | cross_community | 5 |
| `OnBuild → Notify` | cross_community | 5 |
| `OnBuild → AbortError` | cross_community | 5 |
| `OnBuild → GetCollectionConfigPath` | cross_community | 5 |
| `OnBuild → CreateDefaultConfig` | cross_community | 5 |
| `OnBuild → WriteConfigFile` | cross_community | 5 |
| `OnBuild → SanitizeKey` | cross_community | 5 |
| `Begin → NormalizeRuleReference` | cross_community | 5 |
| `Begin → RulesSortKey` | cross_community | 5 |
| `Build → CollectionConfigError` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Manifest | 4 calls |
| Pages | 4 calls |
| Cluster_17 | 3 calls |
| Resolver | 3 calls |
| Actions | 2 calls |
| Runtime | 2 calls |
| Installer | 1 calls |
| Cluster_10 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "deleteDraft"})` — see callers and callees
2. `gitnexus_query({query: "build"})` — find related execution flows
3. Read key files listed above for implementation details
