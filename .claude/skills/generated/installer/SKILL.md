---
name: installer
description: "Skill for the Installer area of vortex-mod-monitor. 102 symbols across 17 files."
---

# Installer

102 symbols | 17 files | Cohesion: 73%

## When to Use

- Working with code in `src/`
- Understanding how summarizeVerifyFail, runInstall, checkAbort work
- Modifying installer-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/installer/runInstall.ts` | runInstall, checkAbort, collectBundledZipEntriesForPrefetch, collectRemovalPlan, deployAndWait (+35) |
| `src/core/installer/modInstall.ts` | uninstallMod, installNexusViaApi, installFromExistingDownload, installFromLocalArchive, installFromBundledArchive (+9) |
| `src/core/installer/applyUserlist.ts` | applyUserlist, applyGroupDefinition, applyGroupRule, applyPluginEntry, applyPluginGroup (+8) |
| `src/core/installer/bundledPrefetch.ts` | BundledPrefetchPool, prime, take, pump, startExtraction (+2) |
| `src/core/installer/verifyModInstall.ts` | summarizeVerifyFail, verifyModInstall, collectOnDiskFiles, toPosix |
| `src/core/installer/profile.ts` | enableModInProfile, switchToProfile, finalize, makeAbortError |
| `src/core/manifest/captureStagingFiles.ts` | captureStagingFiles, walkStagingFolder, hashStagingFiles, toPosix |
| `src/core/archiveHashing.ts` | hashFileSha256, onAbort, cleanup |
| `src/core/installer/applyModRules.ts` | applyModRules, resolveReferenceToModId, refMatchesModId |
| `src/actions/installCollectionAction.ts` | onProgress, formatProgressMessage |

## Entry Points

Start here when exploring this area:

- **`summarizeVerifyFail`** (Function) — `src/core/installer/verifyModInstall.ts:368`
- **`runInstall`** (Function) — `src/core/installer/runInstall.ts:178`
- **`checkAbort`** (Function) — `src/core/installer/runInstall.ts:221`
- **`enableModInProfile`** (Function) — `src/core/installer/profile.ts:181`
- **`uninstallMod`** (Function) — `src/core/installer/modInstall.ts:258`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BundledPrefetchPool` | Class | `src/core/installer/bundledPrefetch.ts` | 101 |
| `AbortError` | Class | `src/utils/abortError.ts` | 22 |
| `summarizeVerifyFail` | Function | `src/core/installer/verifyModInstall.ts` | 368 |
| `runInstall` | Function | `src/core/installer/runInstall.ts` | 178 |
| `checkAbort` | Function | `src/core/installer/runInstall.ts` | 221 |
| `enableModInProfile` | Function | `src/core/installer/profile.ts` | 181 |
| `uninstallMod` | Function | `src/core/installer/modInstall.ts` | 258 |
| `pMap` | Function | `src/utils/pMap.ts` | 20 |
| `hashFileSha256` | Function | `src/core/archiveHashing.ts` | 33 |
| `onAbort` | Function | `src/core/archiveHashing.ts` | 45 |
| `cleanup` | Function | `src/core/archiveHashing.ts` | 53 |
| `captureStagingFiles` | Function | `src/core/manifest/captureStagingFiles.ts` | 77 |
| `verifyModInstall` | Function | `src/core/installer/verifyModInstall.ts` | 144 |
| `reportProgress` | Function | `src/core/installer/runInstall.ts` | 212 |
| `applyModRules` | Function | `src/core/installer/applyModRules.ts` | 127 |
| `applyLoadOrder` | Function | `src/core/installer/applyLoadOrder.ts` | 99 |
| `checkAbort` | Function | `src/ui/pages/install/engine.ts` | 103 |
| `applyUserlist` | Function | `src/core/installer/applyUserlist.ts` | 179 |
| `installNexusViaApi` | Function | `src/core/installer/modInstall.ts` | 88 |
| `installFromExistingDownload` | Function | `src/core/installer/modInstall.ts` | 151 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ReceiptDetailModal → EHRuntime` | cross_community | 7 |
| `ReceiptDetailModal → Notify` | cross_community | 7 |
| `ReceiptDetailModal → GetSnapshot` | cross_community | 6 |
| `InstallFromBundledArchive → Cleanup` | cross_community | 6 |
| `Take → Extract` | cross_community | 6 |
| `Take → SafeRmTempDir` | cross_community | 6 |
| `ApplyGroupRule → EHRuntime` | cross_community | 6 |
| `ApplyGroupRule → Notify` | cross_community | 6 |
| `InstallFromExistingDownload → Cleanup` | cross_community | 6 |
| `InstallFromLocalArchive → Cleanup` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Resolver | 8 calls |
| Install | 6 calls |
| Cluster_18 | 1 calls |
| Cluster_16 | 1 calls |
| Manifest | 1 calls |

## How to Explore

1. `gitnexus_context({name: "summarizeVerifyFail"})` — see callers and callees
2. `gitnexus_query({query: "installer"})` — find related execution flows
3. Read key files listed above for implementation details
