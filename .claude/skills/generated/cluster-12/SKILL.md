---
name: cluster-12
description: "Skill for the Cluster_12 area of vortex-mod-monitor. 11 symbols across 1 files."
---

# Cluster_12

11 symbols | 1 files | Cohesion: 74%

## When to Use

- Working with code in `src/`
- Understanding how getModsForProfile work
- Modifying cluster_12-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/getModsListForProfile.ts` | pickInstallerChoices, normalizeCollectionIds, normalizeInstallTime, normalizeStringArray, normalizeFomodSelections (+6) |

## Entry Points

Start here when exploring this area:

- **`getModsForProfile`** (Function) — `src/core/getModsListForProfile.ts:423`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getModsForProfile` | Function | `src/core/getModsListForProfile.ts` | 423 |
| `pickInstallerChoices` | Function | `src/core/getModsListForProfile.ts` | 206 |
| `normalizeCollectionIds` | Function | `src/core/getModsListForProfile.ts` | 219 |
| `normalizeInstallTime` | Function | `src/core/getModsListForProfile.ts` | 244 |
| `normalizeStringArray` | Function | `src/core/getModsListForProfile.ts` | 270 |
| `normalizeFomodSelections` | Function | `src/core/getModsListForProfile.ts` | 286 |
| `hasAnySelectedFomodChoices` | Function | `src/core/getModsListForProfile.ts` | 320 |
| `normalizeRuleReference` | Function | `src/core/getModsListForProfile.ts` | 334 |
| `rulesSortKey` | Function | `src/core/getModsListForProfile.ts` | 373 |
| `normalizeModRules` | Function | `src/core/getModsListForProfile.ts` | 384 |
| `assignInstallOrder` | Function | `src/core/getModsListForProfile.ts` | 498 |

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
2. `gitnexus_query({query: "cluster_12"})` — find related execution flows
3. Read key files listed above for implementation details
