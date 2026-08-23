---
name: gitnexus-area-build
description: "Skill for the Build area of vortex-mod-monitor. 185 symbols across 32 files."
---

# Build

185 symbols | 32 files | Cohesion: 81%

## When to Use

- Working with code in `src/`
- Understanding how Button, Card, EventHorizonLogo work
- Modifying build-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/build/BuildPage.tsx` | BuildWizard, BuildingPanel, DraftRestoredBanner, ErrorPanel, ExternalModsTable (+30) |
| `src/ui/pages/build/buildSession.ts` | cancelLoading, getState, subscribe, queuePosition, isAbortError (+18) |
| `src/ui/pages/install/steps.tsx` | ConfirmStep, ConflictRow, DoneStep, FailureBody, InstallingStep (+15) |
| `src/ui/pages/build/buildSessionRegistry.ts` | notifyStateChanged, emit, ensure, isAnyBusy, makeHooks (+13) |
| `src/ui/pages/build/BuildDashboard.tsx` | BuildDashboard, handleOpenDraft, DashboardHeader, DraftCard, EmptyState (+9) |
| `src/ui/pages/HomePage.tsx` | CuratorPanel, Dashboard, DashboardBody, ErrorPanel, FooterRow (+7) |
| `src/core/draftStorage.ts` | deleteDraft, getAppDataPath, getDraftPath, getDraftsRoot, isPlainObject (+6) |
| `src/ui/pages/build/engine.ts` | BundleResolutionError, buildOutputFileName, resolveDeploymentMethod, resolveGameVersion, resolveVortexVersion (+6) |
| `src/ui/pages/CollectionsPage.tsx` | CollectionsList, refresh, DetailTile, EmptyState, ReceiptCard (+4) |
| `src/ui/components/ProgressRing.tsx` | ProgressRing, renderLabel, clamp |

## Entry Points

Start here when exploring this area:

- **`Button`** (Function) — `src/ui/components/Button.tsx:31`
- **`Card`** (Function) — `src/ui/components/Card.tsx:31`
- **`EventHorizonLogo`** (Function) — `src/ui/components/EventHorizonLogo.tsx:47`
- **`HashingCard`** (Function) — `src/ui/components/HashingCard.tsx:49`
- **`Modal`** (Function) — `src/ui/components/Modal.tsx:57`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BundleResolutionError` | Class | `src/ui/pages/build/engine.ts` | 209 |
| `Button` | Function | `src/ui/components/Button.tsx` | 31 |
| `Card` | Function | `src/ui/components/Card.tsx` | 31 |
| `EventHorizonLogo` | Function | `src/ui/components/EventHorizonLogo.tsx` | 47 |
| `HashingCard` | Function | `src/ui/components/HashingCard.tsx` | 49 |
| `Modal` | Function | `src/ui/components/Modal.tsx` | 57 |
| `Page` | Function | `src/ui/components/Page.tsx` | 26 |
| `Pill` | Function | `src/ui/components/Pill.tsx` | 19 |
| `ProgressRing` | Function | `src/ui/components/ProgressRing.tsx` | 29 |
| `renderLabel` | Function | `src/ui/components/ProgressRing.tsx` | 42 |
| `StepDots` | Function | `src/ui/components/StepDots.tsx` | 31 |
| `useToast` | Function | `src/ui/components/Toast.tsx` | 50 |
| `useErrorReporter` | Function | `src/ui/errors/ErrorContext.tsx` | 48 |
| `useKeyboardShortcut` | Function | `src/ui/hooks/useKeyboardShortcut.ts` | 35 |
| `AboutPage` | Function | `src/ui/pages/AboutPage.tsx` | 21 |
| `ComingSoonPage` | Function | `src/ui/pages/ComingSoonPage.tsx` | 21 |
| `BuildDashboard` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 87 |
| `handleOpenDraft` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 178 |
| `formatBytes` | Function | `src/ui/pages/dashboard/data.ts` | 307 |
| `formatRelativeTime` | Function | `src/ui/pages/dashboard/data.ts` | 314 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RouteOutlet → InstallLedgerError` | cross_community | 8 |
| `RouteOutlet → ExpectString` | cross_community | 8 |
| `RouteOutlet → IsUuid` | cross_community | 8 |
| `RouteOutlet → GetInstallLedgerDir` | cross_community | 7 |
| `HomePage → IsSemverLike` | cross_community | 7 |
| `RouteOutlet → GetActiveGameId` | cross_community | 6 |
| `RouteOutlet → GetActiveProfileIdFromState` | cross_community | 6 |
| `RouteOutlet → ResolveProfileName` | cross_community | 6 |
| `RouteOutlet → ResolveVortexVersion` | cross_community | 6 |
| `BuildPage → IsPlainObject` | cross_community | 5 |

## How to Explore

1. `context({name: "Button"})` — see callers and callees
2. `query({search_query: "build"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
