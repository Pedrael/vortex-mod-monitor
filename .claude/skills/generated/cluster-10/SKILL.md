---
name: cluster-10
description: "Skill for the Cluster_10 area of vortex-mod-monitor. 3 symbols across 1 files."
---

# Cluster_10

3 symbols | 1 files | Cohesion: 40%

## When to Use

- Working with code in `src/`
- Understanding how getReceiptPath, InstallLedgerError work
- Modifying cluster_10-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/installLedger.ts` | InstallLedgerError, getReceiptPath, isUuid |

## Entry Points

Start here when exploring this area:

- **`getReceiptPath`** (Function) — `src/core/installLedger.ts:121`
- **`InstallLedgerError`** (Class) — `src/core/installLedger.ts:67`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `InstallLedgerError` | Class | `src/core/installLedger.ts` | 67 |
| `getReceiptPath` | Function | `src/core/installLedger.ts` | 121 |
| `isUuid` | Function | `src/core/installLedger.ts` | 469 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Dashboard → InstallLedgerError` | cross_community | 6 |
| `Dashboard → IsUuid` | cross_community | 5 |
| `LoadDashboardData → IsUuid` | cross_community | 5 |
| `HandleUninstall → InstallLedgerError` | cross_community | 4 |
| `HandleUninstall → IsUuid` | cross_community | 4 |
| `HandleDelete → InstallLedgerError` | cross_community | 4 |
| `HandleDelete → IsUuid` | cross_community | 4 |
| `WriteReceipt → InstallLedgerError` | cross_community | 4 |
| `WriteReceipt → IsUuid` | cross_community | 4 |

## How to Explore

1. `gitnexus_context({name: "getReceiptPath"})` — see callers and callees
2. `gitnexus_query({query: "cluster_10"})` — find related execution flows
3. Read key files listed above for implementation details
