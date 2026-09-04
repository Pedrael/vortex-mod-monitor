---
name: gitnexus-area-build
description: "Skill for the Build area of Event-Horizon. 327 symbols across 63 files."
---

# Build

327 symbols | 63 files | Cohesion: 77%

## When to Use

- Working with code in `src/`
- Understanding how healingBlockedReason, overallHealth, describeInstallAttempt work
- Modifying build-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/build/BuildPage.tsx` | AvailabilityPanel, BuildWizard, BuildingPanel, DraftRestoredBanner, ErrorPanel (+43) |
| `src/ui/pages/build/buildSession.ts` | cancelLoading, cancelRecovering, getState, subscribe, onProgress (+27) |
| `src/ui/pages/install/steps.tsx` | ConfirmStep, ConflictRow, DoneStep, ExternalDownloadGuide, FailureBody (+18) |
| `src/ui/pages/build/engine.ts` | BundleResolutionError, buildOutputFileName, resolveDeploymentMethod, resolveVortexVersion, runBuildPipeline (+16) |
| `src/ui/pages/build/BuildDashboard.tsx` | DraftCard, slugsInUse, registry, handleDiscardDraft, handleCleanupUnbuilt (+13) |
| `src/ui/pages/build/buildSessionRegistry.ts` | BuildSessionRegistry, getBuildSessionRegistry, ensure, get, makeHooks (+13) |
| `src/ui/pages/CollectionsPage.tsx` | CollectionsList, handleContinueInstall, refresh, DetailTile, EmptyState (+8) |
| `src/ui/pages/HomePage.tsx` | CuratorPanel, Dashboard, DashboardBody, ErrorPanel, FooterRow (+7) |
| `src/core/build/nexusAvailability.ts` | categoryOf, checkNexusAvailability, classifyFile, currentMainFile, fileIdOf (+6) |
| `src/core/archiveHashCache.ts` | archiveHashCacheKey, emptyArchiveHashCache, isHex64, loadArchiveHashCache, rememberArchiveHash (+4) |

## Entry Points

Start here when exploring this area:

- **`healingBlockedReason`** (Function) — `src/core/doctor/health.ts:497`
- **`overallHealth`** (Function) — `src/core/doctor/health.ts:444`
- **`describeInstallAttempt`** (Function) — `src/core/installer/attemptRecord.ts:169`
- **`describeFomodModes`** (Function) — `src/core/installer/fomodReplayMode.ts:78`
- **`s`** (Function) — `src/core/installer/fomodReplayMode.ts:84`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BundleResolutionError` | Class | `src/ui/pages/build/engine.ts` | 384 |
| `healingBlockedReason` | Function | `src/core/doctor/health.ts` | 497 |
| `overallHealth` | Function | `src/core/doctor/health.ts` | 444 |
| `describeInstallAttempt` | Function | `src/core/installer/attemptRecord.ts` | 169 |
| `describeFomodModes` | Function | `src/core/installer/fomodReplayMode.ts` | 78 |
| `s` | Function | `src/core/installer/fomodReplayMode.ts` | 84 |
| `mustAskReplayMode` | Function | `src/core/installer/fomodReplayMode.ts` | 183 |
| `Button` | Function | `src/ui/components/Button.tsx` | 31 |
| `Card` | Function | `src/ui/components/Card.tsx` | 31 |
| `EventHorizonLogo` | Function | `src/ui/components/EventHorizonLogo.tsx` | 47 |
| `HashingCard` | Function | `src/ui/components/HashingCard.tsx` | 49 |
| `Modal` | Function | `src/ui/components/Modal.tsx` | 57 |
| `Pill` | Function | `src/ui/components/Pill.tsx` | 19 |
| `ProgressRing` | Function | `src/ui/components/ProgressRing.tsx` | 29 |
| `renderLabel` | Function | `src/ui/components/ProgressRing.tsx` | 42 |
| `StepDots` | Function | `src/ui/components/StepDots.tsx` | 31 |
| `useToast` | Function | `src/ui/components/Toast.tsx` | 50 |
| `useErrorReporter` | Function | `src/ui/errors/ErrorContext.tsx` | 49 |
| `useKeyboardShortcut` | Function | `src/ui/hooks/useKeyboardShortcut.ts` | 35 |
| `FailedAttempts` | Function | `src/ui/pages/CollectionsPage.tsx` | 202 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `PublishedDetailsPanel → ZipReadError` | cross_community | 9 |
| `RouteOutlet → InstallLedgerError` | cross_community | 8 |
| `BuildWizard → GetVortexUserDataPath` | cross_community | 8 |
| `RouteOutlet → GetInstallLedgerDir` | cross_community | 7 |
| `RouteOutlet → IsUuid` | cross_community | 7 |
| `RouteOutlet → BelongsToGame` | cross_community | 7 |
| `HomePage → ExpectString` | cross_community | 7 |
| `PublishedDetailsPanel → FindZip64Extra` | cross_community | 7 |
| `LoadPublishedDetails → ZipReadError` | cross_community | 7 |
| `RouteOutlet → GetActiveGameId` | cross_community | 6 |

## How to Explore

1. `context({name: "healingBlockedReason"})` — see callers and callees
2. `query({search_query: "build"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
