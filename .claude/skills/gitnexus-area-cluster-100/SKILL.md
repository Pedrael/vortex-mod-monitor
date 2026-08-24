---
name: gitnexus-area-cluster-100
description: "Skill for the Cluster_100 area of vortex-mod-monitor. 4 symbols across 1 files."
---

# Cluster_100

4 symbols | 1 files | Cohesion: 80%

## When to Use

- Working with code in `src/`
- Understanding how captureUserlist work
- Modifying cluster_100-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/userlist.ts` | captureGroupEntries, capturePluginEntries, captureUserlist, readReferenceList |

## Entry Points

Start here when exploring this area:

- **`captureUserlist`** (Function) — `src/core/userlist.ts:91`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `captureUserlist` | Function | `src/core/userlist.ts` | 91 |
| `captureGroupEntries` | Function | `src/core/userlist.ts` | 153 |
| `capturePluginEntries` | Function | `src/core/userlist.ts` | 115 |
| `readReferenceList` | Function | `src/core/userlist.ts` | 180 |

## How to Explore

1. `context({name: "captureUserlist"})` — see callers and callees
2. `query({search_query: "cluster_100"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
