---
name: gitnexus-area-installer
description: "Skill for the Installer area of vortex-mod-monitor. 235 symbols across 45 files."
---

# Installer

235 symbols | 45 files | Cohesion: 79%

## When to Use

- Working with code in `src/`
- Understanding how describeGameIniApplication, shouldApplyGameIni, describeIniTweaks work
- Modifying installer-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/installer/runInstall.ts` | buildAbortedResult, buildDisplayNameByModId, buildFailReceipt, buildManifestIndex, buildNexusModIdMap (+46) |
| `src/core/installer/modInstall.ts` | uninstallMod, extractBundledFromEhcoll, installFromBundledArchive, installFromExistingDownload, installFromLocalArchive (+11) |
| `src/core/installLedger.ts` | InstallLedgerError, deleteReceipt, expectString, getInstallLedgerDir, getReceiptPath (+11) |
| `src/core/installer/applyUserlist.ts` | applyGroupDefinition, applyGroupRule, applyPluginEntry, applyPluginGroup, applyPluginRuleWithCollectionWins (+8) |
| `src/core/installer/checkNexusAccount.ts` | describeSelectorAvailability, probeNexusAccount, hasNexusSlice, nexusSlice, readNexusAccount (+4) |
| `src/core/installer/installMarker.ts` | clearInstallMarker, getMarkerDir, listInterruptedInstalls, markerPath, parseMarker (+4) |
| `src/core/installer/profile.ts` | createFreshProfile, enableModInProfile, pickNonCollidingName, makeAbortError, switchToProfile (+3) |
| `src/core/logging/ehLog.ts` | fail, ok, step, ehLog, enqueue (+3) |
| `src/core/installer/bundledPrefetch.ts` | BundledPrefetchPool, dispose, prime, pump, runExtraction (+2) |
| `src/core/installer/applyGameIni.ts` | describeGameIniApplication, shouldApplyGameIni, applyGameIni, describeIniChanges, isSectionHeader (+2) |

## Entry Points

Start here when exploring this area:

- **`describeGameIniApplication`** (Function) — `src/core/installer/applyGameIni.ts:286`
- **`shouldApplyGameIni`** (Function) — `src/core/installer/applyGameIni.ts:266`
- **`describeIniTweaks`** (Function) — `src/core/installer/applyIniTweaks.ts:114`
- **`describeModTypeMismatches`** (Function) — `src/core/installer/checkModTypes.ts:83`
- **`label`** (Function) — `src/core/installer/checkModTypes.ts:88`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BundledPrefetchPool` | Class | `src/core/installer/bundledPrefetch.ts` | 101 |
| `InstallLedgerError` | Class | `src/core/installLedger.ts` | 71 |
| `AbortError` | Class | `src/utils/abortError.ts` | 22 |
| `describeGameIniApplication` | Function | `src/core/installer/applyGameIni.ts` | 286 |
| `shouldApplyGameIni` | Function | `src/core/installer/applyGameIni.ts` | 266 |
| `describeIniTweaks` | Function | `src/core/installer/applyIniTweaks.ts` | 114 |
| `describeModTypeMismatches` | Function | `src/core/installer/checkModTypes.ts` | 83 |
| `label` | Function | `src/core/installer/checkModTypes.ts` | 88 |
| `findModTypeMismatches` | Function | `src/core/installer/checkModTypes.ts` | 41 |
| `comparePluginOrder` | Function | `src/core/installer/checkPluginOrder.ts` | 68 |
| `describePluginOrderDrift` | Function | `src/core/installer/checkPluginOrder.ts` | 113 |
| `emptyPluginOrderDrift` | Function | `src/core/installer/checkPluginOrder.ts` | 55 |
| `readUserPluginsTxt` | Function | `src/core/installer/checkPluginOrder.ts` | 163 |
| `buildCuratorReport` | Function | `src/core/installer/curatorReport.ts` | 76 |
| `uninstallMod` | Function | `src/core/installer/modInstall.ts` | 356 |
| `createFreshProfile` | Function | `src/core/installer/profile.ts` | 39 |
| `enableModInProfile` | Function | `src/core/installer/profile.ts` | 190 |
| `pickNonCollidingName` | Function | `src/core/installer/profile.ts` | 215 |
| `buildAbortedResult` | Function | `src/core/installer/runInstall.ts` | 414 |
| `runInstall` | Function | `src/core/installer/runInstall.ts` | 429 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ExecuteDecision → GetEventHorizonDir` | cross_community | 10 |
| `ExecuteDivergedChoice → ResolveLogFile` | cross_community | 10 |
| `OnDidInstall → GetVortexUserDataPath` | cross_community | 9 |
| `ExecuteDivergedChoice → Clamp` | cross_community | 9 |
| `ExecuteDivergedChoice → Scale` | cross_community | 9 |
| `ExecuteDivergedChoice → Truncate` | cross_community | 9 |
| `Init → GetVortexUserDataPath` | cross_community | 9 |
| `ExecuteDivergedChoice → Cleanup` | cross_community | 8 |
| `ExecuteDivergedChoice → CurrentStallPhase` | cross_community | 8 |
| `RouteOutlet → InstallLedgerError` | cross_community | 8 |

## How to Explore

1. `context({name: "describeGameIniApplication"})` — see callers and callees
2. `query({search_query: "installer"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
