---
name: build
description: "Skill for the Build area of vortex-mod-monitor. 107 symbols across 14 files."
---

# Build

107 symbols | 14 files | Cohesion: 71%

## When to Use

- Working with code in `src/`
- Understanding how getDraftPath, getDraftsRoot, loadDraft work
- Modifying build-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/build/BuildPage.tsx` | handle, handleDiscardDraft, handleChange, handleDismissDraftBanner, BuildWizard (+20) |
| `src/ui/pages/build/buildSession.ts` | releaseBuild, discardDraft, begin, queuePosition, _runBuild (+17) |
| `src/ui/pages/build/buildSessionRegistry.ts` | BuildSessionRegistry, ensure, get, makeHooks, getBuildSessionRegistry (+10) |
| `src/ui/pages/build/BuildDashboard.tsx` | BuildDashboard, refresh, handleOpenDraft, handleDiscardDraft, handleUpdatePublished (+9) |
| `src/core/draftStorage.ts` | getDraftPath, getDraftsRoot, loadDraft, listDrafts, readDraftFile (+6) |
| `src/ui/pages/build/engine.ts` | BundleResolutionError, onProgress, runBuildPipeline, checkAbort, resolveVortexVersion (+5) |
| `src/core/manifest/collectionConfig.ts` | reconcileExternalModsConfig, toBuildManifestExternalMods |
| `src/ui/pages/install/steps.tsx` | Stepper, SectionHeader |
| `src/core/loadOrder.ts` | captureLoadOrder |
| `src/ui/runtime/nativeNotify.ts` | nativeNotify |

## Entry Points

Start here when exploring this area:

- **`getDraftPath`** (Function) — `src/core/draftStorage.ts:100`
- **`getDraftsRoot`** (Function) — `src/core/draftStorage.ts:121`
- **`loadDraft`** (Function) — `src/core/draftStorage.ts:142`
- **`listDrafts`** (Function) — `src/core/draftStorage.ts:162`
- **`saveDraft`** (Function) — `src/core/draftStorage.ts:399`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BundleResolutionError` | Class | `src/ui/pages/build/engine.ts` | 209 |
| `getDraftPath` | Function | `src/core/draftStorage.ts` | 100 |
| `getDraftsRoot` | Function | `src/core/draftStorage.ts` | 121 |
| `loadDraft` | Function | `src/core/draftStorage.ts` | 142 |
| `listDrafts` | Function | `src/core/draftStorage.ts` | 162 |
| `saveDraft` | Function | `src/core/draftStorage.ts` | 399 |
| `deleteDraft` | Function | `src/core/draftStorage.ts` | 431 |
| `getAppDataPath` | Function | `src/core/draftStorage.ts` | 457 |
| `BuildDashboard` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 87 |
| `refresh` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 101 |
| `handleOpenDraft` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 178 |
| `handleDiscardDraft` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 194 |
| `handleUpdatePublished` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 233 |
| `captureLoadOrder` | Function | `src/core/loadOrder.ts` | 40 |
| `reconcileExternalModsConfig` | Function | `src/core/manifest/collectionConfig.ts` | 240 |
| `toBuildManifestExternalMods` | Function | `src/core/manifest/collectionConfig.ts` | 281 |
| `onProgress` | Function | `src/ui/pages/build/engine.ts` | 283 |
| `runBuildPipeline` | Function | `src/ui/pages/build/engine.ts` | 350 |
| `checkAbort` | Function | `src/ui/pages/build/engine.ts` | 359 |
| `nativeNotify` | Function | `src/ui/runtime/nativeNotify.ts` | 39 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Session → Notify` | cross_community | 5 |
| `Session → EHRuntime` | cross_community | 5 |
| `BuildPage → IsPlainObject` | cross_community | 5 |
| `BuildPage → MigrateV1Payload` | cross_community | 5 |
| `BuildPage → SanitizeKey` | cross_community | 5 |
| `BuildPage → NotifyStateChanged` | cross_community | 5 |
| `HandleDiscardDraft → SanitizeKey` | intra_community | 5 |
| `AppShell → NativeNotify` | cross_community | 5 |
| `RunBuildPipeline → CollectionConfigError` | cross_community | 4 |
| `DecisionsStep → StepDots` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Pages | 19 calls |
| Install | 7 calls |
| Manifest | 5 calls |
| Resolver | 4 calls |
| Actions | 3 calls |
| Runtime | 2 calls |
| Installer | 2 calls |
| Cluster_52 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "getDraftPath"})` — see callers and callees
2. `gitnexus_query({query: "build"})` — find related execution flows
3. Read key files listed above for implementation details
