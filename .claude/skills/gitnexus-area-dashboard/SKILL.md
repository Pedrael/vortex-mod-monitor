---
name: gitnexus-area-dashboard
description: "Skill for the Dashboard area of vortex-mod-monitor. 7 symbols across 2 files."
---

# Dashboard

7 symbols | 2 files | Cohesion: 58%

## When to Use

- Working with code in `src/`
- Understanding how getCollectionsConfigDir, getCollectionsDir, getEventHorizonDir work
- Modifying dashboard-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/paths.ts` | getCollectionsConfigDir, getCollectionsDir, getEventHorizonDir, getEventHorizonRoot |
| `src/ui/pages/dashboard/data.ts` | loadBuiltPackages, loadCuratorConfigs, loadDashboardData |

## Entry Points

Start here when exploring this area:

- **`getCollectionsConfigDir`** (Function) — `src/core/paths.ts:71`
- **`getCollectionsDir`** (Function) — `src/core/paths.ts:66`
- **`getEventHorizonDir`** (Function) — `src/core/paths.ts:53`
- **`getEventHorizonRoot`** (Function) — `src/core/paths.ts:43`
- **`loadDashboardData`** (Function) — `src/ui/pages/dashboard/data.ts:108`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getCollectionsConfigDir` | Function | `src/core/paths.ts` | 71 |
| `getCollectionsDir` | Function | `src/core/paths.ts` | 66 |
| `getEventHorizonDir` | Function | `src/core/paths.ts` | 53 |
| `getEventHorizonRoot` | Function | `src/core/paths.ts` | 43 |
| `loadDashboardData` | Function | `src/ui/pages/dashboard/data.ts` | 108 |
| `loadBuiltPackages` | Function | `src/ui/pages/dashboard/data.ts` | 249 |
| `loadCuratorConfigs` | Function | `src/ui/pages/dashboard/data.ts` | 184 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ExecuteDecision → GetEventHorizonDir` | cross_community | 10 |
| `OnDidInstall → GetVortexUserDataPath` | cross_community | 9 |
| `Init → GetVortexUserDataPath` | cross_community | 9 |
| `RouteOutlet → InstallLedgerError` | cross_community | 8 |
| `CreateBuildPackageAction → GetVortexUserDataPath` | cross_community | 8 |
| `BuildWizard → GetVortexUserDataPath` | cross_community | 8 |
| `RouteOutlet → GetInstallLedgerDir` | cross_community | 7 |
| `RouteOutlet → IsUuid` | cross_community | 7 |
| `RouteOutlet → BelongsToGame` | cross_community | 7 |
| `HomePage → ExpectString` | cross_community | 7 |

## How to Explore

1. `context({name: "getCollectionsConfigDir"})` — see callers and callees
2. `query({search_query: "dashboard"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
