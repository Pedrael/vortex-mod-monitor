---
name: manifest
description: "Skill for the Manifest area of vortex-mod-monitor. 120 symbols across 8 files."
---

# Manifest

120 symbols | 8 files | Cohesion: 87%

## When to Use

- Working with code in `src/`
- Understanding how parseManifest, buildManifest, packageEhcoll work
- Modifying manifest-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/manifest/parseManifest.ts` | ParseManifestError, parseManifest, validatePackage, validateGame, validateVortex (+44) |
| `src/core/manifest/buildManifest.ts` | BuildManifestError, buildManifest, validateGameId, buildPackageMetadata, buildRules (+15) |
| `src/core/manifest/packageZip.ts` | packageEhcoll, checkAbort, validateInput, prepareStagingDir, writeOptionalMarkdown (+12) |
| `src/core/manifest/readEhcoll.ts` | ReadEhcollError, readEhcoll, assertReadableFile, listZipEntries, crossCheckBundled (+7) |
| `src/core/manifest/collectionConfig.ts` | getCollectionConfigPath, loadOrCreateCollectionConfig, saveCollectionConfig, createDefaultConfig, writeConfigFile (+6) |
| `src/core/comparePlugins.ts` | normalizePluginName, parsePluginsTxt, toPluginMap, comparePluginsEntries, comparePluginsTxtFiles |
| `src/utils/utils.ts` | getModCompareKey, sortDeep, deepEqualStable, compareMods, compareSnapshots |
| `src/core/manifest/stagingSetHash.ts` | computeStagingSetHash |

## Entry Points

Start here when exploring this area:

- **`parseManifest`** (Function) — `src/core/manifest/parseManifest.ts:142`
- **`buildManifest`** (Function) — `src/core/manifest/buildManifest.ts:200`
- **`packageEhcoll`** (Function) — `src/core/manifest/packageZip.ts:128`
- **`checkAbort`** (Function) — `src/core/manifest/packageZip.ts:138`
- **`computeStagingSetHash`** (Function) — `src/core/manifest/stagingSetHash.ts:51`

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
| `packageEhcoll` | Function | `src/core/manifest/packageZip.ts` | 128 |
| `checkAbort` | Function | `src/core/manifest/packageZip.ts` | 138 |
| `computeStagingSetHash` | Function | `src/core/manifest/stagingSetHash.ts` | 51 |
| `readEhcoll` | Function | `src/core/manifest/readEhcoll.ts` | 154 |
| `parsePluginsTxt` | Function | `src/core/comparePlugins.ts` | 51 |
| `comparePluginsEntries` | Function | `src/core/comparePlugins.ts` | 80 |
| `comparePluginsTxtFiles` | Function | `src/core/comparePlugins.ts` | 167 |
| `getCollectionConfigPath` | Function | `src/core/manifest/collectionConfig.ts` | 183 |
| `loadOrCreateCollectionConfig` | Function | `src/core/manifest/collectionConfig.ts` | 200 |
| `saveCollectionConfig` | Function | `src/core/manifest/collectionConfig.ts` | 224 |
| `getModCompareKey` | Function | `src/utils/utils.ts` | 283 |
| `sortDeep` | Function | `src/utils/utils.ts` | 304 |
| `deepEqualStable` | Function | `src/utils/utils.ts` | 321 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Init → ToPluginMap` | cross_community | 5 |
| `Init → NormalizePluginName` | cross_community | 5 |
| `CompareSnapshots → StripVersionTokens` | cross_community | 5 |
| `CompareSnapshots → StripVortexPin` | cross_community | 5 |
| `RunBuildPipeline → CollectionConfigError` | cross_community | 4 |
| `RunLoadingPipeline → ReadEhcollError` | cross_community | 4 |
| `CreateInstallCollectionAction → ReadEhcollError` | cross_community | 4 |
| `BuildManifest → DeriveArchiveName` | cross_community | 4 |
| `BuildManifest → BuildModInstallSpec` | cross_community | 4 |
| `BuildManifest → BuildModInstallState` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Installer | 5 calls |
| Identity | 1 calls |

## How to Explore

1. `gitnexus_context({name: "parseManifest"})` — see callers and callees
2. `gitnexus_query({query: "manifest"})` — find related execution flows
3. Read key files listed above for implementation details
