---
name: installer
description: "Skill for the Installer area of vortex-mod-monitor. 87 symbols across 12 files."
---

# Installer

87 symbols | 12 files | Cohesion: 75%

## When to Use

- Working with code in `src/`
- Understanding how runInstall, reportProgress, checkAbort work
- Modifying installer-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/installer/runInstall.ts` | runInstall, reportProgress, checkAbort, collectRemovalPlan, deployAndWait (+30) |
| `src/core/installLedger.ts` | InstallLedgerError, getReceiptPath, getInstallLedgerDir, parseReceipt, serializeReceipt (+8) |
| `src/core/installer/modInstall.ts` | installNexusViaApi, installFromExistingDownload, installFromLocalArchive, makeAbortErrorLocal, waitForInstallCompletion (+8) |
| `src/core/installer/pluginsTxt.ts` | resolvePluginsTxtPath, serializePluginsTxt, writePluginsTxtWithBackup, serializeAsteriskFormat, serializeLegacyFormat (+2) |
| `src/core/installer/profile.ts` | createFreshProfile, pickNonCollidingName, switchToProfile, finalize, makeAbortError (+1) |
| `src/core/installer/applyModRules.ts` | AbortError, applyModRules, resolveReferenceToModId, refMatchesModId |
| `src/actions/installCollectionAction.ts` | onProgress, formatProgressMessage |
| `src/core/installer/applyLoadOrder.ts` | AbortError, applyLoadOrder |
| `src/core/manifest/sevenZip.ts` | extract, resolveSevenZip |
| `src/ui/pages/build/buildSession.ts` | getState |

## Entry Points

Start here when exploring this area:

- **`runInstall`** (Function) — `src/core/installer/runInstall.ts:163`
- **`reportProgress`** (Function) — `src/core/installer/runInstall.ts:182`
- **`checkAbort`** (Function) — `src/core/installer/runInstall.ts:191`
- **`createFreshProfile`** (Function) — `src/core/installer/profile.ts:38`
- **`pickNonCollidingName`** (Function) — `src/core/installer/profile.ts:206`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `InstallLedgerError` | Class | `src/core/installLedger.ts` | 67 |
| `runInstall` | Function | `src/core/installer/runInstall.ts` | 163 |
| `reportProgress` | Function | `src/core/installer/runInstall.ts` | 182 |
| `checkAbort` | Function | `src/core/installer/runInstall.ts` | 191 |
| `createFreshProfile` | Function | `src/core/installer/profile.ts` | 38 |
| `pickNonCollidingName` | Function | `src/core/installer/profile.ts` | 206 |
| `applyLoadOrder` | Function | `src/core/installer/applyLoadOrder.ts` | 105 |
| `getReceiptPath` | Function | `src/core/installLedger.ts` | 121 |
| `getInstallLedgerDir` | Function | `src/core/installLedger.ts` | 137 |
| `parseReceipt` | Function | `src/core/installLedger.ts` | 152 |
| `serializeReceipt` | Function | `src/core/installLedger.ts` | 253 |
| `readReceipt` | Function | `src/core/installLedger.ts` | 270 |
| `writeReceipt` | Function | `src/core/installLedger.ts` | 294 |
| `listReceipts` | Function | `src/core/installLedger.ts` | 342 |
| `onError` | Function | `src/ui/errors/ErrorContext.tsx` | 121 |
| `installNexusViaApi` | Function | `src/core/installer/modInstall.ts` | 88 |
| `installFromExistingDownload` | Function | `src/core/installer/modInstall.ts` | 151 |
| `installFromLocalArchive` | Function | `src/core/installer/modInstall.ts` | 194 |
| `resolvePluginsTxtPath` | Function | `src/core/installer/pluginsTxt.ts` | 78 |
| `serializePluginsTxt` | Function | `src/core/installer/pluginsTxt.ts` | 96 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ReceiptDetailModal → EHRuntime` | cross_community | 7 |
| `ReceiptDetailModal → Notify` | cross_community | 7 |
| `ReceiptDetailModal → GetSnapshot` | cross_community | 6 |
| `Dashboard → InstallLedgerError` | cross_community | 6 |
| `InstallFromBundledArchive → Cleanup` | cross_community | 6 |
| `InstallFromExistingDownload → Cleanup` | cross_community | 6 |
| `InstallFromLocalArchive → Cleanup` | cross_community | 6 |
| `ReceiptDetailModal → WizardReducer` | cross_community | 5 |
| `Dashboard → GetInstallLedgerDir` | cross_community | 5 |
| `Dashboard → IsUuid` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Install | 5 calls |
| Pages | 1 calls |

## How to Explore

1. `gitnexus_context({name: "runInstall"})` — see callers and callees
2. `gitnexus_query({query: "installer"})` — find related execution flows
3. Read key files listed above for implementation details
