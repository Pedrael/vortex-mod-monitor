---
name: dashboard
description: "Skill for the Dashboard area of vortex-mod-monitor. 7 symbols across 3 files."
---

# Dashboard

7 symbols | 3 files | Cohesion: 71%

## When to Use

- Working with code in `src/`
- Understanding how getInstallLedgerDir, listReceipts, onError work
- Modifying dashboard-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/dashboard/data.ts` | loadDashboardData, loadReceipts, loadCuratorConfigs, loadBuiltPackages |
| `src/core/installLedger.ts` | getInstallLedgerDir, listReceipts |
| `src/ui/errors/ErrorContext.tsx` | onError |

## Entry Points

Start here when exploring this area:

- **`getInstallLedgerDir`** (Function) — `src/core/installLedger.ts:140`
- **`listReceipts`** (Function) — `src/core/installLedger.ts:408`
- **`onError`** (Function) — `src/ui/errors/ErrorContext.tsx:121`
- **`loadDashboardData`** (Function) — `src/ui/pages/dashboard/data.ts:107`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getInstallLedgerDir` | Function | `src/core/installLedger.ts` | 140 |
| `listReceipts` | Function | `src/core/installLedger.ts` | 408 |
| `onError` | Function | `src/ui/errors/ErrorContext.tsx` | 121 |
| `loadDashboardData` | Function | `src/ui/pages/dashboard/data.ts` | 107 |
| `loadReceipts` | Function | `src/ui/pages/dashboard/data.ts` | 155 |
| `loadCuratorConfigs` | Function | `src/ui/pages/dashboard/data.ts` | 183 |
| `loadBuiltPackages` | Function | `src/ui/pages/dashboard/data.ts` | 253 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Dashboard → InstallLedgerError` | cross_community | 6 |
| `Dashboard → GetInstallLedgerDir` | cross_community | 5 |
| `Dashboard → IsUuid` | cross_community | 5 |
| `Dashboard → OnError` | cross_community | 5 |
| `LoadDashboardData → ExpectString` | cross_community | 5 |
| `LoadDashboardData → IsUuid` | cross_community | 5 |
| `LoadDashboardData → IsSemverLike` | cross_community | 5 |
| `Dashboard → GetState` | cross_community | 4 |
| `Dashboard → GetActiveGameId` | cross_community | 4 |
| `Dashboard → GetActiveProfileIdFromState` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Cluster_16 | 1 calls |
| Cluster_18 | 1 calls |
| Resolver | 1 calls |

## How to Explore

1. `gitnexus_context({name: "getInstallLedgerDir"})` — see callers and callees
2. `gitnexus_query({query: "dashboard"})` — find related execution flows
3. Read key files listed above for implementation details
