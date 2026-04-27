---
name: cluster-14
description: "Skill for the Cluster_14 area of vortex-mod-monitor. 5 symbols across 1 files."
---

# Cluster_14

5 symbols | 1 files | Cohesion: 73%

## When to Use

- Working with code in `src/`
- Understanding how getDraftPath, loadDraft, saveDraft work
- Modifying cluster_14-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/draftStorage.ts` | getDraftPath, loadDraft, saveDraft, sanitizeKey, isPlainObject |

## Entry Points

Start here when exploring this area:

- **`getDraftPath`** (Function) — `src/core/draftStorage.ts:85`
- **`loadDraft`** (Function) — `src/core/draftStorage.ts:122`
- **`saveDraft`** (Function) — `src/core/draftStorage.ts:160`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getDraftPath` | Function | `src/core/draftStorage.ts` | 85 |
| `loadDraft` | Function | `src/core/draftStorage.ts` | 122 |
| `saveDraft` | Function | `src/core/draftStorage.ts` | 160 |
| `sanitizeKey` | Function | `src/core/draftStorage.ts` | 224 |
| `isPlainObject` | Function | `src/core/draftStorage.ts` | 231 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `OnBuild → SanitizeKey` | cross_community | 5 |
| `HandleDiscardDraft → SanitizeKey` | cross_community | 5 |
| `Begin → SanitizeKey` | cross_community | 4 |
| `Begin → IsPlainObject` | cross_community | 3 |

## How to Explore

1. `gitnexus_context({name: "getDraftPath"})` — see callers and callees
2. `gitnexus_query({query: "cluster_14"})` — find related execution flows
3. Read key files listed above for implementation details
