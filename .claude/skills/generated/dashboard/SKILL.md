---
name: dashboard
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
| `src/ui/pages/dashboard/data.ts` | loadDashboardData, loadReceipts, loadCuratorConfigs, loadBuiltPackages |
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
| `loadReceipts` | Function | `src/ui/pages/dashboard/data.ts` | 155 |
| `loadCuratorConfigs` | Function | `src/ui/pages/dashboard/data.ts` | 183 |
| `loadBuiltPackages` | Function | `src/ui/pages/dashboard/data.ts` | 253 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `HomePage → InstallLedgerError` | cross_community | 7 |
| `Dashboard → ExpectString` | cross_community | 6 |
| `Dashboard → IsUuid` | cross_community | 6 |
| `HomePage → GetInstallLedgerDir` | cross_community | 6 |
| `HomePage → IsUuid` | cross_community | 6 |
| `LoadDashboardData → IsSemverLike` | cross_community | 5 |
| `CollectionsPage → InstallLedgerError` | cross_community | 5 |
| `CollectionsPage → ExpectString` | cross_community | 5 |
| `CollectionsPage → IsUuid` | cross_community | 5 |
| `CollectionsPage → IsSemverLike` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Install | 1 calls |
| Cluster_22 | 1 calls |
| Resolver | 1 calls |

## How to Explore

1. `gitnexus_context({name: "getInstallLedgerDir"})` — see callers and callees
2. `gitnexus_query({query: "dashboard"})` — find related execution flows
3. Read key files listed above for implementation details
