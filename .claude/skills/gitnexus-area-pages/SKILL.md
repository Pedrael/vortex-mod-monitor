---
name: gitnexus-area-pages
description: "Skill for the Pages area of Event-Horizon. 150 symbols across 38 files."
---

# Pages

150 symbols | 38 files | Cohesion: 79%

## When to Use

- Working with code in `src/`
- Understanding how describeEnableChanges, planEnableChanges, describeCleanupPlan work
- Modifying pages-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/install/steps.tsx` | ConfirmStep, ConflictRow, DoneStep, ExternalDownloadGuide, FailureBody (+16) |
| `src/ui/pages/CollectionsPage.tsx` | CollectionsList, handleContinueInstall, refresh, DetailTile, EmptyState (+9) |
| `src/ui/pages/HomePage.tsx` | CuratorPanel, Dashboard, DashboardBody, ErrorPanel, FooterRow (+8) |
| `src/ui/pages/ModDiffsPage.tsx` | ModDiffsPage, ChangedModList, ChangedModRow, FieldDiffRow, TierBadge (+8) |
| `src/ui/pages/build/BuildPage.tsx` | AvailabilityPanel, BuildingPanel, ErrorPanel, IdlePanel, ImportPreviousButton (+7) |
| `src/ui/pages/curator/CuratorPage.tsx` | CuratorBody, endorseAll, refreshUpdates, setEnabledFor, setFrozen (+6) |
| `src/ui/pages/PluginDiffsPage.tsx` | PluginDiffsPage, FileSelector, PluginDiffsView, EnabledMismatchList, PluginEntryList (+3) |
| `src/ui/pages/AboutPage.tsx` | AboutPage, LinkRow, Stat, handleClick, openExternal |
| `src/ui/pages/doctor/DoctorPanel.tsx` | CheckCard, DoctorPanel, VerdictRing, rank |
| `src/core/installer/fomodReplayMode.ts` | describeFomodModes, s, mustAskReplayMode |

## Entry Points

Start here when exploring this area:

- **`describeEnableChanges`** (Function) — `src/core/curator/bulkToggles.ts:61`
- **`planEnableChanges`** (Function) — `src/core/curator/bulkToggles.ts:34`
- **`describeCleanupPlan`** (Function) — `src/core/curator/cleanupPlan.ts:237`
- **`formatSize`** (Function) — `src/core/curator/cleanupPlan.ts:225`
- **`freezeAttribute`** (Function) — `src/core/curator/readProfile.ts:112`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `describeEnableChanges` | Function | `src/core/curator/bulkToggles.ts` | 61 |
| `planEnableChanges` | Function | `src/core/curator/bulkToggles.ts` | 34 |
| `describeCleanupPlan` | Function | `src/core/curator/cleanupPlan.ts` | 237 |
| `formatSize` | Function | `src/core/curator/cleanupPlan.ts` | 225 |
| `freezeAttribute` | Function | `src/core/curator/readProfile.ts` | 112 |
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
| `Page` | Function | `src/ui/components/Page.tsx` | 26 |
| `Pill` | Function | `src/ui/components/Pill.tsx` | 19 |
| `ProgressRing` | Function | `src/ui/components/ProgressRing.tsx` | 29 |
| `renderLabel` | Function | `src/ui/components/ProgressRing.tsx` | 42 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RouteOutlet → InstallLedgerError` | cross_community | 8 |
| `RouteOutlet → GetInstallLedgerDir` | cross_community | 7 |
| `RouteOutlet → IsUuid` | cross_community | 7 |
| `RouteOutlet → BelongsToGame` | cross_community | 7 |
| `HomePage → ExpectString` | cross_community | 7 |
| `RouteOutlet → GetActiveGameId` | cross_community | 6 |
| `RouteOutlet → ResolveProfileName` | cross_community | 6 |
| `RouteOutlet → ResolveVortexVersion` | cross_community | 6 |
| `Dashboard → IsSemverLike` | cross_community | 6 |
| `BuildPage → NotifyStateChanged` | cross_community | 6 |

## How to Explore

1. `context({name: "describeEnableChanges"})` — see callers and callees
2. `query({search_query: "pages"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
