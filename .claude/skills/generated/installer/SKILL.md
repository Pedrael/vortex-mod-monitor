---
name: installer
description: "Skill for the Installer area of vortex-mod-monitor. 83 symbols across 14 files."
---

# Installer

83 symbols | 14 files | Cohesion: 72%

## When to Use

- Working with code in `src/`
- Understanding how runInstall, reportProgress, checkAbort work
- Modifying installer-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/installer/runInstall.ts` | runInstall, reportProgress, checkAbort, collectRemovalPlan, deployAndWait (+32) |
| `src/core/installer/applyUserlist.ts` | applyUserlist, applyGroupDefinition, applyGroupRule, applyPluginEntry, applyPluginGroup (+8) |
| `src/core/installer/modInstall.ts` | installNexusViaApi, installFromExistingDownload, installFromLocalArchive, makeAbortErrorLocal, waitForInstallCompletion (+8) |
| `src/core/installer/profile.ts` | switchToProfile, finalize, makeAbortError, enableModInProfile |
| `src/core/installer/applyModRules.ts` | applyModRules, resolveReferenceToModId, refMatchesModId |
| `src/actions/installCollectionAction.ts` | onProgress, formatProgressMessage |
| `src/core/archiveHashing.ts` | onAbort, pMap |
| `src/core/installLedger.ts` | serializeReceipt, writeReceipt |
| `src/core/manifest/sevenZip.ts` | extract, resolveSevenZip |
| `src/utils/abortError.ts` | AbortError |

## Entry Points

Start here when exploring this area:

- **`runInstall`** (Function) — `src/core/installer/runInstall.ts:170`
- **`reportProgress`** (Function) — `src/core/installer/runInstall.ts:191`
- **`checkAbort`** (Function) — `src/core/installer/runInstall.ts:200`
- **`applyUserlist`** (Function) — `src/core/installer/applyUserlist.ts:179`
- **`onAbort`** (Function) — `src/core/archiveHashing.ts:44`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `AbortError` | Class | `src/utils/abortError.ts` | 22 |
| `runInstall` | Function | `src/core/installer/runInstall.ts` | 170 |
| `reportProgress` | Function | `src/core/installer/runInstall.ts` | 191 |
| `checkAbort` | Function | `src/core/installer/runInstall.ts` | 200 |
| `applyUserlist` | Function | `src/core/installer/applyUserlist.ts` | 179 |
| `onAbort` | Function | `src/core/archiveHashing.ts` | 44 |
| `applyModRules` | Function | `src/core/installer/applyModRules.ts` | 127 |
| `applyLoadOrder` | Function | `src/core/installer/applyLoadOrder.ts` | 99 |
| `checkAbort` | Function | `src/ui/pages/install/engine.ts` | 103 |
| `checkAbort` | Function | `src/ui/pages/build/engine.ts` | 333 |
| `installNexusViaApi` | Function | `src/core/installer/modInstall.ts` | 88 |
| `installFromExistingDownload` | Function | `src/core/installer/modInstall.ts` | 151 |
| `installFromLocalArchive` | Function | `src/core/installer/modInstall.ts` | 194 |
| `serializeReceipt` | Function | `src/core/installLedger.ts` | 253 |
| `writeReceipt` | Function | `src/core/installLedger.ts` | 294 |
| `resolveSevenZip` | Function | `src/core/manifest/sevenZip.ts` | 118 |
| `installFromBundledArchive` | Function | `src/core/installer/modInstall.ts` | 302 |
| `extractBundledFromEhcoll` | Function | `src/core/installer/modInstall.ts` | 762 |
| `safeRmTempDir` | Function | `src/core/installer/modInstall.ts` | 813 |
| `switchToProfile` | Function | `src/core/installer/profile.ts` | 80 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ReceiptDetailModal → EHRuntime` | cross_community | 7 |
| `ReceiptDetailModal → Notify` | cross_community | 7 |
| `ReceiptDetailModal → GetSnapshot` | cross_community | 6 |
| `InstallFromBundledArchive → Cleanup` | cross_community | 6 |
| `ApplyGroupRule → EHRuntime` | cross_community | 6 |
| `ApplyGroupRule → Notify` | cross_community | 6 |
| `InstallFromExistingDownload → Cleanup` | cross_community | 6 |
| `InstallFromLocalArchive → Cleanup` | cross_community | 6 |
| `ApplyGroupDefinition → EHRuntime` | cross_community | 6 |
| `ApplyGroupDefinition → Notify` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Resolver | 7 calls |
| Install | 6 calls |
| Cluster_13 | 1 calls |
| Errors | 1 calls |
| Pages | 1 calls |

## How to Explore

1. `gitnexus_context({name: "runInstall"})` — see callers and callees
2. `gitnexus_query({query: "installer"})` — find related execution flows
3. Read key files listed above for implementation details
