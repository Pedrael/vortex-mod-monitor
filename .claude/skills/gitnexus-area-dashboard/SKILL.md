---
name: gitnexus-area-dashboard
description: "Skill for the Dashboard area of Event-Horizon. 5 symbols across 2 files."
---

# Dashboard

5 symbols | 2 files | Cohesion: 53%

## When to Use

- Working with code in `src/`
- Understanding how getCollectionsConfigDir, getCollectionsDir, loadDashboardData work
- Modifying dashboard-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/dashboard/data.ts` | loadBuiltPackages, loadCuratorConfigs, loadDashboardData |
| `src/core/paths.ts` | getCollectionsConfigDir, getCollectionsDir |

## Entry Points

Start here when exploring this area:

- **`getCollectionsConfigDir`** (Function) — `src/core/paths.ts:71`
- **`getCollectionsDir`** (Function) — `src/core/paths.ts:66`
- **`loadDashboardData`** (Function) — `src/ui/pages/dashboard/data.ts:108`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getCollectionsConfigDir` | Function | `src/core/paths.ts` | 71 |
| `getCollectionsDir` | Function | `src/core/paths.ts` | 66 |
| `loadDashboardData` | Function | `src/ui/pages/dashboard/data.ts` | 108 |
| `loadBuiltPackages` | Function | `src/ui/pages/dashboard/data.ts` | 249 |
| `loadCuratorConfigs` | Function | `src/ui/pages/dashboard/data.ts` | 184 |

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

1. `context({name: "getCollectionsConfigDir"})` — see callers and callees
2. `query({search_query: "dashboard"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
