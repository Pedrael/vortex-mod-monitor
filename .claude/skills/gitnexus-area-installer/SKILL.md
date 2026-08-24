---
name: gitnexus-area-installer
description: "Skill for the Installer area of vortex-mod-monitor. 101 symbols across 16 files."
---

# Installer

101 symbols | 16 files | Cohesion: 78%

## When to Use

- Working with code in `src/`
- Understanding how safeRmTempDir, uninstallMod, createFreshProfile work
- Modifying installer-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/installer/runInstall.ts` | buildDisplayNameByModId, buildFailReceipt, buildManifestIndex, buildNexusModIdMap, collect (+38) |
| `src/core/installer/modInstall.ts` | safeRmTempDir, uninstallMod, installFromBundledArchive, installFromExistingDownload, installFromLocalArchive (+9) |
| `src/core/installer/applyUserlist.ts` | applyGroupDefinition, applyGroupRule, applyPluginEntry, applyPluginGroup, applyPluginRuleWithCollectionWins (+8) |
| `src/core/installer/bundledPrefetch.ts` | BundledPrefetchPool, dispose, prime, pump, runExtraction (+2) |
| `src/core/installer/verifyModInstall.ts` | summarizeVerifyFail, collectOnDiskFiles, toPosix, verifyModInstall |
| `src/core/installer/profile.ts` | createFreshProfile, enableModInProfile, pickNonCollidingName |
| `src/core/archiveHashing.ts` | onAbort, hashFileSha256, cleanup |
| `src/core/installer/applyModRules.ts` | applyModRules, refMatchesModId, resolveReferenceToModId |
| `src/actions/installCollectionAction.ts` | formatProgressMessage, onProgress |
| `src/ui/pages/install/engine.ts` | checkAbort, checkAbort |

## Entry Points

Start here when exploring this area:

- **`safeRmTempDir`** (Function) — `src/core/installer/modInstall.ts:826`
- **`uninstallMod`** (Function) — `src/core/installer/modInstall.ts:258`
- **`createFreshProfile`** (Function) — `src/core/installer/profile.ts:38`
- **`enableModInProfile`** (Function) — `src/core/installer/profile.ts:181`
- **`pickNonCollidingName`** (Function) — `src/core/installer/profile.ts:206`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BundledPrefetchPool` | Class | `src/core/installer/bundledPrefetch.ts` | 101 |
| `AbortError` | Class | `src/utils/abortError.ts` | 22 |
| `safeRmTempDir` | Function | `src/core/installer/modInstall.ts` | 826 |
| `uninstallMod` | Function | `src/core/installer/modInstall.ts` | 258 |
| `createFreshProfile` | Function | `src/core/installer/profile.ts` | 38 |
| `enableModInProfile` | Function | `src/core/installer/profile.ts` | 181 |
| `pickNonCollidingName` | Function | `src/core/installer/profile.ts` | 206 |
| `runInstall` | Function | `src/core/installer/runInstall.ts` | 178 |
| `checkAbort` | Function | `src/core/installer/runInstall.ts` | 221 |
| `reportProgress` | Function | `src/core/installer/runInstall.ts` | 212 |
| `summarizeVerifyFail` | Function | `src/core/installer/verifyModInstall.ts` | 374 |
| `installFromBundledArchive` | Function | `src/core/installer/modInstall.ts` | 302 |
| `installFromExistingDownload` | Function | `src/core/installer/modInstall.ts` | 151 |
| `installFromLocalArchive` | Function | `src/core/installer/modInstall.ts` | 194 |
| `installNexusViaApi` | Function | `src/core/installer/modInstall.ts` | 88 |
| `onCarry` | Function | `src/core/installer/runInstall.ts` | 405 |
| `onSkip` | Function | `src/core/installer/runInstall.ts` | 404 |
| `onTempArchive` | Function | `src/core/installer/runInstall.ts` | 403 |
| `applyUserlist` | Function | `src/core/installer/applyUserlist.ts` | 179 |
| `onAbort` | Function | `src/core/archiveHashing.ts` | 46 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ExecuteDivergedChoice → Cleanup` | cross_community | 8 |
| `TryRecoverFailedMod → Cleanup` | cross_community | 8 |
| `RunInstall → AbortError` | cross_community | 6 |
| `RunInstall → OnExtracted` | cross_community | 6 |
| `InstallFromBundledArchive → Cleanup` | cross_community | 6 |
| `InstallFromLocalArchive → Cleanup` | cross_community | 6 |
| `ExecuteDivergedChoice → SafeRmTempDir` | cross_community | 5 |
| `ExecuteDivergedChoice → Extract` | cross_community | 5 |
| `ExecuteDivergedChoice → MakeAbortErrorLocal` | intra_community | 5 |
| `Take → AbortError` | cross_community | 5 |

## How to Explore

1. `context({name: "safeRmTempDir"})` — see callers and callees
2. `query({search_query: "installer"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
