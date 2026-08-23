---
name: gitnexus-area-pages
description: "Skill for the Pages area of vortex-mod-monitor. 37 symbols across 12 files."
---

# Pages

37 symbols | 12 files | Cohesion: 76%

## When to Use

- Working with code in `src/`
- Understanding how useErrorReporterFormatted, CollectionsPage, HomePage work
- Modifying pages-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/ModDiffsPage.tsx` | ModDiffsPage, FileSelector, ModDiffsView, ModEntryList, ReportView (+5) |
| `src/ui/pages/PluginDiffsPage.tsx` | PluginDiffsPage, FileSelector, PluginDiffsView, EnabledMismatchList, PluginEntryList (+3) |
| `src/ui/EventHorizonMainPage.tsx` | AppShell, NavBar, RouteOutlet |
| `src/ui/pages/HomePage.tsx` | HomePage, onClickMo2, runMo2Export |
| `src/core/modDiffStorage.ts` | listModDiffFiles, parseFilename, readModDiffReport |
| `src/core/pluginDiffStorage.ts` | listPluginDiffFiles, parseFilename, readPluginDiffReport |
| `src/ui/pages/AboutPage.tsx` | handleClick, openExternal |
| `src/ui/errors/ErrorContext.tsx` | useErrorReporterFormatted |
| `src/ui/pages/CollectionsPage.tsx` | CollectionsPage |
| `src/ui/pages/build/BuildPage.tsx` | BuildPage |

## Entry Points

Start here when exploring this area:

- **`useErrorReporterFormatted`** (Function) — `src/ui/errors/ErrorContext.tsx:64`
- **`CollectionsPage`** (Function) — `src/ui/pages/CollectionsPage.tsx:56`
- **`HomePage`** (Function) — `src/ui/pages/HomePage.tsx:49`
- **`ModDiffsPage`** (Function) — `src/ui/pages/ModDiffsPage.tsx:60`
- **`PluginDiffsPage`** (Function) — `src/ui/pages/PluginDiffsPage.tsx:52`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `useErrorReporterFormatted` | Function | `src/ui/errors/ErrorContext.tsx` | 64 |
| `CollectionsPage` | Function | `src/ui/pages/CollectionsPage.tsx` | 56 |
| `HomePage` | Function | `src/ui/pages/HomePage.tsx` | 49 |
| `ModDiffsPage` | Function | `src/ui/pages/ModDiffsPage.tsx` | 60 |
| `PluginDiffsPage` | Function | `src/ui/pages/PluginDiffsPage.tsx` | 52 |
| `BuildPage` | Function | `src/ui/pages/build/BuildPage.tsx` | 75 |
| `InstallPage` | Function | `src/ui/pages/install/InstallPage.tsx` | 50 |
| `listModDiffFiles` | Function | `src/core/modDiffStorage.ts` | 60 |
| `readModDiffReport` | Function | `src/core/modDiffStorage.ts` | 95 |
| `listPluginDiffFiles` | Function | `src/core/pluginDiffStorage.ts` | 60 |
| `readPluginDiffReport` | Function | `src/core/pluginDiffStorage.ts` | 95 |
| `DiffSectionBlock` | Function | `src/ui/components/DiffSectionBlock.tsx` | 33 |
| `AppShell` | Function | `src/ui/EventHorizonMainPage.tsx` | 86 |
| `NavBar` | Function | `src/ui/EventHorizonMainPage.tsx` | 111 |
| `RouteOutlet` | Function | `src/ui/EventHorizonMainPage.tsx` | 168 |
| `parseFilename` | Function | `src/core/modDiffStorage.ts` | 44 |
| `FileSelector` | Function | `src/ui/pages/ModDiffsPage.tsx` | 209 |
| `ModDiffsView` | Function | `src/ui/pages/ModDiffsPage.tsx` | 77 |
| `parseFilename` | Function | `src/core/pluginDiffStorage.ts` | 44 |
| `FileSelector` | Function | `src/ui/pages/PluginDiffsPage.tsx` | 206 |

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
| `ReportView → FormatFieldValue` | cross_community | 5 |

## How to Explore

1. `context({name: "useErrorReporterFormatted"})` — see callers and callees
2. `query({search_query: "pages"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
