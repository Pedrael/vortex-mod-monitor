---
name: cluster-15
description: "Skill for the Cluster_15 area of vortex-mod-monitor. 10 symbols across 1 files."
---

# Cluster_15

10 symbols | 1 files | Cohesion: 100%

## When to Use

- Working with code in `src/`
- Understanding how mods work
- Modifying cluster_15-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/getModsListForProfile.ts` | pickInstallerChoices, normalizeCollectionIds, normalizeInstallTime, normalizeStringArray, normalizeFomodSelections (+5) |

## Entry Points

Start here when exploring this area:

- **`mods`** (Function) — `src/core/getModsListForProfile.ts:479`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `mods` | Function | `src/core/getModsListForProfile.ts` | 479 |
| `pickInstallerChoices` | Function | `src/core/getModsListForProfile.ts` | 248 |
| `normalizeCollectionIds` | Function | `src/core/getModsListForProfile.ts` | 261 |
| `normalizeInstallTime` | Function | `src/core/getModsListForProfile.ts` | 286 |
| `normalizeStringArray` | Function | `src/core/getModsListForProfile.ts` | 312 |
| `normalizeFomodSelections` | Function | `src/core/getModsListForProfile.ts` | 328 |
| `hasAnySelectedFomodChoices` | Function | `src/core/getModsListForProfile.ts` | 362 |
| `normalizeRuleReference` | Function | `src/core/getModsListForProfile.ts` | 376 |
| `rulesSortKey` | Function | `src/core/getModsListForProfile.ts` | 415 |
| `normalizeModRules` | Function | `src/core/getModsListForProfile.ts` | 426 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Mods → NormalizeRuleReference` | intra_community | 3 |
| `Mods → RulesSortKey` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "mods"})` — see callers and callees
2. `gitnexus_query({query: "cluster_15"})` — find related execution flows
3. Read key files listed above for implementation details
