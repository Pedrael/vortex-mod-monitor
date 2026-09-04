---
name: gitnexus-area-manifest
description: "Skill for the Manifest area of Event-Horizon. 330 symbols across 69 files."
---

# Manifest

330 symbols | 69 files | Cohesion: 80%

## When to Use

- Working with code in `src/`
- Understanding how parseManifest, archiveFileCacheKey, enrichModsWithArchiveHashes work
- Modifying manifest-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/manifest/parseManifest.ts` | ParseManifestError, describe, expectArray, expectBoolean, expectEnum (+45) |
| `src/core/manifest/buildManifest.ts` | BuildManifestError, buildFileOverrides, buildLoadOrder, buildManifest, buildPackageMetadata (+14) |
| `src/core/manifest/collectionConfig.ts` | isUuid, listNeverBuiltConfigs, listPublishedCollections, parseAndValidate, validateExternalDependencyEntries (+12) |
| `src/core/manifest/readZip.ts` | ZipReadError, extractZipEntryToFile, findDataOffset, findEntry, findZip64Extra (+11) |
| `src/core/manifest/packageZip.ts` | isAbortLikeError, packageEhcoll, checkAbort, prepareStagingDir, safeRmDir (+11) |
| `src/core/manifest/readEhcoll.ts` | crossCheckBundled, prepareStagingDir, readEhcoll, safeRmDir, ReadEhcollError (+7) |
| `src/core/manifest/externalHints.ts` | downloadsFromState, asMode, collectExternalHints, collectionHints, diagnoseHintSources (+6) |
| `src/core/manifest/sevenZip.ts` | assertOk, sevenZipAdd, sevenZipList, sevenZipSelfTest, add (+5) |
| `src/core/manifest/parseModuleConfig.ts` | decodeModuleConfig, parseConditionals, parseFiles, parseGroup, parseModuleConfig (+3) |
| `src/ui/pages/build/BuildDashboard.tsx` | BuildDashboard, handleOpenDraft, DashboardHeader, DraftsRootHint, EmptyState (+2) |

## Entry Points

Start here when exploring this area:

- **`parseManifest`** (Function) — `src/core/manifest/parseManifest.ts:144`
- **`archiveFileCacheKey`** (Function) — `src/core/archiveHashCache.ts:83`
- **`enrichModsWithArchiveHashes`** (Function) — `src/core/archiveHashing.ts:183`
- **`hashFileSha256`** (Function) — `src/core/archiveHashing.ts:38`
- **`cleanup`** (Function) — `src/core/archiveHashing.ts:58`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ParseManifestError` | Class | `src/core/manifest/parseManifest.ts` | 122 |
| `AbortError` | Class | `src/utils/abortError.ts` | 22 |
| `BuildManifestError` | Class | `src/core/manifest/buildManifest.ts` | 252 |
| `ZipReadError` | Class | `src/core/manifest/readZip.ts` | 56 |
| `CollectionConfigError` | Class | `src/core/manifest/collectionConfig.ts` | 247 |
| `PackageEhcollError` | Class | `src/core/manifest/packageZip.ts` | 114 |
| `ReadEhcollError` | Class | `src/core/manifest/readEhcoll.ts` | 128 |
| `parseManifest` | Function | `src/core/manifest/parseManifest.ts` | 144 |
| `archiveFileCacheKey` | Function | `src/core/archiveHashCache.ts` | 83 |
| `enrichModsWithArchiveHashes` | Function | `src/core/archiveHashing.ts` | 183 |
| `hashFileSha256` | Function | `src/core/archiveHashing.ts` | 38 |
| `cleanup` | Function | `src/core/archiveHashing.ts` | 58 |
| `onAbort` | Function | `src/core/archiveHashing.ts` | 50 |
| `recoverMissingArchives` | Function | `src/core/archiveRecovery.ts` | 247 |
| `applyLoadOrder` | Function | `src/core/installer/applyLoadOrder.ts` | 99 |
| `checkArchiveIdentity` | Function | `src/core/installer/checkArchiveIdentity.ts` | 83 |
| `verifyModInstall` | Function | `src/core/installer/verifyModInstall.ts` | 164 |
| `repackBundledExternals` | Function | `src/core/manifest/bundleFromStaging.ts` | 114 |
| `captureStagingFiles` | Function | `src/core/manifest/captureStagingFiles.ts` | 94 |
| `getDefaultHashConcurrency` | Function | `src/core/manifest/stagingFileWalker.ts` | 51 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ExecutePromptUserChoice → ZipReadError` | cross_community | 9 |
| `PublishedDetailsPanel → ZipReadError` | cross_community | 9 |
| `RunLoadingPipeline → ZipReadError` | cross_community | 8 |
| `ExecutePromptUserChoice → FindZip64Extra` | cross_community | 7 |
| `PublishedDetailsPanel → FindZip64Extra` | cross_community | 7 |
| `InstallFromBundledArchive → ZipReadError` | cross_community | 7 |
| `LoadPublishedDetails → ZipReadError` | cross_community | 7 |
| `RunSelfChecks → GetVortexUserDataPath` | cross_community | 7 |
| `CurrentFingerprint → GetVortexUserDataPath` | cross_community | 7 |
| `RunInstallImpl → AbortError` | cross_community | 6 |

## How to Explore

1. `context({name: "parseManifest"})` — see callers and callees
2. `query({search_query: "manifest"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
