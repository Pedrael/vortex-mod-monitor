---
name: manifest
description: "Skill for the Manifest area of vortex-mod-monitor. 123 symbols across 12 files."
---

# Manifest

123 symbols | 12 files | Cohesion: 84%

## When to Use

- Working with code in `src/`
- Understanding how parseManifest, extractBundledFromEhcoll, readEhcoll work
- Modifying manifest-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/manifest/parseManifest.ts` | ParseManifestError, parseManifest, validatePackage, validateGame, validateVortex (+38) |
| `src/core/manifest/buildManifest.ts` | BuildManifestError, buildManifest, validateGameId, buildPackageMetadata, buildRules (+13) |
| `src/core/manifest/packageZip.ts` | checkAbort, packageEhcoll, validateInput, prepareStagingDir, writeOptionalMarkdown (+12) |
| `src/core/manifest/readEhcoll.ts` | ReadEhcollError, readEhcoll, assertReadableFile, listZipEntries, crossCheckBundled (+7) |
| `src/core/manifest/collectionConfig.ts` | getCollectionConfigPath, loadOrCreateCollectionConfig, saveCollectionConfig, createDefaultConfig, writeConfigFile (+5) |
| `src/utils/utils.ts` | getModCompareKey, sortDeep, deepEqualStable, compareMods, buildModsMap (+1) |
| `src/core/archiveHashing.ts` | AbortError, hashFileSha256, onAbort, cleanup, pMap |
| `src/core/comparePlugins.ts` | normalizePluginName, parsePluginsTxt, toPluginMap, comparePluginsEntries, comparePluginsTxtFiles |
| `src/core/manifest/sevenZip.ts` | list, extract, resolveSevenZip, add |
| `src/core/installer/modInstall.ts` | extractBundledFromEhcoll |

## Entry Points

Start here when exploring this area:

- **`parseManifest`** (Function) — `src/core/manifest/parseManifest.ts:136`
- **`extractBundledFromEhcoll`** (Function) — `src/core/installer/modInstall.ts:452`
- **`readEhcoll`** (Function) — `src/core/manifest/readEhcoll.ts:154`
- **`buildManifest`** (Function) — `src/core/manifest/buildManifest.ts:181`
- **`hashFileSha256`** (Function) — `src/core/archiveHashing.ts:31`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ParseManifestError` | Class | `src/core/manifest/parseManifest.ts` | 114 |
| `ReadEhcollError` | Class | `src/core/manifest/readEhcoll.ts` | 124 |
| `BuildManifestError` | Class | `src/core/manifest/buildManifest.ts` | 165 |
| `AbortError` | Class | `src/core/archiveHashing.ts` | 16 |
| `PackageEhcollError` | Class | `src/core/manifest/packageZip.ts` | 106 |
| `CollectionConfigError` | Class | `src/core/manifest/collectionConfig.ts` | 132 |
| `parseManifest` | Function | `src/core/manifest/parseManifest.ts` | 136 |
| `extractBundledFromEhcoll` | Function | `src/core/installer/modInstall.ts` | 452 |
| `readEhcoll` | Function | `src/core/manifest/readEhcoll.ts` | 154 |
| `buildManifest` | Function | `src/core/manifest/buildManifest.ts` | 181 |
| `hashFileSha256` | Function | `src/core/archiveHashing.ts` | 31 |
| `onAbort` | Function | `src/core/archiveHashing.ts` | 43 |
| `cleanup` | Function | `src/core/archiveHashing.ts` | 51 |
| `checkAbort` | Function | `src/core/manifest/packageZip.ts` | 138 |
| `checkAbort` | Function | `src/ui/pages/install/engine.ts` | 103 |
| `checkAbort` | Function | `src/ui/pages/build/engine.ts` | 314 |
| `resolveSevenZip` | Function | `src/core/manifest/sevenZip.ts` | 118 |
| `packageEhcoll` | Function | `src/core/manifest/packageZip.ts` | 128 |
| `getModCompareKey` | Function | `src/utils/utils.ts` | 214 |
| `sortDeep` | Function | `src/utils/utils.ts` | 235 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ExecuteDecision → Extract` | cross_community | 6 |
| `OnBuild → AbortError` | cross_community | 5 |
| `OnBuild → GetCollectionConfigPath` | cross_community | 5 |
| `OnBuild → CreateDefaultConfig` | cross_community | 5 |
| `OnBuild → WriteConfigFile` | cross_community | 5 |
| `PickFile → ReadEhcollError` | cross_community | 5 |
| `Build → CollectionConfigError` | cross_community | 5 |
| `ExecuteDecision → ResolveSevenZip` | cross_community | 5 |
| `RunLoadingPipeline → List` | cross_community | 4 |
| `RunLoadingPipeline → ReadEhcollError` | cross_community | 4 |

## How to Explore

1. `gitnexus_context({name: "parseManifest"})` — see callers and callees
2. `gitnexus_query({query: "manifest"})` — find related execution flows
3. Read key files listed above for implementation details
