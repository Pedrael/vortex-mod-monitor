---
name: gitnexus-area-build
description: "Skill for the Build area of Event-Horizon. 224 symbols across 38 files."
---

# Build

224 symbols | 38 files | Cohesion: 73%

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
| `src/ui/pages/build/buildSessionRegistry.ts` | BuildSessionRegistry, getBuildSessionRegistry, ensure, get, makeHooks (+13) |
| `src/ui/pages/build/BuildDashboard.tsx` | DraftCard, slugsInUse, registry, handleDiscardDraft, handleCleanupUnbuilt (+11) |
| `src/core/archiveHashCache.ts` | archiveHashCacheKey, emptyArchiveHashCache, isHex64, loadArchiveHashCache, rememberArchiveHash (+6) |
| `src/ui/pages/HomePage.tsx` | CuratorPanel, DashboardBody, ErrorPanel, FooterRow, LoadingPanel (+5) |
| `src/ui/pages/install/steps.tsx` | DoneStep, FailureBody, LoadingStep, PreviewStep, RulesScopePreview (+5) |
| `src/core/draftStorage.ts` | getDraftPath, isPlainObject, loadDraft, migrateV1Payload, readDraftFile (+4) |
| `src/ui/pages/build/persistOverrides.ts` | flush, save, writeNow, configWithOverrides, createOverridePersister |

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
| `DraftCard` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 977 |
| `formatBytes` | Function | `src/ui/pages/dashboard/data.ts` | 303 |
| `formatRelativeTime` | Function | `src/ui/pages/dashboard/data.ts` | 310 |
| `DoneStep` | Function | `src/ui/pages/install/steps.tsx` | 2211 |
| `LoadingStep` | Function | `src/ui/pages/install/steps.tsx` | 365 |
| `PreviewStep` | Function | `src/ui/pages/install/steps.tsx` | 628 |
| `describeExternalDrift` | Function | `src/core/manifest/bundleFromStaging.ts` | 351 |
| `toBuildManifestExternalMods` | Function | `src/core/manifest/collectionConfig.ts` | 329 |
| `applyDependencyOverrides` | Function | `src/core/manifest/externalDependencies.ts` | 360 |
| `applyHint` | Function | `src/core/manifest/externalHints.ts` | 229 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `PublishedDetailsPanel → ZipReadError` | cross_community | 9 |
| `BuildWizard → GetVortexUserDataPath` | cross_community | 8 |
| `PublishedDetailsPanel → FindZip64Extra` | cross_community | 7 |
| `LoadPublishedDetails → ZipReadError` | cross_community | 7 |
| `BuildPage → NotifyStateChanged` | cross_community | 6 |
| `StartInstall → EHRuntime` | cross_community | 6 |
| `PublishedDetailsPanel → GetVortexUserDataPath` | cross_community | 6 |
| `RevealPublished → GetVortexUserDataPath` | cross_community | 6 |
| `PublishedDetailsPanel → ReadEhcollError` | cross_community | 5 |
| `BuildPage → IsPlainObject` | cross_community | 5 |

## How to Explore

1. `context({name: "applyRecovery"})` — see callers and callees
2. `query({search_query: "build"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
