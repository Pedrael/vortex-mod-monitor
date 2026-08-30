---
name: gitnexus-area-testing
description: "Skill for the Testing area of Event-Horizon. 3 symbols across 1 files."
---

# Testing

3 symbols | 1 files | Cohesion: 100%

## When to Use

- Working with code in `src/`
- Understanding how add, extractFull, result work
- Modifying testing-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/manifest/testing/fakeSevenZip.ts` | add, extractFull, result |

## Entry Points

Start here when exploring this area:

- **`add`** (Function) — `src/core/manifest/testing/fakeSevenZip.ts:78`
- **`extractFull`** (Function) — `src/core/manifest/testing/fakeSevenZip.ts:74`
- **`result`** (Function) — `src/core/manifest/testing/fakeSevenZip.ts:51`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `add` | Function | `src/core/manifest/testing/fakeSevenZip.ts` | 78 |
| `extractFull` | Function | `src/core/manifest/testing/fakeSevenZip.ts` | 74 |
| `result` | Function | `src/core/manifest/testing/fakeSevenZip.ts` | 51 |

## How to Explore

1. `context({name: "add"})` — see callers and callees
2. `query({search_query: "testing"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
