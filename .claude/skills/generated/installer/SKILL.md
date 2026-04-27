---
name: installer
description: "Skill for the Installer area of vortex-mod-monitor. 43 symbols across 4 files."
---

# Installer

43 symbols | 4 files | Cohesion: 83%

## When to Use

- Working with code in `src/`
- Understanding how runInstall, reportProgress, checkAbort work
- Modifying installer-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/installer/runInstall.ts` | runInstall, reportProgress, checkAbort, collectRemovalPlan, deployAndWait (+21) |
| `src/core/installer/modInstall.ts` | safeRmTempDir, installNexusViaApi, installFromExistingDownload, installFromLocalArchive, installFromBundledArchive (+3) |
| `src/core/installer/pluginsTxt.ts` | resolvePluginsTxtPath, serializePluginsTxt, writePluginsTxtWithBackup, serializeAsteriskFormat, serializeLegacyFormat (+2) |
| `src/actions/installCollectionAction.ts` | onProgress, formatProgressMessage |

## Entry Points

Start here when exploring this area:

- **`runInstall`** (Function) — `src/core/installer/runInstall.ts:120`
- **`reportProgress`** (Function) — `src/core/installer/runInstall.ts:136`
- **`checkAbort`** (Function) — `src/core/installer/runInstall.ts:145`
- **`safeRmTempDir`** (Function) — `src/core/installer/modInstall.ts:489`
- **`installNexusViaApi`** (Function) — `src/core/installer/modInstall.ts:66`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `runInstall` | Function | `src/core/installer/runInstall.ts` | 120 |
| `reportProgress` | Function | `src/core/installer/runInstall.ts` | 136 |
| `checkAbort` | Function | `src/core/installer/runInstall.ts` | 145 |
| `safeRmTempDir` | Function | `src/core/installer/modInstall.ts` | 489 |
| `installNexusViaApi` | Function | `src/core/installer/modInstall.ts` | 66 |
| `installFromExistingDownload` | Function | `src/core/installer/modInstall.ts` | 116 |
| `installFromLocalArchive` | Function | `src/core/installer/modInstall.ts` | 152 |
| `installFromBundledArchive` | Function | `src/core/installer/modInstall.ts` | 245 |
| `resolvePluginsTxtPath` | Function | `src/core/installer/pluginsTxt.ts` | 78 |
| `serializePluginsTxt` | Function | `src/core/installer/pluginsTxt.ts` | 96 |
| `writePluginsTxtWithBackup` | Function | `src/core/installer/pluginsTxt.ts` | 114 |
| `onProgress` | Function | `src/actions/installCollectionAction.ts` | 1075 |
| `formatProgressMessage` | Function | `src/actions/installCollectionAction.ts` | 1115 |
| `collectRemovalPlan` | Function | `src/core/installer/runInstall.ts` | 824 |
| `deployAndWait` | Function | `src/core/installer/runInstall.ts` | 1055 |
| `buildReceipt` | Function | `src/core/installer/runInstall.ts` | 1124 |
| `writeReceiptWithRetry` | Function | `src/core/installer/runInstall.ts` | 1187 |
| `delay` | Function | `src/core/installer/runInstall.ts` | 1206 |
| `buildManifestIndex` | Function | `src/core/installer/runInstall.ts` | 1216 |
| `buildOrphanCarriedEntry` | Function | `src/core/installer/runInstall.ts` | 1232 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ExecuteDecision → GetSnapshot` | cross_community | 6 |
| `ExecuteDecision → Cleanup` | intra_community | 6 |
| `ExecuteDecision → Extract` | cross_community | 6 |
| `ExecuteDivergedChoice → EHRuntime` | cross_community | 6 |
| `ExecuteDivergedChoice → Notify` | cross_community | 6 |
| `ExecuteDecision → WizardReducer` | cross_community | 5 |
| `ExecuteDecision → ResolveSevenZip` | cross_community | 5 |
| `StartInstall → FormatProgressMessage` | cross_community | 5 |
| `StartInstall → NeedsConflictChoice` | cross_community | 5 |
| `RunInstall → ValidateConflictChoice` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Install | 4 calls |
| Resolver | 2 calls |
| Manifest | 2 calls |
| Pages | 1 calls |
| Errors | 1 calls |

## How to Explore

1. `gitnexus_context({name: "runInstall"})` — see callers and callees
2. `gitnexus_query({query: "installer"})` — find related execution flows
3. Read key files listed above for implementation details
