---
name: dashboard
description: "Skill for the Dashboard area of vortex-mod-monitor. 4 symbols across 1 files."
---

# Dashboard

4 symbols | 1 files | Cohesion: 67%

## When to Use

- Working with code in `src/`
- Understanding how loadDashboardData work
- Modifying dashboard-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/dashboard/data.ts` | loadDashboardData, loadReceipts, loadCuratorConfigs, loadBuiltPackages |

## Entry Points

Start here when exploring this area:

- **`loadDashboardData`** (Function) — `src/ui/pages/dashboard/data.ts:107`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `loadDashboardData` | Function | `src/ui/pages/dashboard/data.ts` | 107 |
| `loadReceipts` | Function | `src/ui/pages/dashboard/data.ts` | 155 |
| `loadCuratorConfigs` | Function | `src/ui/pages/dashboard/data.ts` | 183 |
| `loadBuiltPackages` | Function | `src/ui/pages/dashboard/data.ts` | 253 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Dashboard → InstallLedgerError` | cross_community | 6 |
| `Dashboard → ExpectString` | cross_community | 6 |
| `Dashboard → GetInstallLedgerDir` | cross_community | 5 |
| `Dashboard → IsUuid` | cross_community | 5 |
| `Dashboard → OnError` | cross_community | 5 |
| `LoadDashboardData → IsUuid` | cross_community | 5 |
| `LoadDashboardData → IsSemverLike` | cross_community | 5 |
| `Dashboard → GetState` | cross_community | 4 |
| `Dashboard → GetActiveGameId` | cross_community | 4 |
| `Dashboard → GetActiveProfileIdFromState` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Resolver | 1 calls |
| Installer | 1 calls |

## How to Explore

1. `gitnexus_context({name: "loadDashboardData"})` — see callers and callees
2. `gitnexus_query({query: "dashboard"})` — find related execution flows
3. Read key files listed above for implementation details
