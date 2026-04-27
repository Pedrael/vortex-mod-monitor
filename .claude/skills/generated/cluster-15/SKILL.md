---
name: cluster-15
description: "Skill for the Cluster_15 area of vortex-mod-monitor. 4 symbols across 1 files."
---

# Cluster_15

4 symbols | 1 files | Cohesion: 80%

## When to Use

- Working with code in `src/`
- Understanding how captureUserlist work
- Modifying cluster_15-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/userlist.ts` | captureUserlist, capturePluginEntries, captureGroupEntries, readReferenceList |

## Entry Points

Start here when exploring this area:

- **`captureUserlist`** (Function) — `src/core/userlist.ts:91`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `captureUserlist` | Function | `src/core/userlist.ts` | 91 |
| `capturePluginEntries` | Function | `src/core/userlist.ts` | 115 |
| `captureGroupEntries` | Function | `src/core/userlist.ts` | 153 |
| `readReferenceList` | Function | `src/core/userlist.ts` | 180 |

## How to Explore

1. `gitnexus_context({name: "captureUserlist"})` — see callers and callees
2. `gitnexus_query({query: "cluster_15"})` — find related execution flows
3. Read key files listed above for implementation details
