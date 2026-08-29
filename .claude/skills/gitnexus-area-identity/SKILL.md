---
name: gitnexus-area-identity
description: "Skill for the Identity area of vortex-mod-monitor. 19 symbols across 2 files."
---

# Identity

19 symbols | 2 files | Cohesion: 78%

## When to Use

- Working with code in `src/`
- Understanding how runKeyTier, normalizeVersion, normalizeModName work
- Modifying identity-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/identity/modIdentity.ts` | archiveShaKey, runKeyTier, nameVersionKey, nexusFileKey, nexusModKey (+12) |
| `src/utils/utils.ts` | compareSnapshots, getModCompareKey |

## Entry Points

Start here when exploring this area:

- **`runKeyTier`** (Function) — `src/core/identity/modIdentity.ts:268`
- **`normalizeVersion`** (Function) — `src/core/identity/modIdentity.ts:113`
- **`normalizeModName`** (Function) — `src/core/identity/modIdentity.ts:164`
- **`matchSnapshots`** (Function) — `src/core/identity/modIdentity.ts:249`
- **`compareSnapshots`** (Function) — `src/utils/utils.ts:378`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `runKeyTier` | Function | `src/core/identity/modIdentity.ts` | 268 |
| `normalizeVersion` | Function | `src/core/identity/modIdentity.ts` | 113 |
| `normalizeModName` | Function | `src/core/identity/modIdentity.ts` | 164 |
| `matchSnapshots` | Function | `src/core/identity/modIdentity.ts` | 249 |
| `compareSnapshots` | Function | `src/utils/utils.ts` | 378 |
| `getModCompareKey` | Function | `src/utils/utils.ts` | 288 |
| `archiveShaKey` | Function | `src/core/identity/modIdentity.ts` | 214 |
| `nameVersionKey` | Function | `src/core/identity/modIdentity.ts` | 230 |
| `nexusFileKey` | Function | `src/core/identity/modIdentity.ts` | 207 |
| `nexusModKey` | Function | `src/core/identity/modIdentity.ts` | 226 |
| `stagingSetKey` | Function | `src/core/identity/modIdentity.ts` | 220 |
| `str` | Function | `src/core/identity/modIdentity.ts` | 201 |
| `alnum` | Function | `src/core/identity/modIdentity.ts` | 152 |
| `nameKey` | Function | `src/core/identity/modIdentity.ts` | 236 |
| `nameTokens` | Function | `src/core/identity/modIdentity.ts` | 177 |
| `stripVersionTokens` | Function | `src/core/identity/modIdentity.ts` | 144 |
| `stripVortexPin` | Function | `src/core/identity/modIdentity.ts` | 134 |
| `diceCoefficient` | Function | `src/core/identity/modIdentity.ts` | 186 |
| `matchBySimilarity` | Function | `src/core/identity/modIdentity.ts` | 362 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CompareSnapshots → StripVersionTokens` | cross_community | 5 |
| `CompareSnapshots → StripVortexPin` | cross_community | 5 |
| `CompareSnapshots → Str` | cross_community | 5 |
| `CompareSnapshots → DiceCoefficient` | intra_community | 4 |
| `CompareSnapshots → ArchiveShaKey` | cross_community | 4 |
| `CompareSnapshots → StagingSetKey` | cross_community | 4 |

## How to Explore

1. `context({name: "runKeyTier"})` — see callers and callees
2. `query({search_query: "identity"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
