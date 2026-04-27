---
name: actions
description: "Skill for the Actions area of vortex-mod-monitor. 51 symbols across 6 files."
---

# Actions

51 symbols | 6 files | Cohesion: 75%

## When to Use

- Working with code in `src/`
- Understanding how createBuildPackageAction, reconcileExternalModsConfig, getModArchivePath work
- Modifying actions-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/actions/installCollectionAction.ts` | renderPlanDialog, formatPlanText, formatVerdict, formatInstallTarget, formatSummary (+24) |
| `src/actions/buildPackageAction.ts` | createBuildPackageAction, promptCuratorMetadata, validateCuratorInput, resolveVortexVersion, resolveGameVersion (+10) |
| `src/ui/pages/build/engine.ts` | isNexusMod, resolveBundledArchives, readPluginsTxtIfPresent |
| `src/core/comparePlugins.ts` | getLocalAppDataPath, getCurrentPluginsTxtPath |
| `src/core/manifest/collectionConfig.ts` | reconcileExternalModsConfig |
| `src/core/archiveHashing.ts` | getModArchivePath |

## Entry Points

Start here when exploring this area:

- **`createBuildPackageAction`** (Function) — `src/actions/buildPackageAction.ts:107`
- **`reconcileExternalModsConfig`** (Function) — `src/core/manifest/collectionConfig.ts:208`
- **`getModArchivePath`** (Function) — `src/core/archiveHashing.ts:78`
- **`getCurrentPluginsTxtPath`** (Function) — `src/core/comparePlugins.ts:157`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createBuildPackageAction` | Function | `src/actions/buildPackageAction.ts` | 107 |
| `reconcileExternalModsConfig` | Function | `src/core/manifest/collectionConfig.ts` | 208 |
| `getModArchivePath` | Function | `src/core/archiveHashing.ts` | 78 |
| `getCurrentPluginsTxtPath` | Function | `src/core/comparePlugins.ts` | 157 |
| `BundleResolutionError` | Class | `src/actions/buildPackageAction.ts` | 563 |
| `promptCuratorMetadata` | Function | `src/actions/buildPackageAction.ts` | 338 |
| `validateCuratorInput` | Function | `src/actions/buildPackageAction.ts` | 432 |
| `resolveVortexVersion` | Function | `src/actions/buildPackageAction.ts` | 450 |
| `resolveGameVersion` | Function | `src/actions/buildPackageAction.ts` | 461 |
| `resolveDeploymentMethod` | Function | `src/actions/buildPackageAction.ts` | 487 |
| `buildOutputFileName` | Function | `src/actions/buildPackageAction.ts` | 541 |
| `slugify` | Function | `src/actions/buildPackageAction.ts` | 547 |
| `formatError` | Function | `src/actions/buildPackageAction.ts` | 668 |
| `formatBytes` | Function | `src/actions/buildPackageAction.ts` | 692 |
| `renderPlanDialog` | Function | `src/actions/installCollectionAction.ts` | 318 |
| `formatPlanText` | Function | `src/actions/installCollectionAction.ts` | 349 |
| `formatVerdict` | Function | `src/actions/installCollectionAction.ts` | 421 |
| `formatInstallTarget` | Function | `src/actions/installCollectionAction.ts` | 434 |
| `formatSummary` | Function | `src/actions/installCollectionAction.ts` | 456 |
| `formatModBuckets` | Function | `src/actions/installCollectionAction.ts` | 549 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CreateBuildPackageAction → ValidateCuratorInput` | intra_community | 3 |
| `CreateComparePluginsAction → GetLocalAppDataPath` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Resolver | 6 calls |
| Manifest | 4 calls |
| Build | 3 calls |
| Installer | 2 calls |
| Install | 1 calls |
| Cluster_21 | 1 calls |
| Cluster_14 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "createBuildPackageAction"})` — see callers and callees
2. `gitnexus_query({query: "actions"})` — find related execution flows
3. Read key files listed above for implementation details
