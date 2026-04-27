---
name: cluster-16
description: "Skill for the Cluster_16 area of vortex-mod-monitor. 3 symbols across 1 files."
---

# Cluster_16

3 symbols | 1 files | Cohesion: 40%

## When to Use

- Working with code in `src/`
- Understanding how getReceiptPath, InstallLedgerError work
- Modifying cluster_16-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/installLedger.ts` | InstallLedgerError, getReceiptPath, isUuid |

## Entry Points

Start here when exploring this area:

- **`getReceiptPath`** (Function) — `src/core/installLedger.ts:124`
- **`InstallLedgerError`** (Class) — `src/core/installLedger.ts:70`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `InstallLedgerError` | Class | `src/core/installLedger.ts` | 70 |
| `getReceiptPath` | Function | `src/core/installLedger.ts` | 124 |
| `isUuid` | Function | `src/core/installLedger.ts` | 535 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Dashboard → InstallLedgerError` | cross_community | 6 |
| `Dashboard → IsUuid` | cross_community | 5 |
| `LoadDashboardData → IsUuid` | cross_community | 5 |
| `WriteReceiptWithRetry → InstallLedgerError` | cross_community | 5 |
| `WriteReceiptWithRetry → IsUuid` | cross_community | 5 |
| `HandleUninstall → InstallLedgerError` | cross_community | 4 |
| `HandleUninstall → IsUuid` | cross_community | 4 |
| `HandleDelete → InstallLedgerError` | cross_community | 4 |
| `HandleDelete → IsUuid` | cross_community | 4 |

## How to Explore

1. `gitnexus_context({name: "getReceiptPath"})` — see callers and callees
2. `gitnexus_query({query: "cluster_16"})` — find related execution flows
3. Read key files listed above for implementation details
