---
name: gitnexus-area-build
description: "Skill for the Build area of vortex-mod-monitor. 97 symbols across 11 files."
---

# Build

97 symbols | 11 files | Cohesion: 70%

## When to Use

- Working with code in `src/`
- Understanding how deleteDraft, getAppDataPath, handleDiscardDraft work
- Modifying build-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/build/BuildPage.tsx` | handle, handleDiscardDraft, handleChange, handleDismissDraftBanner, DraftRestoredBanner (+19) |
| `src/ui/pages/build/buildSession.ts` | queuePosition, isAbortError, _runBuild, begin, discardDraft (+15) |
| `src/ui/pages/build/buildSessionRegistry.ts` | notifyStateChanged, emit, ensure, isAnyBusy, makeHooks (+13) |
| `src/ui/pages/build/BuildDashboard.tsx` | handleDiscardDraft, handleUpdatePublished, refresh, bumpPatch, BuildDashboard (+9) |
| `src/ui/pages/build/engine.ts` | BundleResolutionError, buildOutputFileName, resolveDeploymentMethod, resolveGameVersion, resolveVortexVersion (+5) |
| `src/core/draftStorage.ts` | deleteDraft, getAppDataPath, getDraftsRoot, listDrafts |
| `src/core/deploymentManifest.ts` | captureDeploymentManifests, collectDistinctModTypes, normalizeManifest |
| `src/core/loadOrder.ts` | captureLoadOrder |
| `src/core/manifest/collectionConfig.ts` | reconcileExternalModsConfig |
| `src/ui/components/Pill.tsx` | Pill |

## Entry Points

Start here when exploring this area:

- **`deleteDraft`** (Function) — `src/core/draftStorage.ts:431`
- **`getAppDataPath`** (Function) — `src/core/draftStorage.ts:457`
- **`handleDiscardDraft`** (Function) — `src/ui/pages/build/BuildDashboard.tsx:194`
- **`handleUpdatePublished`** (Function) — `src/ui/pages/build/BuildDashboard.tsx:233`
- **`refresh`** (Function) — `src/ui/pages/build/BuildDashboard.tsx:101`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BundleResolutionError` | Class | `src/ui/pages/build/engine.ts` | 209 |
| `deleteDraft` | Function | `src/core/draftStorage.ts` | 431 |
| `getAppDataPath` | Function | `src/core/draftStorage.ts` | 457 |
| `handleDiscardDraft` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 194 |
| `handleUpdatePublished` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 233 |
| `refresh` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 101 |
| `captureDeploymentManifests` | Function | `src/core/deploymentManifest.ts` | 133 |
| `collectDistinctModTypes` | Function | `src/core/deploymentManifest.ts` | 53 |
| `captureLoadOrder` | Function | `src/core/loadOrder.ts` | 40 |
| `reconcileExternalModsConfig` | Function | `src/core/manifest/collectionConfig.ts` | 240 |
| `runBuildPipeline` | Function | `src/ui/pages/build/engine.ts` | 350 |
| `getDraftsRoot` | Function | `src/core/draftStorage.ts` | 121 |
| `listDrafts` | Function | `src/core/draftStorage.ts` | 162 |
| `BuildDashboard` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 87 |
| `handleOpenDraft` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 178 |
| `registry` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 90 |
| `getBuildSessionRegistry` | Function | `src/ui/pages/build/buildSessionRegistry.ts` | 292 |
| `Pill` | Function | `src/ui/components/Pill.tsx` | 19 |
| `validateCuratorInput` | Function | `src/ui/pages/build/engine.ts` | 593 |
| `onProgress` | Function | `src/ui/pages/build/engine.ts` | 283 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `BuildPage → IsPlainObject` | cross_community | 5 |
| `BuildPage → MigrateV1Payload` | cross_community | 5 |
| `BuildPage → SanitizeKey` | cross_community | 5 |
| `BuildPage → NotifyStateChanged` | cross_community | 5 |
| `Session → EHRuntime` | cross_community | 5 |
| `Session → Notify` | cross_community | 5 |
| `HandleDiscardDraft → SanitizeKey` | cross_community | 5 |
| `ReleaseBuild → EHRuntime` | cross_community | 5 |
| `ReleaseBuild → Notify` | cross_community | 5 |
| `EventHorizonMainPage → Pill` | cross_community | 4 |

## How to Explore

1. `context({name: "deleteDraft"})` — see callers and callees
2. `query({search_query: "build"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
