---
name: gitnexus-area-cluster-51
description: "Skill for the Cluster_51 area of vortex-mod-monitor. 7 symbols across 1 files."
---

# Cluster_51

7 symbols | 1 files | Cohesion: 76%

## When to Use

- Working with code in `src/`
- Understanding how parseReceipt work
- Modifying cluster_51-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/installLedger.ts` | expectString, isIso8601, isSemverLike, parseReceipt, passthroughArray (+2) |

## Entry Points

Start here when exploring this area:

- **`parseReceipt`** (Function) — `src/core/installLedger.ts:155`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `parseReceipt` | Function | `src/core/installLedger.ts` | 155 |
| `expectString` | Function | `src/core/installLedger.ts` | 499 |
| `isIso8601` | Function | `src/core/installLedger.ts` | 550 |
| `isSemverLike` | Function | `src/core/installLedger.ts` | 542 |
| `passthroughArray` | Function | `src/core/installLedger.ts` | 300 |
| `passthroughObject` | Function | `src/core/installLedger.ts` | 287 |
| `validateModEntries` | Function | `src/core/installLedger.ts` | 446 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RouteOutlet → InstallLedgerError` | cross_community | 8 |
| `RouteOutlet → ExpectString` | cross_community | 8 |
| `RouteOutlet → IsUuid` | cross_community | 8 |
| `HomePage → IsSemverLike` | cross_community | 7 |
| `WriteReceipt → InstallLedgerError` | cross_community | 4 |
| `WriteReceipt → ExpectString` | cross_community | 4 |
| `WriteReceipt → IsUuid` | cross_community | 4 |
| `WriteReceipt → IsSemverLike` | cross_community | 4 |
| `RunLoadingPipeline → ExpectString` | cross_community | 4 |
| `RunLoadingPipeline → IsSemverLike` | cross_community | 4 |

## How to Explore

1. `context({name: "parseReceipt"})` — see callers and callees
2. `query({search_query: "cluster_51"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
