---
name: gitnexus-area-manifest
description: "Skill for the Manifest area of vortex-mod-monitor. 180 symbols across 28 files."
---

# Manifest

180 symbols | 28 files | Cohesion: 84%

## When to Use

- Working with code in `src/`
- Understanding how parseManifest, attrNamed, childNamed work
- Modifying manifest-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/manifest/parseManifest.ts` | ParseManifestError, crossReferenceValidate, describe, expectArray, expectBoolean (+44) |
| `src/core/manifest/buildManifest.ts` | BuildManifestError, buildFileOverrides, buildLoadOrder, buildManifest, buildPackageMetadata (+15) |
| `src/core/manifest/packageZip.ts` | isAbortLikeError, packageEhcoll, checkAbort, prepareStagingDir, safeRmDir (+12) |
| `src/core/manifest/readEhcoll.ts` | ReadEhcollError, assertReadableFile, crossCheckBundled, extractManifest, listZipEntries (+7) |
| `src/core/manifest/collectionConfig.ts` | createDefaultConfig, getCollectionConfigPath, loadOrCreateCollectionConfig, saveCollectionConfig, validateSlug (+6) |
| `src/core/manifest/parseModuleConfig.ts` | decodeModuleConfig, parseConditionals, parseFiles, parseGroup, parseModuleConfig (+3) |
| `src/core/manifest/archiveContents.ts` | isDirectoryEntry, listArchiveContents, finish, onAbort, normalizeArchivePath (+3) |
| `src/core/manifest/miniXml.ts` | attrNamed, childNamed, childrenNamed, decodeEntities, parseXml (+1) |
| `src/core/comparePlugins.ts` | comparePluginsEntries, comparePluginsTxtFiles, normalizePluginName, parsePluginsTxt, toPluginMap |
| `src/core/manifest/expandFomodPlan.ts` | expandFomodPlan, place, join, norm, trim |

## Entry Points

Start here when exploring this area:

- **`parseManifest`** (Function) — `src/core/manifest/parseManifest.ts:142`
- **`attrNamed`** (Function) — `src/core/manifest/miniXml.ts:200`
- **`childNamed`** (Function) — `src/core/manifest/miniXml.ts:195`
- **`childrenNamed`** (Function) — `src/core/manifest/miniXml.ts:188`
- **`decodeEntities`** (Function) — `src/core/manifest/miniXml.ts:52`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ParseManifestError` | Class | `src/core/manifest/parseManifest.ts` | 120 |
| `BuildManifestError` | Class | `src/core/manifest/buildManifest.ts` | 184 |
| `ReadEhcollError` | Class | `src/core/manifest/readEhcoll.ts` | 124 |
| `CollectionConfigError` | Class | `src/core/manifest/collectionConfig.ts` | 164 |
| `PackageEhcollError` | Class | `src/core/manifest/packageZip.ts` | 106 |
| `parseManifest` | Function | `src/core/manifest/parseManifest.ts` | 142 |
| `attrNamed` | Function | `src/core/manifest/miniXml.ts` | 200 |
| `childNamed` | Function | `src/core/manifest/miniXml.ts` | 195 |
| `childrenNamed` | Function | `src/core/manifest/miniXml.ts` | 188 |
| `decodeEntities` | Function | `src/core/manifest/miniXml.ts` | 52 |
| `parseXml` | Function | `src/core/manifest/miniXml.ts` | 75 |
| `isNameChar` | Function | `src/core/manifest/miniXml.ts` | 81 |
| `decodeModuleConfig` | Function | `src/core/manifest/parseModuleConfig.ts` | 33 |
| `parseModuleConfig` | Function | `src/core/manifest/parseModuleConfig.ts` | 171 |
| `buildManifest` | Function | `src/core/manifest/buildManifest.ts` | 200 |
| `readEhcoll` | Function | `src/core/manifest/readEhcoll.ts` | 154 |
| `enrichModsWithArchiveHashes` | Function | `src/core/archiveHashing.ts` | 141 |
| `hashFileSha256` | Function | `src/core/archiveHashing.ts` | 34 |
| `cleanup` | Function | `src/core/archiveHashing.ts` | 54 |
| `verifyModInstall` | Function | `src/core/installer/verifyModInstall.ts` | 150 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RunSelfChecks → GetVortexUserDataPath` | cross_community | 7 |
| `ExecuteDivergedChoice → ResolveSevenZip` | cross_community | 4 |
| `BuildManifest → BuildModInstallSpec` | cross_community | 4 |
| `BuildManifest → BuildModInstallState` | cross_community | 4 |
| `BuildManifest → DeriveArchiveName` | cross_community | 4 |
| `BuildManifest → ComputeStagingSetHash` | cross_community | 4 |
| `BuildManifest → BuildUiAttributes` | cross_community | 4 |
| `BuildManifest → SynthesizeRuleReference` | intra_community | 4 |
| `CaptureStagingFiles → Cleanup` | intra_community | 4 |
| `SelfCheckMod → DecodeEntities` | cross_community | 4 |

## How to Explore

1. `context({name: "parseManifest"})` — see callers and callees
2. `query({search_query: "manifest"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
