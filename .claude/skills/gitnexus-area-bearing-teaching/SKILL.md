---
name: gitnexus-area-bearing-teaching
description: "Skill for the Bearing-teaching area of Event-Horizon. 9 symbols across 2 files."
---

# Bearing-teaching

9 symbols | 2 files | Cohesion: 78%

## When to Use

- Working with code in `scripts/`
- Understanding how mergeGitnexusScripts, mergeIntoPackageJson, allManagedScriptKeys work
- Modifying bearing-teaching-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `scripts/bearing-teaching/script-gates.mjs` | mergeGitnexusScripts, mergeIntoPackageJson, allManagedScriptKeys, buildGatedScripts, sub (+1) |
| `scripts/bearing-teaching/merge-package-scripts.mjs` | isStealth, main, resolveGitnexusCmd |

## Entry Points

Start here when exploring this area:

- **`mergeGitnexusScripts`** (Function) — `scripts/bearing-teaching/script-gates.mjs:167`
- **`mergeIntoPackageJson`** (Function) — `scripts/bearing-teaching/script-gates.mjs:188`
- **`allManagedScriptKeys`** (Function) — `scripts/bearing-teaching/script-gates.mjs:157`
- **`buildGatedScripts`** (Function) — `scripts/bearing-teaching/script-gates.mjs:125`
- **`sub`** (Function) — `scripts/bearing-teaching/script-gates.mjs:126`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `mergeGitnexusScripts` | Function | `scripts/bearing-teaching/script-gates.mjs` | 167 |
| `mergeIntoPackageJson` | Function | `scripts/bearing-teaching/script-gates.mjs` | 188 |
| `allManagedScriptKeys` | Function | `scripts/bearing-teaching/script-gates.mjs` | 157 |
| `buildGatedScripts` | Function | `scripts/bearing-teaching/script-gates.mjs` | 125 |
| `sub` | Function | `scripts/bearing-teaching/script-gates.mjs` | 126 |
| `gateCommentKey` | Function | `scripts/bearing-teaching/script-gates.mjs` | 110 |
| `isStealth` | Function | `scripts/bearing-teaching/merge-package-scripts.mjs` | 68 |
| `main` | Function | `scripts/bearing-teaching/merge-package-scripts.mjs` | 76 |
| `resolveGitnexusCmd` | Function | `scripts/bearing-teaching/merge-package-scripts.mjs` | 43 |

## How to Explore

1. `context({name: "mergeGitnexusScripts"})` — see callers and callees
2. `query({search_query: "bearing-teaching"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
