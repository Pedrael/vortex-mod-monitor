---
name: gitnexus-area-curator
description: "Skill for the Curator area of Event-Horizon. 72 symbols across 17 files."
---

# Curator

72 symbols | 17 files | Cohesion: 86%

## When to Use

- Working with code in `src/`
- Understanding how findSupersededMods, planCleanup, readCuratorMods work
- Modifying curator-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/curator/CuratorPage.tsx` | mods, retireCandidates, scanForCleanup, act, setTypeFor (+11) |
| `src/core/curator/updateOneMod.ts` | UpdateTimeout, installedIdentityReader, asNum, updateOneAndWait, finish (+2) |
| `src/core/curator/profileActions.ts` | findDuplicates, findEndorsable, findFrozen, summarizeProfile, findUpdatable (+2) |
| `src/core/curator/runCleanup.ts` | asNumber, readDownloads, dependsOnFailedRemoval, describeCleanupOutcome, gb (+1) |
| `src/core/curator/readProfile.ts` | asNumber, asString, opt, readCuratorMods, readEnabledModIds |
| `src/core/curator/bulkUpdate.test.ts` | update, update, wait, candidate, mod |
| `src/core/curator/reinstallMod.ts` | reinstallArgs, restorationFor, CannotReinstall, captureForReinstall |
| `src/core/curator/collectionDiff.ts` | diffCollectionAgainstProfile, keyFor, nexusModIdOf, shown |
| `src/core/curator/bulkToggles.ts` | describeTypeChanges, label, planTypeChanges |
| `src/core/curator/bulkUpdate.ts` | describeBulkUpdate, by, runBulkUpdate |

## Entry Points

Start here when exploring this area:

- **`findSupersededMods`** (Function) — `src/core/curator/cleanupPlan.ts:105`
- **`planCleanup`** (Function) — `src/core/curator/cleanupPlan.ts:144`
- **`readCuratorMods`** (Function) — `src/core/curator/readProfile.ts:55`
- **`readEnabledModIds`** (Function) — `src/core/curator/readProfile.ts:133`
- **`readDownloads`** (Function) — `src/core/curator/runCleanup.ts:50`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `UpdateTimeout` | Class | `src/core/curator/updateOneMod.ts` | 66 |
| `CannotReinstall` | Class | `src/core/curator/reinstallMod.ts` | 45 |
| `findSupersededMods` | Function | `src/core/curator/cleanupPlan.ts` | 105 |
| `planCleanup` | Function | `src/core/curator/cleanupPlan.ts` | 144 |
| `readCuratorMods` | Function | `src/core/curator/readProfile.ts` | 55 |
| `readEnabledModIds` | Function | `src/core/curator/readProfile.ts` | 133 |
| `readDownloads` | Function | `src/core/curator/runCleanup.ts` | 50 |
| `describeTypeChanges` | Function | `src/core/curator/bulkToggles.ts` | 72 |
| `label` | Function | `src/core/curator/bulkToggles.ts` | 76 |
| `planTypeChanges` | Function | `src/core/curator/bulkToggles.ts` | 50 |
| `reinstallArgs` | Function | `src/core/curator/reinstallMod.ts` | 128 |
| `restorationFor` | Function | `src/core/curator/reinstallMod.ts` | 106 |
| `applyModTypeChanges` | Function | `src/core/installer/applyModTypes.ts` | 133 |
| `installedIdentityReader` | Function | `src/core/curator/updateOneMod.ts` | 152 |
| `asNum` | Function | `src/core/curator/updateOneMod.ts` | 166 |
| `updateOneAndWait` | Function | `src/core/curator/updateOneMod.ts` | 76 |
| `finish` | Function | `src/core/curator/updateOneMod.ts` | 92 |
| `onAbort` | Function | `src/core/curator/updateOneMod.ts` | 117 |
| `onInstalled` | Function | `src/core/curator/updateOneMod.ts` | 101 |
| `findDuplicates` | Function | `src/core/curator/profileActions.ts` | 236 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Act → GetEventHorizonDir` | cross_community | 10 |
| `Act → Truncate` | cross_community | 8 |
| `Act → Clamp` | cross_community | 8 |
| `Act → Scale` | cross_community | 8 |
| `Act → IsAwaitingUserInput` | cross_community | 7 |
| `VerifyUpdatedMod → NormalizeRuleReference` | cross_community | 4 |
| `VerifyUpdatedMod → RulesSortKey` | cross_community | 4 |
| `Diff → IsNexusSourced` | cross_community | 4 |
| `Mods → BelongsToGame` | cross_community | 4 |
| `Diff → NexusCompareKey` | cross_community | 4 |

## How to Explore

1. `context({name: "findSupersededMods"})` — see callers and callees
2. `query({search_query: "curator"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
