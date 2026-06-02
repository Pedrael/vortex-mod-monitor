---
name: pages
description: "Skill for the Pages area of vortex-mod-monitor. 81 symbols across 23 files."
---

# Pages

81 symbols | 23 files | Cohesion: 69%

## When to Use

- Working with code in `src/`
- Understanding how formatBytes, formatRelativeTime, Button work
- Modifying pages-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/HomePage.tsx` | Dashboard, LoadingPanel, ErrorPanel, DashboardBody, SystemStatusBar (+8) |
| `src/ui/pages/ModDiffsPage.tsx` | ModDiffsPage, TierBadge, ChangedModList, partitionDiffs, ChangedModRow (+8) |
| `src/ui/pages/PluginDiffsPage.tsx` | PluginDiffsPage, ReportView, PluginEntryList, EnabledMismatchList, PositionChangedList (+3) |
| `src/ui/pages/build/BuildPage.tsx` | QueuedPanel, IdlePanel, LoadingPanel, BuildingPanel, ErrorPanel (+2) |
| `src/ui/pages/CollectionsPage.tsx` | EmptyState, CollectionsPage, ReceiptDetailModal, handleExportDiagnostic, UninstallConfirmModal (+2) |
| `src/ui/pages/AboutPage.tsx` | AboutPage, Stat, LinkRow, handleClick, openExternal |
| `src/ui/components/ProgressRing.tsx` | ProgressRing, renderLabel, clamp |
| `src/ui/errors/ErrorBoundary.tsx` | render, PageFallback, InlineFallback |
| `src/ui/EventHorizonMainPage.tsx` | AppShell, NavBar, RouteOutlet |
| `src/core/modDiffStorage.ts` | parseFilename, listModDiffFiles, readModDiffReport |

## Entry Points

Start here when exploring this area:

- **`formatBytes`** (Function) — `src/ui/pages/dashboard/data.ts:307`
- **`formatRelativeTime`** (Function) — `src/ui/pages/dashboard/data.ts:314`
- **`Button`** (Function) — `src/ui/components/Button.tsx:31`
- **`Card`** (Function) — `src/ui/components/Card.tsx:31`
- **`HashingCard`** (Function) — `src/ui/components/HashingCard.tsx:49`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `formatBytes` | Function | `src/ui/pages/dashboard/data.ts` | 307 |
| `formatRelativeTime` | Function | `src/ui/pages/dashboard/data.ts` | 314 |
| `Button` | Function | `src/ui/components/Button.tsx` | 31 |
| `Card` | Function | `src/ui/components/Card.tsx` | 31 |
| `HashingCard` | Function | `src/ui/components/HashingCard.tsx` | 49 |
| `ProgressRing` | Function | `src/ui/components/ProgressRing.tsx` | 29 |
| `renderLabel` | Function | `src/ui/components/ProgressRing.tsx` | 42 |
| `LoadingStep` | Function | `src/ui/pages/install/steps.tsx` | 349 |
| `EventHorizonLogo` | Function | `src/ui/components/EventHorizonLogo.tsx` | 47 |
| `Page` | Function | `src/ui/components/Page.tsx` | 26 |
| `AboutPage` | Function | `src/ui/pages/AboutPage.tsx` | 21 |
| `ComingSoonPage` | Function | `src/ui/pages/ComingSoonPage.tsx` | 21 |
| `useErrorReporterFormatted` | Function | `src/ui/errors/ErrorContext.tsx` | 64 |
| `CollectionsPage` | Function | `src/ui/pages/CollectionsPage.tsx` | 56 |
| `HomePage` | Function | `src/ui/pages/HomePage.tsx` | 48 |
| `ModDiffsPage` | Function | `src/ui/pages/ModDiffsPage.tsx` | 66 |
| `PluginDiffsPage` | Function | `src/ui/pages/PluginDiffsPage.tsx` | 52 |
| `BuildPage` | Function | `src/ui/pages/build/BuildPage.tsx` | 75 |
| `InstallPage` | Function | `src/ui/pages/install/InstallPage.tsx` | 50 |
| `DiffSectionBlock` | Function | `src/ui/components/DiffSectionBlock.tsx` | 33 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `HomePage → InstallLedgerError` | cross_community | 7 |
| `Dashboard → ExpectString` | cross_community | 6 |
| `Dashboard → IsUuid` | cross_community | 6 |
| `HomePage → GetInstallLedgerDir` | cross_community | 6 |
| `HomePage → IsUuid` | cross_community | 6 |
| `BuildPage → IsPlainObject` | cross_community | 5 |
| `BuildPage → MigrateV1Payload` | cross_community | 5 |
| `BuildPage → SanitizeKey` | cross_community | 5 |
| `BuildPage → NotifyStateChanged` | cross_community | 5 |
| `ReportView → FormatFieldValue` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Install | 10 calls |
| Build | 8 calls |
| Installer | 2 calls |
| Dashboard | 1 calls |

## How to Explore

1. `gitnexus_context({name: "formatBytes"})` — see callers and callees
2. `gitnexus_query({query: "pages"})` — find related execution flows
3. Read key files listed above for implementation details
