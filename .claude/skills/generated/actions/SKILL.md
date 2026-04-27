---
name: actions
description: "Skill for the Actions area of vortex-mod-monitor. 53 symbols across 8 files."
---

# Actions

53 symbols | 8 files | Cohesion: 76%

## When to Use

- Working with code in `src/`
- Understanding how createBuildPackageAction, captureLoadOrder, pickModArchiveFile work
- Modifying actions-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/actions/installCollectionAction.ts` | collectUserDecisions, pickConflictChoice, pickExternalPromptUserChoice, pickOrphanChoice, formatDivergedConflictText (+24) |
| `src/actions/buildPackageAction.ts` | createBuildPackageAction, promptCuratorMetadata, validateCuratorInput, resolveVortexVersion, resolveGameVersion (+10) |
| `src/ui/pages/build/engine.ts` | isNexusMod, resolveBundledArchives, readPluginsTxtIfPresent |
| `src/core/comparePlugins.ts` | getLocalAppDataPath, getCurrentPluginsTxtPath |
| `src/core/loadOrder.ts` | captureLoadOrder |
| `src/utils/utils.ts` | pickModArchiveFile |
| `src/ui/pages/install/steps.tsx` | handlePickFile |
| `src/core/archiveHashing.ts` | getModArchivePath |

## Entry Points

Start here when exploring this area:

- **`createBuildPackageAction`** (Function) — `src/actions/buildPackageAction.ts:107`
- **`captureLoadOrder`** (Function) — `src/core/loadOrder.ts:40`
- **`pickModArchiveFile`** (Function) — `src/utils/utils.ts:103`
- **`getModArchivePath`** (Function) — `src/core/archiveHashing.ts:79`
- **`getCurrentPluginsTxtPath`** (Function) — `src/core/comparePlugins.ts:157`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createBuildPackageAction` | Function | `src/actions/buildPackageAction.ts` | 107 |
| `captureLoadOrder` | Function | `src/core/loadOrder.ts` | 40 |
| `pickModArchiveFile` | Function | `src/utils/utils.ts` | 103 |
| `getModArchivePath` | Function | `src/core/archiveHashing.ts` | 79 |
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
| `collectUserDecisions` | Function | `src/actions/installCollectionAction.ts` | 666 |
| `pickConflictChoice` | Function | `src/actions/installCollectionAction.ts` | 699 |
| `pickExternalPromptUserChoice` | Function | `src/actions/installCollectionAction.ts` | 744 |
| `pickOrphanChoice` | Function | `src/actions/installCollectionAction.ts` | 814 |
| `formatDivergedConflictText` | Function | `src/actions/installCollectionAction.ts` | 843 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CreateBuildPackageAction → ValidateCuratorInput` | intra_community | 3 |
| `CreateComparePluginsAction → GetLocalAppDataPath` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Resolver | 6 calls |
| Manifest | 5 calls |
| Build | 4 calls |
| Installer | 1 calls |
| Cluster_17 | 1 calls |
| Cluster_15 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "createBuildPackageAction"})` — see callers and callees
2. `gitnexus_query({query: "actions"})` — find related execution flows
3. Read key files listed above for implementation details
