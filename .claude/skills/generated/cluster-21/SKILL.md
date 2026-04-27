---
name: cluster-21
description: "Skill for the Cluster_21 area of vortex-mod-monitor. 11 symbols across 1 files."
---

# Cluster_21

11 symbols | 1 files | Cohesion: 74%

## When to Use

- Working with code in `src/`
- Understanding how getModsForProfile work
- Modifying cluster_21-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/getModsListForProfile.ts` | pickInstallerChoices, normalizeCollectionIds, normalizeInstallTime, normalizeStringArray, normalizeFomodSelections (+6) |

## Entry Points

Start here when exploring this area:

- **`getModsForProfile`** (Function) — `src/core/getModsListForProfile.ts:448`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getModsForProfile` | Function | `src/core/getModsListForProfile.ts` | 448 |
| `pickInstallerChoices` | Function | `src/core/getModsListForProfile.ts` | 231 |
| `normalizeCollectionIds` | Function | `src/core/getModsListForProfile.ts` | 244 |
| `normalizeInstallTime` | Function | `src/core/getModsListForProfile.ts` | 269 |
| `normalizeStringArray` | Function | `src/core/getModsListForProfile.ts` | 295 |
| `normalizeFomodSelections` | Function | `src/core/getModsListForProfile.ts` | 311 |
| `hasAnySelectedFomodChoices` | Function | `src/core/getModsListForProfile.ts` | 345 |
| `normalizeRuleReference` | Function | `src/core/getModsListForProfile.ts` | 359 |
| `rulesSortKey` | Function | `src/core/getModsListForProfile.ts` | 398 |
| `normalizeModRules` | Function | `src/core/getModsListForProfile.ts` | 409 |
| `assignInstallOrder` | Function | `src/core/getModsListForProfile.ts` | 528 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Begin → NormalizeRuleReference` | cross_community | 5 |
| `Begin → RulesSortKey` | cross_community | 5 |
| `RunLoadingPipelineWithReceipt → NormalizeRuleReference` | cross_community | 4 |
| `RunLoadingPipelineWithReceipt → RulesSortKey` | cross_community | 4 |
| `CreateExportModsAction → NormalizeRuleReference` | cross_community | 4 |
| `CreateExportModsAction → RulesSortKey` | cross_community | 4 |
| `Begin → PickInstallerChoices` | cross_community | 4 |
| `Begin → NormalizeFomodSelections` | cross_community | 4 |
| `Begin → NormalizeCollectionIds` | cross_community | 4 |
| `ResolveStaleReceipt → PickInstallerChoices` | cross_community | 4 |

## How to Explore

1. `gitnexus_context({name: "getModsForProfile"})` — see callers and callees
2. `gitnexus_query({query: "cluster_21"})` — find related execution flows
3. Read key files listed above for implementation details
