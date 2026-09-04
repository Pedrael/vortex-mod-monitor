---
name: gitnexus-area-e2e
description: "Skill for the E2e area of Event-Horizon. 20 symbols across 6 files."
---

# E2e

20 symbols | 6 files | Cohesion: 73%

## When to Use

- Working with code in `src/`
- Understanding how getModsForProfile, makeWorld, runInstall work
- Modifying e2e-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/getModsListForProfile.ts` | assignInstallOrder, getModsForProfile, hasAnySelectedFomodChoices, normalizeCollectionIds, normalizeFomodSelections (+6) |
| `test/e2e/fakeVortex.ts` | makeFakeVortex, complete, nexusDownload |
| `test/e2e/installDriver.e2e.test.ts` | install, userState |
| `test/e2e/verification.e2e.test.ts` | install, userState |
| `test/e2e/world.ts` | makeWorld |
| `src/core/installer/runInstall.ts` | runInstall |

## Entry Points

Start here when exploring this area:

- **`getModsForProfile`** (Function) — `src/core/getModsListForProfile.ts:534`
- **`makeWorld`** (Function) — `test/e2e/world.ts:78`
- **`runInstall`** (Function) — `src/core/installer/runInstall.ts:527`
- **`makeFakeVortex`** (Function) — `test/e2e/fakeVortex.ts:44`
- **`complete`** (Function) — `test/e2e/fakeVortex.ts:121`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getModsForProfile` | Function | `src/core/getModsListForProfile.ts` | 534 |
| `makeWorld` | Function | `test/e2e/world.ts` | 78 |
| `runInstall` | Function | `src/core/installer/runInstall.ts` | 527 |
| `makeFakeVortex` | Function | `test/e2e/fakeVortex.ts` | 44 |
| `complete` | Function | `test/e2e/fakeVortex.ts` | 121 |
| `nexusDownload` | Function | `test/e2e/fakeVortex.ts` | 238 |
| `assignInstallOrder` | Function | `src/core/getModsListForProfile.ts` | 624 |
| `hasAnySelectedFomodChoices` | Function | `src/core/getModsListForProfile.ts` | 431 |
| `normalizeCollectionIds` | Function | `src/core/getModsListForProfile.ts` | 330 |
| `normalizeFomodSelections` | Function | `src/core/getModsListForProfile.ts` | 397 |
| `normalizeInstallTime` | Function | `src/core/getModsListForProfile.ts` | 355 |
| `normalizeModRules` | Function | `src/core/getModsListForProfile.ts` | 495 |
| `normalizeRuleReference` | Function | `src/core/getModsListForProfile.ts` | 445 |
| `normalizeStringArray` | Function | `src/core/getModsListForProfile.ts` | 381 |
| `pickInstallerChoices` | Function | `src/core/getModsListForProfile.ts` | 317 |
| `rulesSortKey` | Function | `src/core/getModsListForProfile.ts` | 484 |
| `install` | Function | `test/e2e/installDriver.e2e.test.ts` | 87 |
| `userState` | Function | `test/e2e/installDriver.e2e.test.ts` | 65 |
| `install` | Function | `test/e2e/verification.e2e.test.ts` | 115 |
| `userState` | Function | `test/e2e/verification.e2e.test.ts` | 81 |

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
