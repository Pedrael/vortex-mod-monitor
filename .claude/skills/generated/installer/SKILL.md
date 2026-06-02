---
name: installer
description: "Skill for the Installer area of vortex-mod-monitor. 113 symbols across 17 files."
---

# Installer

113 symbols | 17 files | Cohesion: 76%

## When to Use

- Working with code in `src/`
- Understanding how uninstallMod, createFreshProfile, enableModInProfile work
- Modifying installer-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/installer/runInstall.ts` | runInstall, reportProgress, checkAbort, collectBundledZipEntriesForPrefetch, collectRemovalPlan (+38) |
| `src/core/installer/modInstall.ts` | uninstallMod, installFromBundledArchive, extractBundledFromEhcoll, safeRmTempDir, installNexusViaApi (+10) |
| `src/core/installer/applyUserlist.ts` | applyUserlist, applyGroupDefinition, applyGroupRule, applyPluginEntry, applyPluginGroup (+8) |
| `src/core/installer/bundledPrefetch.ts` | BundledPrefetchPool, constructor, dispose, prime, take (+3) |
| `src/core/installer/profile.ts` | createFreshProfile, enableModInProfile, pickNonCollidingName, switchToProfile, finalize (+3) |
| `src/core/installer/verifyModInstall.ts` | summarizeVerifyFail, verifyModInstall, collectOnDiskFiles, toPosix |
| `src/core/manifest/stagingFileWalker.ts` | getDefaultHashConcurrency, walkStagingFolder, hashStagingFiles, toPosix |
| `src/core/archiveHashing.ts` | hashFileSha256, onAbort, cleanup |
| `src/core/installer/applyModRules.ts` | applyModRules, resolveReferenceToModId, refMatchesModId |
| `src/core/resolver/enrichStagingSetHashes.ts` | enrichInstalledModsWithStagingSetHashes, collectExternalStagingSetHashTargets, normalizeName |

## Entry Points

Start here when exploring this area:

- **`uninstallMod`** (Function) — `src/core/installer/modInstall.ts:258`
- **`createFreshProfile`** (Function) — `src/core/installer/profile.ts:38`
- **`enableModInProfile`** (Function) — `src/core/installer/profile.ts:181`
- **`pickNonCollidingName`** (Function) — `src/core/installer/profile.ts:206`
- **`runInstall`** (Function) — `src/core/installer/runInstall.ts:178`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BundledPrefetchPool` | Class | `src/core/installer/bundledPrefetch.ts` | 101 |
| `AbortError` | Class | `src/utils/abortError.ts` | 22 |
| `uninstallMod` | Function | `src/core/installer/modInstall.ts` | 258 |
| `createFreshProfile` | Function | `src/core/installer/profile.ts` | 38 |
| `enableModInProfile` | Function | `src/core/installer/profile.ts` | 181 |
| `pickNonCollidingName` | Function | `src/core/installer/profile.ts` | 206 |
| `runInstall` | Function | `src/core/installer/runInstall.ts` | 178 |
| `reportProgress` | Function | `src/core/installer/runInstall.ts` | 212 |
| `checkAbort` | Function | `src/core/installer/runInstall.ts` | 221 |
| `summarizeVerifyFail` | Function | `src/core/installer/verifyModInstall.ts` | 374 |
| `hashFileSha256` | Function | `src/core/archiveHashing.ts` | 34 |
| `onAbort` | Function | `src/core/archiveHashing.ts` | 46 |
| `cleanup` | Function | `src/core/archiveHashing.ts` | 54 |
| `applyLoadOrder` | Function | `src/core/installer/applyLoadOrder.ts` | 99 |
| `applyModRules` | Function | `src/core/installer/applyModRules.ts` | 127 |
| `verifyModInstall` | Function | `src/core/installer/verifyModInstall.ts` | 150 |
| `captureStagingFiles` | Function | `src/core/manifest/captureStagingFiles.ts` | 87 |
| `getDefaultHashConcurrency` | Function | `src/core/manifest/stagingFileWalker.ts` | 47 |
| `walkStagingFolder` | Function | `src/core/manifest/stagingFileWalker.ts` | 73 |
| `hashStagingFiles` | Function | `src/core/manifest/stagingFileWalker.ts` | 165 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `InstallManifestEntry → Cleanup` | cross_community | 7 |
| `ExecutePromptUserChoice → Cleanup` | cross_community | 7 |
| `RunInstall → OnExtracted` | cross_community | 6 |
| `RunInstall → AbortError` | cross_community | 6 |
| `ExecuteDivergedChoice → Cleanup` | cross_community | 6 |
| `InstallFromExistingDownload → Cleanup` | cross_community | 6 |
| `Take → OnExtracted` | intra_community | 5 |
| `Take → AbortError` | cross_community | 5 |
| `ExecuteDecision → Cleanup` | cross_community | 5 |
| `ExecuteDivergedChoice → MakeAbortErrorLocal` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Install | 2 calls |
| Cluster_22 | 1 calls |
| Manifest | 1 calls |

## How to Explore

1. `gitnexus_context({name: "uninstallMod"})` — see callers and callees
2. `gitnexus_query({query: "installer"})` — find related execution flows
3. Read key files listed above for implementation details
