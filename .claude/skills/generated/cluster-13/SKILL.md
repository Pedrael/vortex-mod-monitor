---
name: cluster-13
description: "Skill for the Cluster_13 area of vortex-mod-monitor. 5 symbols across 1 files."
---

# Cluster_13

5 symbols | 1 files | Cohesion: 71%

## When to Use

- Working with code in `src/`
- Understanding how parseReceipt work
- Modifying cluster_13-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/installLedger.ts` | parseReceipt, validateModEntries, expectString, isSemverLike, isIso8601 |

## Entry Points

Start here when exploring this area:

- **`parseReceipt`** (Function) — `src/core/installLedger.ts:152`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `parseReceipt` | Function | `src/core/installLedger.ts` | 152 |
| `validateModEntries` | Function | `src/core/installLedger.ts` | 380 |
| `expectString` | Function | `src/core/installLedger.ts` | 433 |
| `isSemverLike` | Function | `src/core/installLedger.ts` | 476 |
| `isIso8601` | Function | `src/core/installLedger.ts` | 484 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Dashboard → InstallLedgerError` | cross_community | 6 |
| `LoadDashboardData → ExpectString` | cross_community | 5 |
| `LoadDashboardData → IsUuid` | cross_community | 5 |
| `LoadDashboardData → IsSemverLike` | cross_community | 5 |
| `WriteReceiptWithRetry → InstallLedgerError` | cross_community | 5 |
| `WriteReceiptWithRetry → ExpectString` | cross_community | 5 |
| `WriteReceiptWithRetry → IsUuid` | cross_community | 5 |
| `WriteReceiptWithRetry → IsSemverLike` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Errors | 2 calls |

## How to Explore

1. `gitnexus_context({name: "parseReceipt"})` — see callers and callees
2. `gitnexus_query({query: "cluster_13"})` — find related execution flows
3. Read key files listed above for implementation details
