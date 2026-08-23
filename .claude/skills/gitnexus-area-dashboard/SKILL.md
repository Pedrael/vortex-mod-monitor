---
name: gitnexus-area-dashboard
description: "Skill for the Dashboard area of vortex-mod-monitor. 6 symbols across 2 files."
---

# Dashboard

6 symbols | 2 files | Cohesion: 67%

## When to Use

- Working with code in `src/`
- Understanding how getInstallLedgerDir, listReceipts, loadDashboardData work
- Modifying dashboard-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/dashboard/data.ts` | loadBuiltPackages, loadCuratorConfigs, loadDashboardData, loadReceipts |
| `src/core/installLedger.ts` | getInstallLedgerDir, listReceipts |

## Entry Points

Start here when exploring this area:

- **`getInstallLedgerDir`** (Function) — `src/core/installLedger.ts:140`
- **`listReceipts`** (Function) — `src/core/installLedger.ts:408`
- **`loadDashboardData`** (Function) — `src/ui/pages/dashboard/data.ts:107`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getInstallLedgerDir` | Function | `src/core/installLedger.ts` | 140 |
| `listReceipts` | Function | `src/core/installLedger.ts` | 408 |
| `loadDashboardData` | Function | `src/ui/pages/dashboard/data.ts` | 107 |
| `loadBuiltPackages` | Function | `src/ui/pages/dashboard/data.ts` | 253 |
| `loadCuratorConfigs` | Function | `src/ui/pages/dashboard/data.ts` | 183 |
| `loadReceipts` | Function | `src/ui/pages/dashboard/data.ts` | 155 |

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
| `Dashboard → LoadBuiltPackages` | cross_community | 3 |

## How to Explore

1. `context({name: "getInstallLedgerDir"})` — see callers and callees
2. `query({search_query: "dashboard"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
