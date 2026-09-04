---
name: gitnexus-area-identity
description: "Skill for the Identity area of Event-Horizon. 33 symbols across 6 files."
---

# Identity

33 symbols | 6 files | Cohesion: 76%

## When to Use

- Working with code in `src/`
- Understanding how archiveHashCacheKey, rememberArchiveHash, externalArchiveCompareKey work
- Modifying identity-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/identity/modIdentity.ts` | archiveShaKey, runKeyTier, nameVersionKey, nexusFileKey, nexusModKey (+12) |
| `src/core/identity/compareKey.ts` | externalArchiveCompareKey, nexusCompareKey, archiveReference, nexusFileReference, nexusModReference |
| `src/core/archiveHashCache.ts` | archiveHashCacheKey, isHex64, rememberArchiveHash, set |
| `src/core/manifest/buildManifest.ts` | buildRule, buildRules, synthesizeRuleReference |
| `src/core/manifest/collectionScope.ts` | findHashedIdentityCollisions, groupBy |
| `src/utils/utils.ts` | compareSnapshots, getModCompareKey |

## Entry Points

Start here when exploring this area:

- **`archiveHashCacheKey`** (Function) — `src/core/archiveHashCache.ts:158`
- **`rememberArchiveHash`** (Function) — `src/core/archiveHashCache.ts:234`
- **`externalArchiveCompareKey`** (Function) — `src/core/identity/compareKey.ts:50`
- **`nexusCompareKey`** (Function) — `src/core/identity/compareKey.ts:42`
- **`findHashedIdentityCollisions`** (Function) — `src/core/manifest/collectionScope.ts:192`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `archiveHashCacheKey` | Function | `src/core/archiveHashCache.ts` | 158 |
| `rememberArchiveHash` | Function | `src/core/archiveHashCache.ts` | 234 |
| `externalArchiveCompareKey` | Function | `src/core/identity/compareKey.ts` | 50 |
| `nexusCompareKey` | Function | `src/core/identity/compareKey.ts` | 42 |
| `findHashedIdentityCollisions` | Function | `src/core/manifest/collectionScope.ts` | 192 |
| `runKeyTier` | Function | `src/core/identity/modIdentity.ts` | 268 |
| `normalizeVersion` | Function | `src/core/identity/modIdentity.ts` | 113 |
| `archiveReference` | Function | `src/core/identity/compareKey.ts` | 121 |
| `nexusFileReference` | Function | `src/core/identity/compareKey.ts` | 102 |
| `nexusModReference` | Function | `src/core/identity/compareKey.ts` | 116 |
| `normalizeModName` | Function | `src/core/identity/modIdentity.ts` | 164 |
| `matchSnapshots` | Function | `src/core/identity/modIdentity.ts` | 249 |
| `compareSnapshots` | Function | `src/utils/utils.ts` | 378 |
| `getModCompareKey` | Function | `src/utils/utils.ts` | 288 |
| `set` | Method | `src/core/archiveHashCache.ts` | 136 |
| `isHex64` | Function | `src/core/archiveHashCache.ts` | 173 |
| `groupBy` | Function | `src/core/manifest/collectionScope.ts` | 108 |
| `archiveShaKey` | Function | `src/core/identity/modIdentity.ts` | 214 |
| `nameVersionKey` | Function | `src/core/identity/modIdentity.ts` | 230 |
| `nexusFileKey` | Function | `src/core/identity/modIdentity.ts` | 207 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `OnRecovered → NexusCompareKey` | cross_community | 5 |
| `MatchSnapshots → StripVersionTokens` | cross_community | 4 |
| `MatchSnapshots → StripVortexPin` | cross_community | 4 |
| `MatchSnapshots → Str` | cross_community | 4 |
| `OnRecovered → IsHex64` | cross_community | 4 |
| `MatchSnapshots → DiceCoefficient` | intra_community | 3 |
| `MatchSnapshots → ArchiveShaKey` | cross_community | 3 |
| `MatchSnapshots → StagingSetKey` | cross_community | 3 |
| `CurrentFingerprint → GroupBy` | cross_community | 3 |
| `CurrentFingerprint → NexusCompareKey` | cross_community | 3 |

## How to Explore

1. `context({name: "archiveHashCacheKey"})` — see callers and callees
2. `query({search_query: "identity"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
