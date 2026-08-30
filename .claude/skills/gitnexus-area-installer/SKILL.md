---
name: gitnexus-area-installer
description: "Skill for the Installer area of Event-Horizon. 244 symbols across 45 files."
---

# Installer

244 symbols | 45 files | Cohesion: 80%

## When to Use

- Working with code in `src/`
- Understanding how describeGameIniApplication, shouldApplyGameIni, describeIniTweaks work
- Modifying installer-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/installer/runInstall.ts` | buildAbortedResult, buildDisplayNameByModId, buildFailReceipt, buildManifestIndex, buildNexusModIdMap (+50) |
| `src/core/installer/modInstall.ts` | uninstallMod, extractBundledFromEhcoll, installFromBundledArchive, installFromExistingDownload, installFromLocalArchive (+13) |
| `src/core/installLedger.ts` | InstallLedgerError, deleteReceipt, expectString, getInstallLedgerDir, getReceiptPath (+11) |
| `src/core/installer/applyUserlist.ts` | applyGroupDefinition, applyGroupRule, applyPluginEntry, applyPluginGroup, applyPluginRuleWithCollectionWins (+8) |
| `src/core/installer/checkNexusAccount.ts` | describeSelectorAvailability, probeNexusAccount, hasNexusSlice, nexusSlice, readNexusAccount (+4) |
| `src/core/installer/installMarker.ts` | clearInstallMarker, getMarkerDir, listInterruptedInstalls, markerPath, parseMarker (+4) |
| `src/core/installer/applyPluginOrder.ts` | describePluginOrderApplication, applyPluginOrder, dispatchRaw, readEnabledState, runLootSort (+3) |
| `src/core/installer/profile.ts` | createFreshProfile, enableModInProfile, pickNonCollidingName, makeAbortError, switchToProfile (+3) |
| `src/core/logging/ehLog.ts` | fail, ok, step, ehLog, enqueue (+3) |
| `src/core/installer/bundledPrefetch.ts` | BundledPrefetchPool, dispose, prime, pump, runExtraction (+2) |

## Entry Points

Start here when exploring this area:

- **`describeGameIniApplication`** (Function) — `src/core/installer/applyGameIni.ts:286`
- **`shouldApplyGameIni`** (Function) — `src/core/installer/applyGameIni.ts:266`
- **`describeIniTweaks`** (Function) — `src/core/installer/applyIniTweaks.ts:114`
- **`describePluginFlagRepair`** (Function) — `src/core/installer/applyPluginLightFlags.ts:124`
- **`describePluginOrderApplication`** (Function) — `src/core/installer/applyPluginOrder.ts:312`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BundledPrefetchPool` | Class | `src/core/installer/bundledPrefetch.ts` | 101 |
| `InstallLedgerError` | Class | `src/core/installLedger.ts` | 71 |
| `describeGameIniApplication` | Function | `src/core/installer/applyGameIni.ts` | 286 |
| `shouldApplyGameIni` | Function | `src/core/installer/applyGameIni.ts` | 266 |
| `describeIniTweaks` | Function | `src/core/installer/applyIniTweaks.ts` | 114 |
| `describePluginFlagRepair` | Function | `src/core/installer/applyPluginLightFlags.ts` | 124 |
| `describePluginOrderApplication` | Function | `src/core/installer/applyPluginOrder.ts` | 312 |
| `describeModTypeMismatches` | Function | `src/core/installer/checkModTypes.ts` | 83 |
| `label` | Function | `src/core/installer/checkModTypes.ts` | 88 |
| `findModTypeMismatches` | Function | `src/core/installer/checkModTypes.ts` | 41 |
| `comparePluginOrder` | Function | `src/core/installer/checkPluginOrder.ts` | 68 |
| `describePluginOrderDrift` | Function | `src/core/installer/checkPluginOrder.ts` | 113 |
| `emptyPluginOrderDrift` | Function | `src/core/installer/checkPluginOrder.ts` | 55 |
| `readUserPluginsTxt` | Function | `src/core/installer/checkPluginOrder.ts` | 163 |
| `buildCuratorReport` | Function | `src/core/installer/curatorReport.ts` | 90 |
| `uninstallMod` | Function | `src/core/installer/modInstall.ts` | 403 |
| `createFreshProfile` | Function | `src/core/installer/profile.ts` | 39 |
| `enableModInProfile` | Function | `src/core/installer/profile.ts` | 190 |
| `pickNonCollidingName` | Function | `src/core/installer/profile.ts` | 215 |
| `captureUserRuleState` | Function | `src/core/installer/purgeUserRules.ts` | 74 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ExecuteDecision → GetEventHorizonDir` | cross_community | 10 |
| `ExecuteDivergedChoice → ResolveLogFile` | cross_community | 10 |
| `OnDidInstall → GetVortexUserDataPath` | cross_community | 9 |
| `ExecuteDivergedChoice → Clamp` | cross_community | 9 |
| `ExecuteDivergedChoice → Scale` | cross_community | 9 |
| `ExecuteDivergedChoice → Truncate` | cross_community | 9 |
| `ExecutePromptUserChoice → ZipReadError` | cross_community | 9 |
| `Init → GetVortexUserDataPath` | cross_community | 9 |
| `ExecuteDivergedChoice → IsAwaitingUserInput` | cross_community | 8 |
| `ExecuteDivergedChoice → Cleanup` | cross_community | 8 |

## How to Explore

1. `context({name: "describeGameIniApplication"})` — see callers and callees
2. `query({search_query: "installer"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
