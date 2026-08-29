---
name: gitnexus-area-manifest
description: "Skill for the Manifest area of vortex-mod-monitor. 290 symbols across 50 files."
---

# Manifest

290 symbols | 50 files | Cohesion: 81%

## When to Use

- Working with code in `src/`
- Understanding how parseManifest, buildManifest, extractZipEntryToFile work
- Modifying manifest-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/manifest/parseManifest.ts` | ParseManifestError, crossReferenceValidate, describe, expectArray, expectBoolean (+47) |
| `src/core/manifest/buildManifest.ts` | BuildManifestError, buildFileOverrides, buildLoadOrder, buildManifest, buildPackageMetadata (+17) |
| `src/core/manifest/collectionConfig.ts` | isUuid, listNeverBuiltConfigs, listPublishedCollections, parseAndValidate, validateExternalDependencyEntries (+12) |
| `src/core/manifest/packageZip.ts` | isAbortLikeError, packageEhcoll, checkAbort, prepareStagingDir, runSevenZipAdd (+11) |
| `src/core/manifest/readZip.ts` | ZipReadError, extractZipEntryToFile, findDataOffset, findEntry, findZip64Extra (+9) |
| `src/core/manifest/externalHints.ts` | countBy, downloadsFromState, modsFromState, asMode, collectExternalHints (+8) |
| `src/core/manifest/readEhcoll.ts` | crossCheckBundled, prepareStagingDir, readEhcoll, safeRmDir, ReadEhcollError (+7) |
| `src/core/manifest/sevenZip.ts` | assertOk, resolveSevenZip, sevenZipAdd, sevenZipList, sevenZipSelfTest (+5) |
| `src/core/manifest/parseModuleConfig.ts` | decodeModuleConfig, parseConditionals, parseFiles, parseGroup, parseModuleConfig (+3) |
| `src/ui/pages/build/BuildDashboard.tsx` | BuildDashboard, handleOpenDraft, DashboardHeader, DraftsRootHint, EmptyState (+2) |

## Entry Points

Start here when exploring this area:

- **`parseManifest`** (Function) — `src/core/manifest/parseManifest.ts:143`
- **`buildManifest`** (Function) — `src/core/manifest/buildManifest.ts:236`
- **`extractZipEntryToFile`** (Function) — `src/core/manifest/readZip.ts:155`
- **`listZipEntries`** (Function) — `src/core/manifest/readZip.ts:85`
- **`readZipEntry`** (Function) — `src/core/manifest/readZip.ts:103`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ParseManifestError` | Class | `src/core/manifest/parseManifest.ts` | 121 |
| `BuildManifestError` | Class | `src/core/manifest/buildManifest.ts` | 220 |
| `ZipReadError` | Class | `src/core/manifest/readZip.ts` | 56 |
| `CollectionConfigError` | Class | `src/core/manifest/collectionConfig.ts` | 212 |
| `PackageEhcollError` | Class | `src/core/manifest/packageZip.ts` | 114 |
| `ReadEhcollError` | Class | `src/core/manifest/readEhcoll.ts` | 124 |
| `parseManifest` | Function | `src/core/manifest/parseManifest.ts` | 143 |
| `buildManifest` | Function | `src/core/manifest/buildManifest.ts` | 236 |
| `extractZipEntryToFile` | Function | `src/core/manifest/readZip.ts` | 155 |
| `listZipEntries` | Function | `src/core/manifest/readZip.ts` | 85 |
| `readZipEntry` | Function | `src/core/manifest/readZip.ts` | 103 |
| `getDraftsRoot` | Function | `src/core/draftStorage.ts` | 121 |
| `listDrafts` | Function | `src/core/draftStorage.ts` | 162 |
| `listNeverBuiltConfigs` | Function | `src/core/manifest/collectionConfig.ts` | 880 |
| `listPublishedCollections` | Function | `src/core/manifest/collectionConfig.ts` | 449 |
| `BuildDashboard` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 109 |
| `handleOpenDraft` | Function | `src/ui/pages/build/BuildDashboard.tsx` | 376 |
| `attrNamed` | Function | `src/core/manifest/miniXml.ts` | 200 |
| `childNamed` | Function | `src/core/manifest/miniXml.ts` | 195 |
| `childrenNamed` | Function | `src/core/manifest/miniXml.ts` | 188 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `PublishedDetailsPanel → ZipReadError` | cross_community | 9 |
| `RunLoadingPipeline → ZipReadError` | cross_community | 8 |
| `PublishedDetailsPanel → FindZip64Extra` | cross_community | 7 |
| `InstallFromBundledArchive → ZipReadError` | cross_community | 7 |
| `LoadPublishedDetails → ZipReadError` | cross_community | 7 |
| `RunSelfChecks → GetVortexUserDataPath` | cross_community | 7 |
| `CurrentFingerprint → GetVortexUserDataPath` | cross_community | 7 |
| `RunLoadingPipeline → FindZip64Extra` | cross_community | 6 |
| `PublishedDetailsPanel → ReadEhcollError` | cross_community | 5 |
| `BuildPage → IsPlainObject` | cross_community | 5 |

## How to Explore

1. `context({name: "parseManifest"})` — see callers and callees
2. `query({search_query: "manifest"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
