---
name: manifest
description: "Skill for the Manifest area of vortex-mod-monitor. 141 symbols across 21 files."
---

# Manifest

141 symbols | 21 files | Cohesion: 82%

## When to Use

- Working with code in `src/`
- Understanding how parseManifest, pMap, hashFileSha256 work
- Modifying manifest-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/manifest/parseManifest.ts` | ParseManifestError, parseManifest, validatePackage, validateGame, validateVortex (+42) |
| `src/core/manifest/packageZip.ts` | packageEhcoll, checkAbort, validateInput, prepareStagingDir, writeOptionalMarkdown (+12) |
| `src/core/manifest/buildManifest.ts` | buildModEntry, isNexusMod, buildNexusMod, buildExternalMod, deriveArchiveName (+12) |
| `src/core/manifest/readEhcoll.ts` | ReadEhcollError, readEhcoll, assertReadableFile, listZipEntries, crossCheckBundled (+7) |
| `src/core/manifest/collectionConfig.ts` | CollectionConfigError, listPublishedCollections, parseAndValidate, validateExternalMods, isUuid (+6) |
| `src/utils/utils.ts` | getModCompareKey, sortDeep, deepEqualStable, compareMods, buildModsMap (+1) |
| `src/core/comparePlugins.ts` | normalizePluginName, parsePluginsTxt, toPluginMap, comparePluginsEntries, comparePluginsTxtFiles |
| `src/core/manifest/stagingFileWalker.ts` | getDefaultHashConcurrency, walkStagingFolder, hashStagingFiles, toPosix |
| `src/core/archiveHashing.ts` | hashFileSha256, onAbort, cleanup |
| `src/core/resolver/enrichStagingSetHashes.ts` | enrichInstalledModsWithStagingSetHashes, collectExternalStagingSetHashTargets, normalizeName |

## Entry Points

Start here when exploring this area:

- **`parseManifest`** (Function) — `src/core/manifest/parseManifest.ts:142`
- **`pMap`** (Function) — `src/utils/pMap.ts:20`
- **`hashFileSha256`** (Function) — `src/core/archiveHashing.ts:34`
- **`onAbort`** (Function) — `src/core/archiveHashing.ts:46`
- **`cleanup`** (Function) — `src/core/archiveHashing.ts:54`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ParseManifestError` | Class | `src/core/manifest/parseManifest.ts` | 120 |
| `AbortError` | Class | `src/utils/abortError.ts` | 22 |
| `ReadEhcollError` | Class | `src/core/manifest/readEhcoll.ts` | 124 |
| `BuildManifestError` | Class | `src/core/manifest/buildManifest.ts` | 184 |
| `CollectionConfigError` | Class | `src/core/manifest/collectionConfig.ts` | 164 |
| `PackageEhcollError` | Class | `src/core/manifest/packageZip.ts` | 106 |
| `parseManifest` | Function | `src/core/manifest/parseManifest.ts` | 142 |
| `pMap` | Function | `src/utils/pMap.ts` | 20 |
| `hashFileSha256` | Function | `src/core/archiveHashing.ts` | 34 |
| `onAbort` | Function | `src/core/archiveHashing.ts` | 46 |
| `cleanup` | Function | `src/core/archiveHashing.ts` | 54 |
| `enrichInstalledModsWithStagingSetHashes` | Function | `src/core/resolver/enrichStagingSetHashes.ts` | 117 |
| `verifyModInstall` | Function | `src/core/installer/verifyModInstall.ts` | 150 |
| `reportProgress` | Function | `src/core/installer/runInstall.ts` | 212 |
| `getDefaultHashConcurrency` | Function | `src/core/manifest/stagingFileWalker.ts` | 47 |
| `walkStagingFolder` | Function | `src/core/manifest/stagingFileWalker.ts` | 73 |
| `hashStagingFiles` | Function | `src/core/manifest/stagingFileWalker.ts` | 165 |
| `captureStagingFiles` | Function | `src/core/manifest/captureStagingFiles.ts` | 87 |
| `checkAbort` | Function | `src/ui/pages/install/engine.ts` | 104 |
| `resolveSevenZip` | Function | `src/core/manifest/sevenZip.ts` | 118 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `OnBuild → AbortError` | cross_community | 6 |
| `OnBuild → GetCollectionConfigPath` | cross_community | 6 |
| `OnBuild → CreateDefaultConfig` | cross_community | 6 |
| `OnBuild → WriteConfigFile` | cross_community | 6 |
| `Build → CollectionConfigError` | cross_community | 6 |
| `Dashboard → OnError` | cross_community | 5 |
| `PickFile → ReadEhcollError` | cross_community | 5 |
| `Take → AbortError` | cross_community | 5 |
| `RunLoadingPipeline → List` | cross_community | 4 |
| `RunLoadingPipeline → ReadEhcollError` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Actions | 13 calls |
| Resolver | 1 calls |
| Installer | 1 calls |

## How to Explore

1. `gitnexus_context({name: "parseManifest"})` — see callers and callees
2. `gitnexus_query({query: "manifest"})` — find related execution flows
3. Read key files listed above for implementation details
