---
name: gitnexus-area-pages
description: "Skill for the Pages area of Event-Horizon. 75 symbols across 22 files."
---

# Pages

75 symbols | 22 files | Cohesion: 69%

## When to Use

- Working with code in `src/`
- Understanding how EventHorizonLogo, Modal, useToast work
- Modifying pages-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/ModDiffsPage.tsx` | ModDiffsPage, ChangedModList, ChangedModRow, FieldDiffRow, TierBadge (+8) |
| `src/ui/pages/CollectionsPage.tsx` | CollectionsList, refresh, DetailTile, EmptyState, ReceiptDetailModal (+5) |
| `src/ui/pages/PluginDiffsPage.tsx` | PluginDiffsPage, FileSelector, PluginDiffsView, EnabledMismatchList, PluginEntryList (+3) |
| `src/ui/pages/install/steps.tsx` | ConflictRow, PickStep, handlePick, StaleReceiptStep, decisionLabel (+2) |
| `src/ui/pages/AboutPage.tsx` | AboutPage, LinkRow, Stat, handleClick, openExternal |
| `src/ui/errors/ErrorBoundary.tsx` | InlineFallback, PageFallback, render |
| `src/ui/pages/HomePage.tsx` | Dashboard, Hero, HomePage |
| `src/ui/pages/build/BuildPage.tsx` | ImportPreviousButton, handleClick, BuildPage |
| `src/ui/pages/install/InstallPage.tsx` | ErrorRetry, InstallWizard, InstallPage |
| `src/ui/EventHorizonMainPage.tsx` | AppShell, NavBar, RouteOutlet |

## Entry Points

Start here when exploring this area:

- **`EventHorizonLogo`** (Function) — `src/ui/components/EventHorizonLogo.tsx:47`
- **`Modal`** (Function) — `src/ui/components/Modal.tsx:57`
- **`useToast`** (Function) — `src/ui/components/Toast.tsx:50`
- **`useErrorReporter`** (Function) — `src/ui/errors/ErrorContext.tsx:48`
- **`PickStep`** (Function) — `src/ui/pages/install/steps.tsx:197`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `EventHorizonLogo` | Function | `src/ui/components/EventHorizonLogo.tsx` | 47 |
| `Modal` | Function | `src/ui/components/Modal.tsx` | 57 |
| `useToast` | Function | `src/ui/components/Toast.tsx` | 50 |
| `useErrorReporter` | Function | `src/ui/errors/ErrorContext.tsx` | 48 |
| `PickStep` | Function | `src/ui/pages/install/steps.tsx` | 197 |
| `handlePick` | Function | `src/ui/pages/install/steps.tsx` | 207 |
| `StaleReceiptStep` | Function | `src/ui/pages/install/steps.tsx` | 455 |
| `ConcurrentOpBanner` | Function | `src/ui/runtime/ConcurrentOpBanner.tsx` | 17 |
| `nativeNotify` | Function | `src/ui/runtime/nativeNotify.ts` | 39 |
| `useEHRuntime` | Function | `src/ui/runtime/useEHRuntime.ts` | 13 |
| `useApi` | Function | `src/ui/state/ApiContext.tsx` | 33 |
| `useErrorReporterFormatted` | Function | `src/ui/errors/ErrorContext.tsx` | 64 |
| `CollectionsPage` | Function | `src/ui/pages/CollectionsPage.tsx` | 58 |
| `HomePage` | Function | `src/ui/pages/HomePage.tsx` | 48 |
| `ModDiffsPage` | Function | `src/ui/pages/ModDiffsPage.tsx` | 67 |
| `PluginDiffsPage` | Function | `src/ui/pages/PluginDiffsPage.tsx` | 53 |
| `BuildPage` | Function | `src/ui/pages/build/BuildPage.tsx` | 102 |
| `InstallPage` | Function | `src/ui/pages/install/InstallPage.tsx` | 50 |
| `listModDiffFiles` | Function | `src/core/modDiffStorage.ts` | 60 |
| `readModDiffReport` | Function | `src/core/modDiffStorage.ts` | 95 |

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

1. `context({name: "EventHorizonLogo"})` — see callers and callees
2. `query({search_query: "pages"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
