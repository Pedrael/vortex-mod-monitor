---
name: gitnexus-area-cluster-266
description: "Skill for the Cluster_266 area of Event-Horizon. 4 symbols across 2 files."
---

# Cluster_266

4 symbols | 2 files | Cohesion: 60%

## When to Use

- Working with code in `src/`
- Understanding how openExternalUrl work
- Modifying cluster_266-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/revealPath.ts` | describe, loadShell, openExternalUrl |
| `src/core/revealPath.test.ts` | openExternal |

## Entry Points

Start here when exploring this area:

- **`openExternalUrl`** (Function) — `src/core/revealPath.ts:139`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `openExternalUrl` | Function | `src/core/revealPath.ts` | 139 |
| `openExternal` | Function | `src/core/revealPath.test.ts` | 129 |
| `describe` | Function | `src/core/revealPath.ts` | 99 |
| `loadShell` | Function | `src/core/revealPath.ts` | 109 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ExternalDownloadGuide → Opn` | cross_community | 4 |
| `ExternalDownloadGuide → Opn` | cross_community | 4 |
| `ExternalDownloadGuide → Opn` | cross_community | 4 |
| `ExternalDownloadGuide → Opn` | cross_community | 4 |
| `HandleShowInFolder → Describe` | cross_community | 3 |
| `HandleShowInFolder → LoadShell` | cross_community | 3 |
| `ExternalDownloadGuide → OpenExternal` | cross_community | 3 |
| `ExternalDownloadGuide → Describe` | cross_community | 3 |
| `ExternalDownloadGuide → LoadShell` | cross_community | 3 |

## How to Explore

1. `context({name: "openExternalUrl"})` — see callers and callees
2. `query({search_query: "cluster_266"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
