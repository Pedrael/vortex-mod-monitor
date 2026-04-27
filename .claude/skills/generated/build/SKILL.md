---
name: build
description: "Skill for the Build area of vortex-mod-monitor. 48 symbols across 9 files."
---

# Build

48 symbols | 9 files | Cohesion: 71%

## When to Use

- Working with code in `src/`
- Understanding how collectDistinctModTypes, captureDeploymentManifests, reconcileExternalModsConfig work
- Modifying build-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/build/BuildPage.tsx` | handleDiscardDraft, onBuild, BuildWizard, FormPanel, updateCurator (+12) |
| `src/ui/pages/build/buildSession.ts` | discardDraft, setValidationError, begin, build, isAbortError (+6) |
| `src/ui/pages/build/engine.ts` | BundleResolutionError, runBuildPipeline, checkAbort, resolveVortexVersion, resolveGameVersion (+4) |
| `src/core/deploymentManifest.ts` | collectDistinctModTypes, normalizeManifest, captureDeploymentManifests |
| `src/core/manifest/collectionConfig.ts` | reconcileExternalModsConfig, toBuildManifestExternalMods |
| `src/core/draftStorage.ts` | deleteDraft, getAppDataPath |
| `src/core/installer/profile.ts` | finalize, onChange |
| `src/ui/runtime/nativeNotify.ts` | nativeNotify |
| `src/ui/pages/install/steps.tsx` | OrphanRow |

## Entry Points

Start here when exploring this area:

- **`collectDistinctModTypes`** (Function) — `src/core/deploymentManifest.ts:53`
- **`captureDeploymentManifests`** (Function) — `src/core/deploymentManifest.ts:133`
- **`reconcileExternalModsConfig`** (Function) — `src/core/manifest/collectionConfig.ts:208`
- **`toBuildManifestExternalMods`** (Function) — `src/core/manifest/collectionConfig.ts:249`
- **`runBuildPipeline`** (Function) — `src/ui/pages/build/engine.ts:350`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BundleResolutionError` | Class | `src/ui/pages/build/engine.ts` | 209 |
| `collectDistinctModTypes` | Function | `src/core/deploymentManifest.ts` | 53 |
| `captureDeploymentManifests` | Function | `src/core/deploymentManifest.ts` | 133 |
| `reconcileExternalModsConfig` | Function | `src/core/manifest/collectionConfig.ts` | 208 |
| `toBuildManifestExternalMods` | Function | `src/core/manifest/collectionConfig.ts` | 249 |
| `runBuildPipeline` | Function | `src/ui/pages/build/engine.ts` | 350 |
| `checkAbort` | Function | `src/ui/pages/build/engine.ts` | 359 |
| `deleteDraft` | Function | `src/core/draftStorage.ts` | 192 |
| `getAppDataPath` | Function | `src/core/draftStorage.ts` | 218 |
| `validateCuratorInput` | Function | `src/ui/pages/build/engine.ts` | 562 |
| `nativeNotify` | Function | `src/ui/runtime/nativeNotify.ts` | 39 |
| `getBuildSession` | Function | `src/ui/pages/build/buildSession.ts` | 513 |
| `finalize` | Function | `src/core/installer/profile.ts` | 102 |
| `onChange` | Function | `src/core/installer/profile.ts` | 142 |
| `BuildSession` | Class | `src/ui/pages/build/buildSession.ts` | 184 |
| `normalizeManifest` | Function | `src/core/deploymentManifest.ts` | 73 |
| `resolveVortexVersion` | Function | `src/ui/pages/build/engine.ts` | 659 |
| `resolveGameVersion` | Function | `src/ui/pages/build/engine.ts` | 664 |
| `resolveDeploymentMethod` | Function | `src/ui/pages/build/engine.ts` | 682 |
| `buildOutputFileName` | Function | `src/ui/pages/build/engine.ts` | 703 |

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
| Install | 9 calls |
| Manifest | 5 calls |
| Cluster_18 | 3 calls |
| Resolver | 3 calls |
| Actions | 3 calls |
| Installer | 1 calls |
| Cluster_15 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "collectDistinctModTypes"})` — see callers and callees
2. `gitnexus_query({query: "build"})` — find related execution flows
3. Read key files listed above for implementation details
