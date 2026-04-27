---
name: pages
description: "Skill for the Pages area of vortex-mod-monitor. 12 symbols across 8 files."
---

# Pages

12 symbols | 8 files | Cohesion: 95%

## When to Use

- Working with code in `src/`
- Understanding how HomePage, CollectionsPage, useErrorReporterFormatted work
- Modifying pages-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/HomePage.tsx` | HomePage, PlayerPanel, CuratorPanel |
| `src/ui/pages/dashboard/data.ts` | formatBytes, formatRelativeTime |
| `src/ui/pages/AboutPage.tsx` | handleClick, openExternal |
| `src/ui/EventHorizonMainPage.tsx` | AppShell |
| `src/ui/pages/CollectionsPage.tsx` | CollectionsPage |
| `src/ui/errors/ErrorContext.tsx` | useErrorReporterFormatted |
| `src/ui/pages/install/InstallPage.tsx` | InstallPage |
| `src/ui/pages/build/BuildPage.tsx` | BuildPage |

## Entry Points

Start here when exploring this area:

- **`HomePage`** (Function) — `src/ui/pages/HomePage.tsx:48`
- **`CollectionsPage`** (Function) — `src/ui/pages/CollectionsPage.tsx:56`
- **`useErrorReporterFormatted`** (Function) — `src/ui/errors/ErrorContext.tsx:64`
- **`InstallPage`** (Function) — `src/ui/pages/install/InstallPage.tsx:50`
- **`BuildPage`** (Function) — `src/ui/pages/build/BuildPage.tsx:72`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `HomePage` | Function | `src/ui/pages/HomePage.tsx` | 48 |
| `CollectionsPage` | Function | `src/ui/pages/CollectionsPage.tsx` | 56 |
| `useErrorReporterFormatted` | Function | `src/ui/errors/ErrorContext.tsx` | 64 |
| `InstallPage` | Function | `src/ui/pages/install/InstallPage.tsx` | 50 |
| `BuildPage` | Function | `src/ui/pages/build/BuildPage.tsx` | 72 |
| `formatBytes` | Function | `src/ui/pages/dashboard/data.ts` | 307 |
| `formatRelativeTime` | Function | `src/ui/pages/dashboard/data.ts` | 314 |
| `AppShell` | Function | `src/ui/EventHorizonMainPage.tsx` | 84 |
| `PlayerPanel` | Function | `src/ui/pages/HomePage.tsx` | 422 |
| `CuratorPanel` | Function | `src/ui/pages/HomePage.tsx` | 564 |
| `handleClick` | Function | `src/ui/pages/AboutPage.tsx` | 242 |
| `openExternal` | Function | `src/ui/pages/AboutPage.tsx` | 273 |

## How to Explore

1. `gitnexus_context({name: "HomePage"})` — see callers and callees
2. `gitnexus_query({query: "pages"})` — find related execution flows
3. Read key files listed above for implementation details
