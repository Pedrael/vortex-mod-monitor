---
name: gitnexus-area-cluster-50
description: "Skill for the Cluster_50 area of vortex-mod-monitor. 7 symbols across 1 files."
---

# Cluster_50

7 symbols | 1 files | Cohesion: 78%

## When to Use

- Working with code in `src/`
- Understanding how getDraftPath, loadDraft, saveDraft work
- Modifying cluster_50-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/draftStorage.ts` | getDraftPath, isPlainObject, loadDraft, migrateV1Payload, readDraftFile (+2) |

## Entry Points

Start here when exploring this area:

- **`getDraftPath`** (Function) — `src/core/draftStorage.ts:101`
- **`loadDraft`** (Function) — `src/core/draftStorage.ts:142`
- **`saveDraft`** (Function) — `src/core/draftStorage.ts:399`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getDraftPath` | Function | `src/core/draftStorage.ts` | 101 |
| `loadDraft` | Function | `src/core/draftStorage.ts` | 142 |
| `saveDraft` | Function | `src/core/draftStorage.ts` | 399 |
| `isPlainObject` | Function | `src/core/draftStorage.ts` | 470 |
| `migrateV1Payload` | Function | `src/core/draftStorage.ts` | 358 |
| `readDraftFile` | Function | `src/core/draftStorage.ts` | 195 |
| `sanitizeKey` | Function | `src/core/draftStorage.ts` | 463 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `BuildPage → IsPlainObject` | cross_community | 5 |
| `BuildPage → MigrateV1Payload` | cross_community | 5 |
| `BuildPage → SanitizeKey` | cross_community | 5 |
| `HandleDiscardDraft → SanitizeKey` | cross_community | 5 |
| `HandleDiscardDraft → SanitizeKey` | cross_community | 4 |
| `Handle → SanitizeKey` | cross_community | 4 |
| `LoadDraft → IsPlainObject` | intra_community | 3 |
| `LoadDraft → MigrateV1Payload` | intra_community | 3 |
| `LoadDraft → SanitizeKey` | intra_community | 3 |

## How to Explore

1. `context({name: "getDraftPath"})` — see callers and callees
2. `query({search_query: "cluster_50"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
