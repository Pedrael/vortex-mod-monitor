---
name: cluster-12
description: "Skill for the Cluster_12 area of vortex-mod-monitor. 6 symbols across 1 files."
---

# Cluster_12

6 symbols | 1 files | Cohesion: 71%

## When to Use

- Working with code in `src/`
- Understanding how getDraftPath, loadDraft work
- Modifying cluster_12-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/draftStorage.ts` | getDraftPath, loadDraft, readDraftFile, migrateV1Payload, sanitizeKey (+1) |

## Entry Points

Start here when exploring this area:

- **`getDraftPath`** (Function) — `src/core/draftStorage.ts:100`
- **`loadDraft`** (Function) — `src/core/draftStorage.ts:142`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getDraftPath` | Function | `src/core/draftStorage.ts` | 100 |
| `loadDraft` | Function | `src/core/draftStorage.ts` | 142 |
| `readDraftFile` | Function | `src/core/draftStorage.ts` | 195 |
| `migrateV1Payload` | Function | `src/core/draftStorage.ts` | 358 |
| `sanitizeKey` | Function | `src/core/draftStorage.ts` | 463 |
| `isPlainObject` | Function | `src/core/draftStorage.ts` | 470 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `OnBuild → SanitizeKey` | cross_community | 6 |
| `HandleDiscardDraft → SanitizeKey` | cross_community | 5 |
| `HandleUpdatePublished → SanitizeKey` | cross_community | 4 |
| `HandleDiscardDraft → SanitizeKey` | cross_community | 4 |
| `Begin → IsPlainObject` | cross_community | 4 |
| `Begin → MigrateV1Payload` | cross_community | 4 |
| `Begin → SanitizeKey` | cross_community | 4 |

## How to Explore

1. `gitnexus_context({name: "getDraftPath"})` — see callers and callees
2. `gitnexus_query({query: "cluster_12"})` — find related execution flows
3. Read key files listed above for implementation details
