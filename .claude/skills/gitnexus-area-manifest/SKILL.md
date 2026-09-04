---
name: gitnexus-area-manifest
description: "Skill for the Manifest area of Event-Horizon. 331 symbols across 62 files."
---

# Manifest

331 symbols | 62 files | Cohesion: 80%

## When to Use

- Working with code in `src/`
- Understanding how parseManifest, applyCachedDownloadIds, applyCachedHashes work
- Modifying manifest-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/manifest/parseManifest.ts` | ParseManifestError, crossReferenceValidate, describe, expectArray, expectBoolean (+47) |
| `src/core/manifest/buildManifest.ts` | BuildManifestError, buildFileOverrides, buildLoadOrder, buildManifest, buildPackageMetadata (+17) |
| `src/core/manifest/collectionConfig.ts` | isUuid, listNeverBuiltConfigs, listPublishedCollections, parseAndValidate, validateExternalDependencyEntries (+12) |
| `src/core/manifest/readZip.ts` | ZipReadError, extractZipEntryToFile, findDataOffset, findEntry, findZip64Extra (+11) |
| `src/core/manifest/packageZip.ts` | isAbortLikeError, packageEhcoll, checkAbort, prepareStagingDir, runSevenZipAdd (+11) |
| `src/core/manifest/externalHints.ts` | countBy, downloadsFromState, modsFromState, asMode, collectExternalHints (+8) |
| `src/core/manifest/readEhcoll.ts` | crossCheckBundled, prepareStagingDir, readEhcoll, safeRmDir, ReadEhcollError (+7) |
| `src/core/getModsListForProfile.ts` | assignInstallOrder, getModsForProfile, hasAnySelectedFomodChoices, normalizeCollectionIds, normalizeFomodSelections (+6) |
| `src/core/manifest/sevenZip.ts` | assertOk, cancelOnAbort, sevenZipAdd, sevenZipExtractFull, sevenZipList (+5) |
| `src/core/manifest/parseModuleConfig.ts` | decodeModuleConfig, parseConditionals, parseFiles, parseGroup, parseModuleConfig (+3) |

## Entry Points

Start here when exploring this area:

- **`parseManifest`** (Function) — `src/core/manifest/parseManifest.ts:143`
- **`applyCachedDownloadIds`** (Function) — `src/core/archiveHashCache.ts:272`
- **`applyCachedHashes`** (Function) — `src/core/archiveHashCache.ts:295`
- **`describeHashedCollisions`** (Function) — `src/core/manifest/collectionScope.ts:200`
- **`describeScope`** (Function) — `src/core/manifest/collectionScope.ts:214`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ParseManifestError` | Class | `src/core/manifest/parseManifest.ts` | 121 |
| `BuildManifestError` | Class | `src/core/manifest/buildManifest.ts` | 244 |
| `ZipReadError` | Class | `src/core/manifest/readZip.ts` | 56 |
| `CollectionConfigError` | Class | `src/core/manifest/collectionConfig.ts` | 247 |
| `PackageEhcollError` | Class | `src/core/manifest/packageZip.ts` | 114 |
| `ReadEhcollError` | Class | `src/core/manifest/readEhcoll.ts` | 128 |
| `parseManifest` | Function | `src/core/manifest/parseManifest.ts` | 143 |
| `applyCachedDownloadIds` | Function | `src/core/archiveHashCache.ts` | 272 |
| `applyCachedHashes` | Function | `src/core/archiveHashCache.ts` | 295 |
| `describeHashedCollisions` | Function | `src/core/manifest/collectionScope.ts` | 200 |
| `describeScope` | Function | `src/core/manifest/collectionScope.ts` | 214 |
| `describeMissingEngineFixesPart2` | Function | `src/core/manifest/externalDependencies.ts` | 352 |
| `filesProvidedByDeployment` | Function | `src/core/manifest/externalDependencies.ts` | 287 |
| `getGameDirectory` | Function | `src/core/manifest/externalDependencies.ts` | 238 |
| `countBy` | Function | `src/core/manifest/externalHints.ts` | 323 |
| `downloadsFromState` | Function | `src/core/manifest/externalHints.ts` | 271 |
| `modsFromState` | Function | `src/core/manifest/externalHints.ts` | 256 |
| `describeRootFolderReview` | Function | `src/core/manifest/rootFolderReview.ts` | 153 |
| `describeScriptExtenderGap` | Function | `src/core/manifest/rootFolderReview.ts` | 102 |
| `findRootFolderMods` | Function | `src/core/manifest/rootFolderReview.ts` | 55 |

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
| `RunLoadingPipeline → FindZip64Extra` | cross_community | 6 |

## How to Explore

1. `context({name: "parseManifest"})` — see callers and callees
2. `query({search_query: "manifest"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
