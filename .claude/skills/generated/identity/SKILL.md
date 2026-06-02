---
name: identity
description: "Skill for the Identity area of vortex-mod-monitor. 15 symbols across 1 files."
---

# Identity

15 symbols | 1 files | Cohesion: 90%

## When to Use

- Working with code in `src/`
- Understanding how normalizeVersion, normalizeModName, matchSnapshots work
- Modifying identity-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/identity/modIdentity.ts` | normalizeVersion, stripVortexPin, stripVersionTokens, alnum, normalizeModName (+10) |

## Entry Points

Start here when exploring this area:

- **`normalizeVersion`** (Function) — `src/core/identity/modIdentity.ts:113`
- **`normalizeModName`** (Function) — `src/core/identity/modIdentity.ts:164`
- **`matchSnapshots`** (Function) — `src/core/identity/modIdentity.ts:249`
- **`runKeyTier`** (Function) — `src/core/identity/modIdentity.ts:268`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `normalizeVersion` | Function | `src/core/identity/modIdentity.ts` | 113 |
| `normalizeModName` | Function | `src/core/identity/modIdentity.ts` | 164 |
| `matchSnapshots` | Function | `src/core/identity/modIdentity.ts` | 249 |
| `runKeyTier` | Function | `src/core/identity/modIdentity.ts` | 268 |
| `stripVortexPin` | Function | `src/core/identity/modIdentity.ts` | 134 |
| `stripVersionTokens` | Function | `src/core/identity/modIdentity.ts` | 144 |
| `alnum` | Function | `src/core/identity/modIdentity.ts` | 152 |
| `nameTokens` | Function | `src/core/identity/modIdentity.ts` | 177 |
| `nameVersionKey` | Function | `src/core/identity/modIdentity.ts` | 230 |
| `nameKey` | Function | `src/core/identity/modIdentity.ts` | 236 |
| `diceCoefficient` | Function | `src/core/identity/modIdentity.ts` | 186 |
| `matchBySimilarity` | Function | `src/core/identity/modIdentity.ts` | 362 |
| `str` | Function | `src/core/identity/modIdentity.ts` | 201 |
| `nexusFileKey` | Function | `src/core/identity/modIdentity.ts` | 207 |
| `nexusModKey` | Function | `src/core/identity/modIdentity.ts` | 226 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CompareSnapshots → StripVersionTokens` | cross_community | 5 |
| `CompareSnapshots → StripVortexPin` | cross_community | 5 |
| `CompareSnapshots → DiceCoefficient` | cross_community | 4 |
| `CompareSnapshots → RunKeyTier` | cross_community | 3 |
| `NameVersionKey → StripVortexPin` | intra_community | 3 |
| `NameVersionKey → StripVersionTokens` | intra_community | 3 |
| `NameVersionKey → Alnum` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "normalizeVersion"})` — see callers and callees
2. `gitnexus_query({query: "identity"})` — find related execution flows
3. Read key files listed above for implementation details
