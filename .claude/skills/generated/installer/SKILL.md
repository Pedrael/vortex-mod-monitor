---
name: installer
description: "Skill for the Installer area of vortex-mod-monitor. 107 symbols across 15 files."
---

# Installer

107 symbols | 15 files | Cohesion: 76%

## When to Use

- Working with code in `src/`
- Understanding how summarizeVerifyFail, runInstall, checkAbort work
- Modifying installer-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/installer/runInstall.ts` | runInstall, checkAbort, collectBundledZipEntriesForPrefetch, collectRemovalPlan, deployAndWait (+34) |
| `src/core/installLedger.ts` | InstallLedgerError, getReceiptPath, getInstallLedgerDir, parseReceipt, passthroughObject (+10) |
| `src/core/installer/modInstall.ts` | uninstallMod, installNexusViaApi, installFromExistingDownload, installFromLocalArchive, installFromBundledArchive (+9) |
| `src/core/installer/applyUserlist.ts` | applyUserlist, applyGroupDefinition, applyGroupRule, applyPluginEntry, applyPluginGroup (+8) |
| `src/core/installer/bundledPrefetch.ts` | BundledPrefetchPool, prime, take, pump, startExtraction (+2) |
| `src/core/installer/verifyModInstall.ts` | summarizeVerifyFail, verifyModInstall, collectOnDiskFiles, toPosix |
| `src/core/installer/profile.ts` | createFreshProfile, enableModInProfile, pickNonCollidingName |
| `src/core/archiveHashing.ts` | hashFileSha256, onAbort, cleanup |
| `src/core/installer/applyModRules.ts` | applyModRules, resolveReferenceToModId, refMatchesModId |
| `src/ui/errors/ErrorContext.tsx` | onError |

## Entry Points

Start here when exploring this area:

- **`summarizeVerifyFail`** (Function) — `src/core/installer/verifyModInstall.ts:374`
- **`runInstall`** (Function) — `src/core/installer/runInstall.ts:178`
- **`checkAbort`** (Function) — `src/core/installer/runInstall.ts:221`
- **`createFreshProfile`** (Function) — `src/core/installer/profile.ts:38`
- **`enableModInProfile`** (Function) — `src/core/installer/profile.ts:181`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BundledPrefetchPool` | Class | `src/core/installer/bundledPrefetch.ts` | 101 |
| `InstallLedgerError` | Class | `src/core/installLedger.ts` | 70 |
| `AbortError` | Class | `src/utils/abortError.ts` | 22 |
| `summarizeVerifyFail` | Function | `src/core/installer/verifyModInstall.ts` | 374 |
| `runInstall` | Function | `src/core/installer/runInstall.ts` | 178 |
| `checkAbort` | Function | `src/core/installer/runInstall.ts` | 221 |
| `createFreshProfile` | Function | `src/core/installer/profile.ts` | 38 |
| `enableModInProfile` | Function | `src/core/installer/profile.ts` | 181 |
| `pickNonCollidingName` | Function | `src/core/installer/profile.ts` | 206 |
| `uninstallMod` | Function | `src/core/installer/modInstall.ts` | 258 |
| `getReceiptPath` | Function | `src/core/installLedger.ts` | 124 |
| `getInstallLedgerDir` | Function | `src/core/installLedger.ts` | 140 |
| `parseReceipt` | Function | `src/core/installLedger.ts` | 155 |
| `serializeReceipt` | Function | `src/core/installLedger.ts` | 319 |
| `readReceipt` | Function | `src/core/installLedger.ts` | 336 |
| `writeReceipt` | Function | `src/core/installLedger.ts` | 360 |
| `listReceipts` | Function | `src/core/installLedger.ts` | 408 |
| `onError` | Function | `src/ui/errors/ErrorContext.tsx` | 121 |
| `pMap` | Function | `src/utils/pMap.ts` | 20 |
| `hashFileSha256` | Function | `src/core/archiveHashing.ts` | 34 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Dashboard → InstallLedgerError` | cross_community | 6 |
| `InstallFromBundledArchive → Cleanup` | cross_community | 6 |
| `Take → Extract` | cross_community | 6 |
| `Take → SafeRmTempDir` | cross_community | 6 |
| `ApplyGroupRule → EHRuntime` | cross_community | 6 |
| `ApplyGroupRule → Notify` | cross_community | 6 |
| `InstallFromExistingDownload → Cleanup` | cross_community | 6 |
| `InstallFromLocalArchive → Cleanup` | cross_community | 6 |
| `ApplyGroupDefinition → EHRuntime` | cross_community | 6 |
| `ApplyGroupDefinition → Notify` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Resolver | 8 calls |
| Install | 6 calls |
| Manifest | 3 calls |

## How to Explore

1. `gitnexus_context({name: "summarizeVerifyFail"})` — see callers and callees
2. `gitnexus_query({query: "installer"})` — find related execution flows
3. Read key files listed above for implementation details
