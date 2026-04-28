---
name: cluster-11
description: "Skill for the Cluster_11 area of vortex-mod-monitor. 11 symbols across 1 files."
---

# Cluster_11

11 symbols | 1 files | Cohesion: 74%

## When to Use

- Working with code in `src/`
- Understanding how getModsForProfile work
- Modifying cluster_11-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/getModsListForProfile.ts` | pickInstallerChoices, normalizeCollectionIds, normalizeInstallTime, normalizeStringArray, normalizeFomodSelections (+6) |

## Entry Points

Start here when exploring this area:

- **`getModsForProfile`** (Function) — `src/core/getModsListForProfile.ts:465`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getModsForProfile` | Function | `src/core/getModsListForProfile.ts` | 465 |
| `pickInstallerChoices` | Function | `src/core/getModsListForProfile.ts` | 248 |
| `normalizeCollectionIds` | Function | `src/core/getModsListForProfile.ts` | 261 |
| `normalizeInstallTime` | Function | `src/core/getModsListForProfile.ts` | 286 |
| `normalizeStringArray` | Function | `src/core/getModsListForProfile.ts` | 312 |
| `normalizeFomodSelections` | Function | `src/core/getModsListForProfile.ts` | 328 |
| `hasAnySelectedFomodChoices` | Function | `src/core/getModsListForProfile.ts` | 362 |
| `normalizeRuleReference` | Function | `src/core/getModsListForProfile.ts` | 376 |
| `rulesSortKey` | Function | `src/core/getModsListForProfile.ts` | 415 |
| `normalizeModRules` | Function | `src/core/getModsListForProfile.ts` | 426 |
| `assignInstallOrder` | Function | `src/core/getModsListForProfile.ts` | 545 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Begin → NormalizeRuleReference` | cross_community | 5 |
| `RunLoadingPipelineWithReceipt → NormalizeRuleReference` | cross_community | 4 |
| `RunLoadingPipelineWithReceipt → RulesSortKey` | cross_community | 4 |
| `LoadBuildContext → RulesSortKey` | cross_community | 4 |
| `CreateExportModsAction → NormalizeRuleReference` | cross_community | 4 |
| `CreateExportModsAction → RulesSortKey` | cross_community | 4 |
| `Begin → PickInstallerChoices` | cross_community | 4 |
| `Begin → NormalizeFomodSelections` | cross_community | 4 |
| `Begin → NormalizeCollectionIds` | cross_community | 4 |
| `ResolveStaleReceipt → PickInstallerChoices` | cross_community | 4 |

## How to Explore

1. `gitnexus_context({name: "getModsForProfile"})` — see callers and callees
2. `gitnexus_query({query: "cluster_11"})` — find related execution flows
3. Read key files listed above for implementation details
