---
name: gitnexus-area-pages
description: "Skill for the Pages area of Event-Horizon. 42 symbols across 13 files."
---

# Pages

42 symbols | 13 files | Cohesion: 72%

## When to Use

- Working with code in `src/`
- Understanding how useErrorReporterFormatted, CollectionsPage, HomePage work
- Modifying pages-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/ModDiffsPage.tsx` | ModDiffsPage, ChangedModList, ChangedModRow, FieldDiffRow, TierBadge (+8) |
| `src/ui/pages/PluginDiffsPage.tsx` | PluginDiffsPage, FileSelector, PluginDiffsView, EnabledMismatchList, PluginEntryList (+3) |
| `src/ui/pages/AboutPage.tsx` | AboutPage, LinkRow, Stat, handleClick, openExternal |
| `src/ui/EventHorizonMainPage.tsx` | AppShell, NavBar, RouteOutlet |
| `src/core/modDiffStorage.ts` | listModDiffFiles, parseFilename, readModDiffReport |
| `src/core/pluginDiffStorage.ts` | listPluginDiffFiles, parseFilename, readPluginDiffReport |
| `src/ui/errors/ErrorContext.tsx` | useErrorReporterFormatted |
| `src/ui/pages/CollectionsPage.tsx` | CollectionsPage |
| `src/ui/pages/HomePage.tsx` | HomePage |
| `src/ui/pages/build/BuildPage.tsx` | BuildPage |

## Entry Points

Start here when exploring this area:

- **`useErrorReporterFormatted`** (Function) — `src/ui/errors/ErrorContext.tsx:65`
- **`CollectionsPage`** (Function) — `src/ui/pages/CollectionsPage.tsx:90`
- **`HomePage`** (Function) — `src/ui/pages/HomePage.tsx:48`
- **`ModDiffsPage`** (Function) — `src/ui/pages/ModDiffsPage.tsx:67`
- **`PluginDiffsPage`** (Function) — `src/ui/pages/PluginDiffsPage.tsx:53`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `useErrorReporterFormatted` | Function | `src/ui/errors/ErrorContext.tsx` | 65 |
| `CollectionsPage` | Function | `src/ui/pages/CollectionsPage.tsx` | 90 |
| `HomePage` | Function | `src/ui/pages/HomePage.tsx` | 48 |
| `ModDiffsPage` | Function | `src/ui/pages/ModDiffsPage.tsx` | 67 |
| `PluginDiffsPage` | Function | `src/ui/pages/PluginDiffsPage.tsx` | 53 |
| `BuildPage` | Function | `src/ui/pages/build/BuildPage.tsx` | 114 |
| `InstallPage` | Function | `src/ui/pages/install/InstallPage.tsx` | 50 |
| `listModDiffFiles` | Function | `src/core/modDiffStorage.ts` | 60 |
| `readModDiffReport` | Function | `src/core/modDiffStorage.ts` | 95 |
| `listPluginDiffFiles` | Function | `src/core/pluginDiffStorage.ts` | 60 |
| `readPluginDiffReport` | Function | `src/core/pluginDiffStorage.ts` | 95 |
| `DiffSectionBlock` | Function | `src/ui/components/DiffSectionBlock.tsx` | 33 |
| `Page` | Function | `src/ui/components/Page.tsx` | 26 |
| `AboutPage` | Function | `src/ui/pages/AboutPage.tsx` | 21 |
| `AppShell` | Function | `src/ui/EventHorizonMainPage.tsx` | 87 |
| `NavBar` | Function | `src/ui/EventHorizonMainPage.tsx` | 112 |
| `RouteOutlet` | Function | `src/ui/EventHorizonMainPage.tsx` | 169 |
| `ChangedModList` | Function | `src/ui/pages/ModDiffsPage.tsx` | 413 |
| `ChangedModRow` | Function | `src/ui/pages/ModDiffsPage.tsx` | 447 |
| `FieldDiffRow` | Function | `src/ui/pages/ModDiffsPage.tsx` | 573 |

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
| `BuildPage → NotifyStateChanged` | cross_community | 6 |
| `ReportView → FormatFieldValue` | cross_community | 5 |

## How to Explore

1. `context({name: "useErrorReporterFormatted"})` — see callers and callees
2. `query({search_query: "pages"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
