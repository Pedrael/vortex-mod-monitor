---
name: gitnexus-area-manifest
description: "Skill for the Manifest area of vortex-mod-monitor. 145 symbols across 18 files."
---

# Manifest

145 symbols | 18 files | Cohesion: 84%

## When to Use

- Working with code in `src/`
- Understanding how parseManifest, buildManifest, extractBundledFromEhcoll work
- Modifying manifest-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/manifest/parseManifest.ts` | ParseManifestError, crossReferenceValidate, describe, expectArray, expectBoolean (+44) |
| `src/core/manifest/buildManifest.ts` | BuildManifestError, buildFileOverrides, buildLoadOrder, buildManifest, buildPackageMetadata (+15) |
| `src/core/manifest/packageZip.ts` | isAbortLikeError, packageEhcoll, checkAbort, prepareStagingDir, safeRmDir (+12) |
| `src/core/manifest/readEhcoll.ts` | ReadEhcollError, assertReadableFile, crossCheckBundled, extractManifest, listZipEntries (+7) |
| `src/core/manifest/collectionConfig.ts` | createDefaultConfig, getCollectionConfigPath, loadOrCreateCollectionConfig, saveCollectionConfig, validateSlug (+6) |
| `src/core/manifest/archiveContents.ts` | isDirectoryEntry, listArchiveContents, finish, onAbort, normalizeArchivePath (+3) |
| `src/core/comparePlugins.ts` | comparePluginsEntries, comparePluginsTxtFiles, normalizePluginName, parsePluginsTxt, toPluginMap |
| `src/core/manifest/sevenZip.ts` | extract, list, resolveSevenZip, add |
| `src/core/manifest/stagingFileWalker.ts` | getDefaultHashConcurrency, hashStagingFiles, toPosix, walkStagingFolder |
| `src/core/archiveHashing.ts` | enrichModsWithArchiveHashes, hashFileSha256, cleanup |

## Entry Points

Start here when exploring this area:

- **`parseManifest`** (Function) — `src/core/manifest/parseManifest.ts:142`
- **`buildManifest`** (Function) — `src/core/manifest/buildManifest.ts:200`
- **`extractBundledFromEhcoll`** (Function) — `src/core/installer/modInstall.ts:775`
- **`readEhcoll`** (Function) — `src/core/manifest/readEhcoll.ts:154`
- **`packageEhcoll`** (Function) — `src/core/manifest/packageZip.ts:128`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ParseManifestError` | Class | `src/core/manifest/parseManifest.ts` | 120 |
| `BuildManifestError` | Class | `src/core/manifest/buildManifest.ts` | 184 |
| `ReadEhcollError` | Class | `src/core/manifest/readEhcoll.ts` | 124 |
| `CollectionConfigError` | Class | `src/core/manifest/collectionConfig.ts` | 164 |
| `PackageEhcollError` | Class | `src/core/manifest/packageZip.ts` | 106 |
| `parseManifest` | Function | `src/core/manifest/parseManifest.ts` | 142 |
| `buildManifest` | Function | `src/core/manifest/buildManifest.ts` | 200 |
| `extractBundledFromEhcoll` | Function | `src/core/installer/modInstall.ts` | 775 |
| `readEhcoll` | Function | `src/core/manifest/readEhcoll.ts` | 154 |
| `packageEhcoll` | Function | `src/core/manifest/packageZip.ts` | 128 |
| `checkAbort` | Function | `src/core/manifest/packageZip.ts` | 138 |
| `resolveSevenZip` | Function | `src/core/manifest/sevenZip.ts` | 134 |
| `enrichModsWithArchiveHashes` | Function | `src/core/archiveHashing.ts` | 141 |
| `hashFileSha256` | Function | `src/core/archiveHashing.ts` | 34 |
| `cleanup` | Function | `src/core/archiveHashing.ts` | 54 |
| `verifyModInstall` | Function | `src/core/installer/verifyModInstall.ts` | 150 |
| `captureStagingFiles` | Function | `src/core/manifest/captureStagingFiles.ts` | 87 |
| `getDefaultHashConcurrency` | Function | `src/core/manifest/stagingFileWalker.ts` | 47 |
| `hashStagingFiles` | Function | `src/core/manifest/stagingFileWalker.ts` | 165 |
| `pMap` | Function | `src/utils/pMap.ts` | 20 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ExecuteDivergedChoice → SafeRmTempDir` | cross_community | 5 |
| `ExecuteDivergedChoice → Extract` | cross_community | 5 |
| `ExecuteDivergedChoice → ResolveSevenZip` | cross_community | 4 |
| `BuildManifest → BuildModInstallSpec` | cross_community | 4 |
| `BuildManifest → BuildModInstallState` | cross_community | 4 |
| `BuildManifest → DeriveArchiveName` | cross_community | 4 |
| `BuildManifest → ComputeStagingSetHash` | cross_community | 4 |
| `BuildManifest → BuildUiAttributes` | cross_community | 4 |
| `BuildManifest → SynthesizeRuleReference` | intra_community | 4 |
| `CaptureStagingFiles → Cleanup` | intra_community | 4 |

## How to Explore

1. `context({name: "parseManifest"})` — see callers and callees
2. `query({search_query: "manifest"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
