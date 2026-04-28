---
name: installer
description: "Skill for the Installer area of vortex-mod-monitor. 95 symbols across 9 files."
---

# Installer

95 symbols | 9 files | Cohesion: 78%

## When to Use

- Working with code in `src/`
- Understanding how summarizeVerifyFail, runInstall, checkAbort work
- Modifying installer-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/installer/runInstall.ts` | runInstall, checkAbort, collectBundledZipEntriesForPrefetch, collectRemovalPlan, deployAndWait (+34) |
| `src/core/installLedger.ts` | InstallLedgerError, getReceiptPath, getInstallLedgerDir, parseReceipt, passthroughObject (+10) |
| `src/core/installer/modInstall.ts` | uninstallMod, safeRmTempDir, installNexusViaApi, installFromExistingDownload, installFromLocalArchive (+9) |
| `src/core/installer/applyUserlist.ts` | applyUserlist, applyGroupDefinition, applyGroupRule, applyPluginEntry, applyPluginGroup (+8) |
| `src/core/installer/bundledPrefetch.ts` | BundledPrefetchPool, dispose, prime, take, pump (+2) |
| `src/core/installer/profile.ts` | enableModInProfile, switchToProfile, finalize, makeAbortError |
| `src/core/installer/verifyModInstall.ts` | summarizeVerifyFail |
| `src/core/manifest/sevenZip.ts` | extract |
| `src/ui/pages/CollectionsPage.tsx` | handleSwitchProfile |

## Entry Points

Start here when exploring this area:

- **`summarizeVerifyFail`** (Function) — `src/core/installer/verifyModInstall.ts:374`
- **`runInstall`** (Function) — `src/core/installer/runInstall.ts:178`
- **`checkAbort`** (Function) — `src/core/installer/runInstall.ts:221`
- **`enableModInProfile`** (Function) — `src/core/installer/profile.ts:181`
- **`uninstallMod`** (Function) — `src/core/installer/modInstall.ts:258`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BundledPrefetchPool` | Class | `src/core/installer/bundledPrefetch.ts` | 101 |
| `InstallLedgerError` | Class | `src/core/installLedger.ts` | 70 |
| `summarizeVerifyFail` | Function | `src/core/installer/verifyModInstall.ts` | 374 |
| `runInstall` | Function | `src/core/installer/runInstall.ts` | 178 |
| `checkAbort` | Function | `src/core/installer/runInstall.ts` | 221 |
| `enableModInProfile` | Function | `src/core/installer/profile.ts` | 181 |
| `uninstallMod` | Function | `src/core/installer/modInstall.ts` | 258 |
| `safeRmTempDir` | Function | `src/core/installer/modInstall.ts` | 826 |
| `getReceiptPath` | Function | `src/core/installLedger.ts` | 124 |
| `getInstallLedgerDir` | Function | `src/core/installLedger.ts` | 140 |
| `parseReceipt` | Function | `src/core/installLedger.ts` | 155 |
| `serializeReceipt` | Function | `src/core/installLedger.ts` | 319 |
| `readReceipt` | Function | `src/core/installLedger.ts` | 336 |
| `writeReceipt` | Function | `src/core/installLedger.ts` | 360 |
| `listReceipts` | Function | `src/core/installLedger.ts` | 408 |
| `applyUserlist` | Function | `src/core/installer/applyUserlist.ts` | 179 |
| `installNexusViaApi` | Function | `src/core/installer/modInstall.ts` | 88 |
| `installFromExistingDownload` | Function | `src/core/installer/modInstall.ts` | 151 |
| `installFromLocalArchive` | Function | `src/core/installer/modInstall.ts` | 194 |
| `installFromBundledArchive` | Function | `src/core/installer/modInstall.ts` | 302 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ReceiptDetailModal → EHRuntime` | cross_community | 7 |
| `ReceiptDetailModal → Notify` | cross_community | 7 |
| `ReceiptDetailModal → GetSnapshot` | cross_community | 6 |
| `Dashboard → InstallLedgerError` | cross_community | 6 |
| `Dashboard → ExpectString` | cross_community | 6 |
| `InstallFromBundledArchive → Cleanup` | cross_community | 6 |
| `Take → Extract` | intra_community | 6 |
| `ApplyGroupRule → EHRuntime` | cross_community | 6 |
| `ApplyGroupRule → Notify` | cross_community | 6 |
| `InstallFromExistingDownload → Cleanup` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Manifest | 8 calls |
| Resolver | 7 calls |
| Install | 5 calls |
| Actions | 4 calls |

## How to Explore

1. `gitnexus_context({name: "summarizeVerifyFail"})` — see callers and callees
2. `gitnexus_query({query: "installer"})` — find related execution flows
3. Read key files listed above for implementation details
