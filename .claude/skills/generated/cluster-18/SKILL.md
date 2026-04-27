---
name: cluster-18
description: "Skill for the Cluster_18 area of vortex-mod-monitor. 7 symbols across 1 files."
---

# Cluster_18

7 symbols | 1 files | Cohesion: 76%

## When to Use

- Working with code in `src/`
- Understanding how parseReceipt work
- Modifying cluster_18-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/installLedger.ts` | parseReceipt, passthroughObject, passthroughArray, validateModEntries, expectString (+2) |

## Entry Points

Start here when exploring this area:

- **`parseReceipt`** (Function) — `src/core/installLedger.ts:155`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `parseReceipt` | Function | `src/core/installLedger.ts` | 155 |
| `passthroughObject` | Function | `src/core/installLedger.ts` | 287 |
| `passthroughArray` | Function | `src/core/installLedger.ts` | 300 |
| `validateModEntries` | Function | `src/core/installLedger.ts` | 446 |
| `expectString` | Function | `src/core/installLedger.ts` | 499 |
| `isSemverLike` | Function | `src/core/installLedger.ts` | 542 |
| `isIso8601` | Function | `src/core/installLedger.ts` | 550 |

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
| Cluster_16 | 2 calls |

## How to Explore

1. `gitnexus_context({name: "parseReceipt"})` — see callers and callees
2. `gitnexus_query({query: "cluster_18"})` — find related execution flows
3. Read key files listed above for implementation details
