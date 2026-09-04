---
name: gitnexus-area-pages
description: "Skill for the Pages area of Event-Horizon. 152 symbols across 39 files."
---

# Pages

152 symbols | 39 files | Cohesion: 79%

## When to Use

- Working with code in `src/`
- Understanding how healingBlockedReason, overallHealth, describeInstallAttempt work
- Modifying pages-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/install/steps.tsx` | ConfirmStep, ConflictRow, DoneStep, ExternalDownloadGuide, FailureBody (+17) |
| `src/ui/pages/build/BuildPage.tsx` | AvailabilityPanel, BuildWizard, BuildingPanel, DraftRestoredBanner, ErrorPanel (+16) |
| `src/ui/pages/CollectionsPage.tsx` | CollectionsList, handleContinueInstall, refresh, DetailTile, EmptyState (+9) |
| `src/ui/pages/HomePage.tsx` | CuratorPanel, Dashboard, DashboardBody, ErrorPanel, FooterRow (+8) |
| `src/ui/pages/ModDiffsPage.tsx` | ModDiffsPage, ChangedModList, ChangedModRow, FieldDiffRow, TierBadge (+8) |
| `src/ui/pages/PluginDiffsPage.tsx` | PluginDiffsPage, FileSelector, PluginDiffsView, EnabledMismatchList, PluginEntryList (+3) |
| `src/ui/pages/AboutPage.tsx` | AboutPage, LinkRow, Stat, handleClick, openExternal |
| `src/ui/pages/doctor/DoctorPanel.tsx` | CheckCard, DoctorPanel, VerdictRing, rank |
| `src/ui/pages/build/buildSession.ts` | cancelLoading, cancelRecovering, getState, subscribe |
| `src/core/installer/fomodReplayMode.ts` | describeFomodModes, s, mustAskReplayMode |

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
| `InterruptedInstalls` | Function | `src/ui/pages/CollectionsPage.tsx` | 117 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RouteOutlet → InstallLedgerError` | cross_community | 8 |
| `BuildWizard → GetVortexUserDataPath` | cross_community | 8 |
| `RouteOutlet → GetInstallLedgerDir` | cross_community | 7 |
| `RouteOutlet → IsUuid` | cross_community | 7 |
| `RouteOutlet → BelongsToGame` | cross_community | 7 |
| `HomePage → ExpectString` | cross_community | 7 |
| `RouteOutlet → GetActiveGameId` | cross_community | 6 |
| `RouteOutlet → ResolveProfileName` | cross_community | 6 |
| `RouteOutlet → ResolveVortexVersion` | cross_community | 6 |
| `Dashboard → IsSemverLike` | cross_community | 6 |

## How to Explore

1. `context({name: "healingBlockedReason"})` — see callers and callees
2. `query({search_query: "pages"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
