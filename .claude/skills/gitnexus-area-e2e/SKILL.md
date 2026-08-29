---
name: gitnexus-area-e2e
description: "Skill for the E2e area of vortex-mod-monitor. 15 symbols across 3 files."
---

# E2e

15 symbols | 3 files | Cohesion: 79%

## When to Use

- Working with code in `src/`
- Understanding how getModsForProfile, makeWorld, makeFakeVortex work
- Modifying e2e-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/getModsListForProfile.ts` | assignInstallOrder, getModsForProfile, hasAnySelectedFomodChoices, normalizeCollectionIds, normalizeFomodSelections (+6) |
| `test/e2e/fakeVortex.ts` | makeFakeVortex, complete, nexusDownload |
| `test/e2e/world.ts` | makeWorld |

## Entry Points

Start here when exploring this area:

- **`getModsForProfile`** (Function) — `src/core/getModsListForProfile.ts:511`
- **`makeWorld`** (Function) — `test/e2e/world.ts:66`
- **`makeFakeVortex`** (Function) — `test/e2e/fakeVortex.ts:42`
- **`complete`** (Function) — `test/e2e/fakeVortex.ts:74`
- **`nexusDownload`** (Function) — `test/e2e/fakeVortex.ts:150`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getModsForProfile` | Function | `src/core/getModsListForProfile.ts` | 511 |
| `makeWorld` | Function | `test/e2e/world.ts` | 66 |
| `makeFakeVortex` | Function | `test/e2e/fakeVortex.ts` | 42 |
| `complete` | Function | `test/e2e/fakeVortex.ts` | 74 |
| `nexusDownload` | Function | `test/e2e/fakeVortex.ts` | 150 |
| `assignInstallOrder` | Function | `src/core/getModsListForProfile.ts` | 601 |
| `hasAnySelectedFomodChoices` | Function | `src/core/getModsListForProfile.ts` | 408 |
| `normalizeCollectionIds` | Function | `src/core/getModsListForProfile.ts` | 307 |
| `normalizeFomodSelections` | Function | `src/core/getModsListForProfile.ts` | 374 |
| `normalizeInstallTime` | Function | `src/core/getModsListForProfile.ts` | 332 |
| `normalizeModRules` | Function | `src/core/getModsListForProfile.ts` | 472 |
| `normalizeRuleReference` | Function | `src/core/getModsListForProfile.ts` | 422 |
| `normalizeStringArray` | Function | `src/core/getModsListForProfile.ts` | 358 |
| `pickInstallerChoices` | Function | `src/core/getModsListForProfile.ts` | 294 |
| `rulesSortKey` | Function | `src/core/getModsListForProfile.ts` | 461 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CurrentFingerprint → NormalizeRuleReference` | cross_community | 4 |
| `CurrentFingerprint → RulesSortKey` | cross_community | 4 |
| `RunLoadingPipelineWithReceipt → NormalizeRuleReference` | cross_community | 4 |
| `RunLoadingPipelineWithReceipt → RulesSortKey` | cross_community | 4 |
| `CurrentFingerprint → NormalizeCollectionIds` | cross_community | 3 |
| `CurrentFingerprint → NormalizeFomodSelections` | cross_community | 3 |
| `CurrentFingerprint → PickInstallerChoices` | cross_community | 3 |
| `RunLoadingPipelineWithReceipt → NormalizeCollectionIds` | cross_community | 3 |
| `RunLoadingPipelineWithReceipt → NormalizeFomodSelections` | cross_community | 3 |
| `RunLoadingPipelineWithReceipt → PickInstallerChoices` | cross_community | 3 |

## How to Explore

1. `context({name: "getModsForProfile"})` — see callers and callees
2. `query({search_query: "e2e"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
