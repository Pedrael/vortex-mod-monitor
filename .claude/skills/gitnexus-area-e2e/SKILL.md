---
name: gitnexus-area-e2e
description: "Skill for the E2e area of vortex-mod-monitor. 3 symbols across 1 files."
---

# E2e

3 symbols | 1 files | Cohesion: 100%

## When to Use

- Working with code in `test/`
- Understanding how makeFakeVortex, complete, nexusDownload work
- Modifying e2e-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `test/e2e/fakeVortex.ts` | makeFakeVortex, complete, nexusDownload |

## Entry Points

Start here when exploring this area:

- **`makeFakeVortex`** (Function) — `test/e2e/fakeVortex.ts:44`
- **`complete`** (Function) — `test/e2e/fakeVortex.ts:121`
- **`nexusDownload`** (Function) — `test/e2e/fakeVortex.ts:238`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `makeFakeVortex` | Function | `test/e2e/fakeVortex.ts` | 44 |
| `complete` | Function | `test/e2e/fakeVortex.ts` | 121 |
| `nexusDownload` | Function | `test/e2e/fakeVortex.ts` | 238 |

## How to Explore

1. `context({name: "makeFakeVortex"})` — see callers and callees
2. `query({search_query: "e2e"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
