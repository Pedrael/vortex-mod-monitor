---
name: gitnexus-area-pages
description: "Skill for the Pages area of vortex-mod-monitor. 116 symbols across 31 files."
---

# Pages

116 symbols | 31 files | Cohesion: 76%

## When to Use

- Working with code in `src/`
- Understanding how Button, Card, EventHorizonLogo work
- Modifying pages-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/install/steps.tsx` | ConfirmStep, DoneStep, FailureBody, InstallingStep, LoadingStep (+10) |
| `src/ui/pages/HomePage.tsx` | Dashboard, DashboardBody, ErrorPanel, FooterRow, Hero (+8) |
| `src/ui/pages/ModDiffsPage.tsx` | ModDiffsPage, ChangedModList, ChangedModRow, FieldDiffRow, TierBadge (+8) |
| `src/ui/pages/build/BuildPage.tsx` | BuildWizard, BuildingPanel, ErrorPanel, GameMismatchBanner, Header (+7) |
| `src/ui/pages/CollectionsPage.tsx` | CollectionsList, refresh, DetailTile, EmptyState, ReceiptCard (+5) |
| `src/ui/pages/PluginDiffsPage.tsx` | PluginDiffsPage, FileSelector, PluginDiffsView, EnabledMismatchList, PluginEntryList (+3) |
| `src/ui/pages/AboutPage.tsx` | AboutPage, LinkRow, Stat, handleClick, openExternal |
| `src/ui/components/ProgressRing.tsx` | ProgressRing, renderLabel, clamp |
| `src/ui/errors/ErrorBoundary.tsx` | InlineFallback, PageFallback, render |
| `src/ui/pages/install/InstallPage.tsx` | ErrorRetry, InstallWizard, InstallPage |

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
| `Button` | Function | `src/ui/components/Button.tsx` | 31 |
| `Card` | Function | `src/ui/components/Card.tsx` | 31 |
| `EventHorizonLogo` | Function | `src/ui/components/EventHorizonLogo.tsx` | 47 |
| `HashingCard` | Function | `src/ui/components/HashingCard.tsx` | 49 |
| `Modal` | Function | `src/ui/components/Modal.tsx` | 57 |
| `ProgressRing` | Function | `src/ui/components/ProgressRing.tsx` | 29 |
| `renderLabel` | Function | `src/ui/components/ProgressRing.tsx` | 42 |
| `StepDots` | Function | `src/ui/components/StepDots.tsx` | 31 |
| `useToast` | Function | `src/ui/components/Toast.tsx` | 50 |
| `useErrorReporter` | Function | `src/ui/errors/ErrorContext.tsx` | 48 |
| `useKeyboardShortcut` | Function | `src/ui/hooks/useKeyboardShortcut.ts` | 35 |
| `ConfirmStep` | Function | `src/ui/pages/install/steps.tsx` | 1470 |
| `DoneStep` | Function | `src/ui/pages/install/steps.tsx` | 1747 |
| `InstallingStep` | Function | `src/ui/pages/install/steps.tsx` | 1661 |
| `LoadingStep` | Function | `src/ui/pages/install/steps.tsx` | 350 |
| `PickStep` | Function | `src/ui/pages/install/steps.tsx` | 184 |
| `handlePick` | Function | `src/ui/pages/install/steps.tsx` | 193 |
| `PreviewStep` | Function | `src/ui/pages/install/steps.tsx` | 604 |
| `StaleReceiptStep` | Function | `src/ui/pages/install/steps.tsx` | 438 |
| `ConcurrentOpBanner` | Function | `src/ui/runtime/ConcurrentOpBanner.tsx` | 17 |

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
| `Dashboard → IsUuid` | cross_community | 6 |

## How to Explore

1. `context({name: "Button"})` — see callers and callees
2. `query({search_query: "pages"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
