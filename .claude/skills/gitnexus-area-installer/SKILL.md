---
name: gitnexus-area-installer
description: "Skill for the Installer area of Event-Horizon. 287 symbols across 57 files."
---

# Installer

287 symbols | 57 files | Cohesion: 86%

## When to Use

- Working with code in `src/`
- Understanding how describeGameIniApplication, shouldApplyGameIni, describeIniTweaks work
- Modifying installer-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/installer/runInstall.ts` | buildAbortedResult, buildDisplayNameByModId, buildFailReceipt, buildManifestIndex, buildNexusModIdMap (+51) |
| `src/core/installer/modInstall.ts` | uninstallMod, delayRespectingAbort, extractBundledFromEhcoll, installFromBundledArchive, installFromExistingDownload (+16) |
| `src/core/installLedger.ts` | InstallLedgerError, deleteReceipt, expectString, getInstallLedgerDir, getReceiptPath (+11) |
| `src/core/installer/applyUserlist.ts` | applyGroupDefinition, applyGroupRule, applyPluginEntry, applyPluginGroup, applyPluginRuleWithCollectionWins (+8) |
| `src/core/installer/checkNexusAccount.ts` | describeSelectorAvailability, probeNexusAccount, hasNexusSlice, nexusSlice, readNexusAccount (+4) |
| `src/core/installer/installMarker.ts` | clearInstallMarker, getMarkerDir, listInterruptedInstalls, markerPath, parseMarker (+4) |
| `src/core/installer/applyPluginOrder.ts` | describePluginOrderApplication, applyPluginOrder, dispatchRaw, readEnabledState, runLootSort (+3) |
| `src/core/installer/profile.ts` | createFreshProfile, enableModInProfile, makeAbortError, pickNonCollidingName, switchToProfile (+3) |
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
| `describeSevenZipHealth` | Function | `src/core/installer/checkSevenZipHealth.ts` | 136 |
| `looksLikeWine` | Function | `src/core/installer/checkSevenZipHealth.ts` | 106 |
| `buildCuratorReport` | Function | `src/core/installer/curatorReport.ts` | 90 |
| `describeMissingDeploymentMethod` | Function | `src/core/installer/deploymentMethod.ts` | 86 |
| `isDeploymentMethodMissing` | Function | `src/core/installer/deploymentMethod.ts` | 47 |
| `classifyModFailure` | Function | `src/core/installer/downloadFailureShape.ts` | 71 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `InstallNexusViaApi → GetEventHorizonRoot` | cross_community | 10 |
| `ExecuteDecision → GetEventHorizonDir` | cross_community | 10 |
| `ExecuteDivergedChoice → ResolveLogFile` | cross_community | 10 |
| `OnDidInstall → GetVortexUserDataPath` | cross_community | 9 |
| `ExecuteDivergedChoice → Clamp` | cross_community | 9 |
| `ExecuteDivergedChoice → Scale` | cross_community | 9 |
| `ExecuteDivergedChoice → Truncate` | cross_community | 9 |
| `ExecutePromptUserChoice → ZipReadError` | cross_community | 9 |
| `Init → GetVortexUserDataPath` | cross_community | 9 |
| `ExecuteDivergedChoice → IsAwaitingUserInput` | cross_community | 8 |

## How to Explore

1. `context({name: "describeGameIniApplication"})` — see callers and callees
2. `query({search_query: "installer"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
