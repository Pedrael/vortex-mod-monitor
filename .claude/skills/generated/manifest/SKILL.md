---
name: manifest
description: "Skill for the Manifest area of vortex-mod-monitor. 127 symbols across 11 files."
---

# Manifest

127 symbols | 11 files | Cohesion: 85%

## When to Use

- Working with code in `src/`
- Understanding how parseManifest, buildManifest, readEhcoll work
- Modifying manifest-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/manifest/parseManifest.ts` | ParseManifestError, parseManifest, validatePackage, validateGame, validateVortex (+43) |
| `src/core/manifest/buildManifest.ts` | BuildManifestError, buildManifest, validateGameId, buildPackageMetadata, buildRules (+15) |
| `src/core/manifest/packageZip.ts` | checkAbort, writeManifestJson, packageEhcoll, validateInput, prepareStagingDir (+12) |
| `src/core/manifest/readEhcoll.ts` | ReadEhcollError, readEhcoll, assertReadableFile, listZipEntries, crossCheckBundled (+7) |
| `src/core/manifest/collectionConfig.ts` | getCollectionConfigPath, loadOrCreateCollectionConfig, saveCollectionConfig, createDefaultConfig, writeConfigFile (+5) |
| `src/utils/utils.ts` | getModCompareKey, sortDeep, deepEqualStable, compareMods, buildModsMap (+1) |
| `src/core/archiveHashing.ts` | AbortError, hashFileSha256, onAbort, cleanup, pMap |
| `src/core/comparePlugins.ts` | normalizePluginName, parsePluginsTxt, toPluginMap, comparePluginsEntries, comparePluginsTxtFiles |
| `src/core/manifest/sevenZip.ts` | list, add |
| `src/ui/pages/install/engine.ts` | checkAbort |

## Entry Points

Start here when exploring this area:

- **`parseManifest`** (Function) — `src/core/manifest/parseManifest.ts:140`
- **`buildManifest`** (Function) — `src/core/manifest/buildManifest.ts:187`
- **`readEhcoll`** (Function) — `src/core/manifest/readEhcoll.ts:154`
- **`hashFileSha256`** (Function) — `src/core/archiveHashing.ts:31`
- **`onAbort`** (Function) — `src/core/archiveHashing.ts:43`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ParseManifestError` | Class | `src/core/manifest/parseManifest.ts` | 118 |
| `BuildManifestError` | Class | `src/core/manifest/buildManifest.ts` | 171 |
| `ReadEhcollError` | Class | `src/core/manifest/readEhcoll.ts` | 124 |
| `AbortError` | Class | `src/core/archiveHashing.ts` | 16 |
| `PackageEhcollError` | Class | `src/core/manifest/packageZip.ts` | 106 |
| `CollectionConfigError` | Class | `src/core/manifest/collectionConfig.ts` | 132 |
| `parseManifest` | Function | `src/core/manifest/parseManifest.ts` | 140 |
| `buildManifest` | Function | `src/core/manifest/buildManifest.ts` | 187 |
| `readEhcoll` | Function | `src/core/manifest/readEhcoll.ts` | 154 |
| `hashFileSha256` | Function | `src/core/archiveHashing.ts` | 31 |
| `onAbort` | Function | `src/core/archiveHashing.ts` | 43 |
| `cleanup` | Function | `src/core/archiveHashing.ts` | 51 |
| `checkAbort` | Function | `src/core/manifest/packageZip.ts` | 138 |
| `checkAbort` | Function | `src/ui/pages/install/engine.ts` | 103 |
| `checkAbort` | Function | `src/ui/pages/build/engine.ts` | 316 |
| `getModCompareKey` | Function | `src/utils/utils.ts` | 232 |
| `sortDeep` | Function | `src/utils/utils.ts` | 253 |
| `deepEqualStable` | Function | `src/utils/utils.ts` | 270 |
| `compareMods` | Function | `src/utils/utils.ts` | 274 |
| `compareSnapshots` | Function | `src/utils/utils.ts` | 325 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `OnBuild → AbortError` | cross_community | 5 |
| `OnBuild → GetCollectionConfigPath` | cross_community | 5 |
| `OnBuild → CreateDefaultConfig` | cross_community | 5 |
| `OnBuild → WriteConfigFile` | cross_community | 5 |
| `PickFile → ReadEhcollError` | cross_community | 5 |
| `Build → CollectionConfigError` | cross_community | 5 |
| `RunLoadingPipeline → List` | cross_community | 4 |
| `RunLoadingPipeline → ReadEhcollError` | cross_community | 4 |
| `CreateInstallCollectionAction → ReadEhcollError` | cross_community | 4 |
| `CreateInstallCollectionAction → List` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Installer | 3 calls |

## How to Explore

1. `gitnexus_context({name: "parseManifest"})` — see callers and callees
2. `gitnexus_query({query: "manifest"})` — find related execution flows
3. Read key files listed above for implementation details
