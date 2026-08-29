---
name: gitnexus-area-build
description: "Skill for the Build area of vortex-mod-monitor. 213 symbols across 33 files."
---

# Build

213 symbols | 33 files | Cohesion: 71%

## When to Use

- Working with code in `src/`
- Understanding how applyRecovery, findRecoverableMods, Button work
- Modifying build-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/build/BuildPage.tsx` | BuildWizard, BuildingPanel, DraftRestoredBanner, ErrorPanel, Field (+37) |
| `src/ui/pages/build/buildSession.ts` | cancelLoading, cancelRecovering, getState, recoverArchives, subscribe (+24) |
| `src/ui/pages/build/engine.ts` | BundleResolutionError, buildOutputFileName, resolveDeploymentMethod, resolveVortexVersion, runBuildPipeline (+15) |
| `src/ui/pages/build/buildSessionRegistry.ts` | notifyStateChanged, emit, ensure, isAnyBusy, makeHooks (+13) |
| `src/ui/pages/build/BuildDashboard.tsx` | DraftCard, slugsInUse, handleDiscardDraft, handleCleanupUnbuilt, handleDeletePublished (+11) |
| `src/ui/pages/install/steps.tsx` | DoneStep, FailureBody, LoadingStep, PreviewStep, RulesScopePreview (+6) |
| `src/core/archiveHashCache.ts` | archiveHashCacheKey, emptyArchiveHashCache, isHex64, loadArchiveHashCache, rememberArchiveHash (+6) |
| `src/ui/pages/HomePage.tsx` | CuratorPanel, DashboardBody, ErrorPanel, FooterRow, LoadingPanel (+5) |
| `src/core/draftStorage.ts` | getDraftPath, isPlainObject, loadDraft, migrateV1Payload, readDraftFile (+4) |
| `src/ui/pages/build/externalSource.ts` | describeSourceKind, hasText, sourceKindOf, sourcePatch, sourceProblem |

## Entry Points

Start here when exploring this area:

- **`applyRecovery`** (Function) — `src/core/archiveRecovery.ts:304`
- **`findRecoverableMods`** (Function) — `src/core/archiveRecovery.ts:142`
- **`Button`** (Function) — `src/ui/components/Button.tsx:31`
- **`Card`** (Function) — `src/ui/components/Card.tsx:31`
- **`HashingCard`** (Function) — `src/ui/components/HashingCard.tsx:49`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BundleResolutionError` | Class | `src/ui/pages/build/engine.ts` | 313 |
| `applyRecovery` | Function | `src/core/archiveRecovery.ts` | 304 |
| `findRecoverableMods` | Function | `src/core/archiveRecovery.ts` | 142 |
| `Button` | Function | `src/ui/components/Button.tsx` | 31 |
| `Card` | Function | `src/ui/components/Card.tsx` | 31 |
| `HashingCard` | Function | `src/ui/components/HashingCard.tsx` | 49 |
| `Pill` | Function | `src/ui/components/Pill.tsx` | 19 |
| `ProgressRing` | Function | `src/ui/components/ProgressRing.tsx` | 29 |
| `renderLabel` | Function | `src/ui/components/ProgressRing.tsx` | 42 |
| `StepDots` | Function | `src/ui/components/StepDots.tsx` | 31 |
| `formatBytes` | Function | `src/ui/pages/dashboard/data.ts` | 303 |
| `formatRelativeTime` | Function | `src/ui/pages/dashboard/data.ts` | 310 |
| `DoneStep` | Function | `src/ui/pages/install/steps.tsx` | 1961 |
| `LoadingStep` | Function | `src/ui/pages/install/steps.tsx` | 365 |
| `PreviewStep` | Function | `src/ui/pages/install/steps.tsx` | 628 |
| `captureLoadOrder` | Function | `src/core/loadOrder.ts` | 40 |
| `describeExternalDrift` | Function | `src/core/manifest/bundleFromStaging.ts` | 351 |
| `applyDependencyOverrides` | Function | `src/core/manifest/externalDependencies.ts` | 360 |
| `describeUndeclared` | Function | `src/core/manifest/externalHints.ts` | 407 |
| `describeMachineKept` | Function | `src/core/manifest/gameIni.ts` | 251 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `PublishedDetailsPanel → ZipReadError` | cross_community | 9 |
| `BuildWizard → GetVortexUserDataPath` | cross_community | 8 |
| `PublishedDetailsPanel → FindZip64Extra` | cross_community | 7 |
| `LoadPublishedDetails → ZipReadError` | cross_community | 7 |
| `BuildPage → NotifyStateChanged` | cross_community | 6 |
| `PublishedDetailsPanel → GetVortexUserDataPath` | cross_community | 6 |
| `RevealPublished → GetVortexUserDataPath` | cross_community | 6 |
| `PublishedDetailsPanel → ReadEhcollError` | cross_community | 5 |
| `BuildPage → IsPlainObject` | cross_community | 5 |
| `BuildPage → MigrateV1Payload` | cross_community | 5 |

## How to Explore

1. `context({name: "applyRecovery"})` — see callers and callees
2. `query({search_query: "build"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
