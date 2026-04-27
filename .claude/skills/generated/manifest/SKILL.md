---
name: manifest
description: "Skill for the Manifest area of vortex-mod-monitor. 135 symbols across 15 files."
---

# Manifest

135 symbols | 15 files | Cohesion: 85%

## When to Use

- Working with code in `src/`
- Understanding how parseManifest, enrichInstalledModsWithStagingSetHashes, getDefaultHashConcurrency work
- Modifying manifest-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/manifest/parseManifest.ts` | ParseManifestError, parseManifest, validatePackage, validateGame, validateVortex (+44) |
| `src/core/manifest/buildManifest.ts` | BuildManifestError, buildManifest, validateGameId, buildPackageMetadata, buildRules (+15) |
| `src/core/manifest/packageZip.ts` | packageEhcoll, checkAbort, validateInput, prepareStagingDir, writeOptionalMarkdown (+12) |
| `src/core/manifest/readEhcoll.ts` | ReadEhcollError, readEhcoll, assertReadableFile, listZipEntries, crossCheckBundled (+7) |
| `src/core/manifest/collectionConfig.ts` | getCollectionConfigPath, loadOrCreateCollectionConfig, saveCollectionConfig, createDefaultConfig, writeConfigFile (+5) |
| `src/utils/utils.ts` | getModCompareKey, sortDeep, deepEqualStable, compareMods, buildModsMap (+1) |
| `src/core/comparePlugins.ts` | normalizePluginName, parsePluginsTxt, toPluginMap, comparePluginsEntries, comparePluginsTxtFiles |
| `src/core/manifest/stagingFileWalker.ts` | getDefaultHashConcurrency, walkStagingFolder, hashStagingFiles, toPosix |
| `src/core/resolver/enrichStagingSetHashes.ts` | enrichInstalledModsWithStagingSetHashes, collectExternalStagingSetHashTargets, normalizeName |
| `src/core/manifest/sevenZip.ts` | resolveSevenZip, list, add |

## Entry Points

Start here when exploring this area:

- **`parseManifest`** (Function) — `src/core/manifest/parseManifest.ts:142`
- **`enrichInstalledModsWithStagingSetHashes`** (Function) — `src/core/resolver/enrichStagingSetHashes.ts:94`
- **`getDefaultHashConcurrency`** (Function) — `src/core/manifest/stagingFileWalker.ts:47`
- **`walkStagingFolder`** (Function) — `src/core/manifest/stagingFileWalker.ts:73`
- **`hashStagingFiles`** (Function) — `src/core/manifest/stagingFileWalker.ts:165`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ParseManifestError` | Class | `src/core/manifest/parseManifest.ts` | 120 |
| `BuildManifestError` | Class | `src/core/manifest/buildManifest.ts` | 184 |
| `ReadEhcollError` | Class | `src/core/manifest/readEhcoll.ts` | 124 |
| `PackageEhcollError` | Class | `src/core/manifest/packageZip.ts` | 106 |
| `CollectionConfigError` | Class | `src/core/manifest/collectionConfig.ts` | 132 |
| `parseManifest` | Function | `src/core/manifest/parseManifest.ts` | 142 |
| `enrichInstalledModsWithStagingSetHashes` | Function | `src/core/resolver/enrichStagingSetHashes.ts` | 94 |
| `getDefaultHashConcurrency` | Function | `src/core/manifest/stagingFileWalker.ts` | 47 |
| `walkStagingFolder` | Function | `src/core/manifest/stagingFileWalker.ts` | 73 |
| `hashStagingFiles` | Function | `src/core/manifest/stagingFileWalker.ts` | 165 |
| `captureStagingFiles` | Function | `src/core/manifest/captureStagingFiles.ts` | 87 |
| `reportProgress` | Function | `src/core/installer/runInstall.ts` | 212 |
| `buildManifest` | Function | `src/core/manifest/buildManifest.ts` | 200 |
| `resolveSevenZip` | Function | `src/core/manifest/sevenZip.ts` | 118 |
| `packageEhcoll` | Function | `src/core/manifest/packageZip.ts` | 128 |
| `checkAbort` | Function | `src/core/manifest/packageZip.ts` | 138 |
| `computeStagingSetHash` | Function | `src/core/manifest/stagingSetHash.ts` | 51 |
| `readEhcoll` | Function | `src/core/manifest/readEhcoll.ts` | 154 |
| `getModCompareKey` | Function | `src/utils/utils.ts` | 232 |
| `sortDeep` | Function | `src/utils/utils.ts` | 253 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `OnBuild → GetCollectionConfigPath` | cross_community | 5 |
| `OnBuild → CreateDefaultConfig` | cross_community | 5 |
| `OnBuild → WriteConfigFile` | cross_community | 5 |
| `PickFile → ReadEhcollError` | cross_community | 5 |
| `Build → CollectionConfigError` | cross_community | 5 |
| `RunLoadingPipeline → List` | cross_community | 4 |
| `RunLoadingPipeline → ReadEhcollError` | cross_community | 4 |
| `CreateInstallCollectionAction → ReadEhcollError` | cross_community | 4 |
| `CreateInstallCollectionAction → List` | cross_community | 4 |
| `ImportPreviousButton → ReadEhcollError` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Installer | 10 calls |

## How to Explore

1. `gitnexus_context({name: "parseManifest"})` — see callers and callees
2. `gitnexus_query({query: "manifest"})` — find related execution flows
3. Read key files listed above for implementation details
