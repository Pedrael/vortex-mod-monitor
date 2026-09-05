---
name: gitnexus-area-actions
description: "Skill for the Actions area of Event-Horizon. 66 symbols across 16 files."
---

# Actions

66 symbols | 16 files | Cohesion: 80%

## When to Use

- Working with code in `src/`
- Understanding how createBuildPackageAction, captureDeploymentManifests, collectDistinctModTypes work
- Modifying actions-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/actions/installCollectionAction.ts` | collectUserDecisions, formatDivergedConflictText, formatOrphanText, formatPromptUserText, pickConflictChoice (+23) |
| `src/actions/buildPackageAction.ts` | BundleResolutionError, createBuildPackageAction, formatBytes, formatError, promptCuratorMetadata (+8) |
| `src/core/deploymentManifest.ts` | captureDeploymentManifests, collectDistinctModTypes, normalizeManifest |
| `src/core/manifest/packageFileName.ts` | buildOutputFileName, safePackageVersion, slugifyPackageName |
| `src/utils/utils.ts` | pickModArchiveFile, openFile, openFolder |
| `src/core/manifest/collectionConfig.ts` | reconcileExternalModsConfig, toBuildManifestExternalMods |
| `src/actions/compareModsAction.ts` | action, action |
| `src/actions/comparePluginsAction.ts` | action, action |
| `src/actions/exportModsAction.ts` | action, action |
| `src/core/comparePlugins.ts` | getCurrentPluginsTxtPath, getLocalAppDataPath |

## Entry Points

Start here when exploring this area:

- **`createBuildPackageAction`** (Function) — `src/actions/buildPackageAction.ts:117`
- **`captureDeploymentManifests`** (Function) — `src/core/deploymentManifest.ts:133`
- **`collectDistinctModTypes`** (Function) — `src/core/deploymentManifest.ts:53`
- **`matchEhcollFile`** (Function) — `src/core/doctor/heal.ts:177`
- **`captureLoadOrder`** (Function) — `src/core/loadOrder.ts:40`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createBuildPackageAction` | Function | `src/actions/buildPackageAction.ts` | 117 |
| `captureDeploymentManifests` | Function | `src/core/deploymentManifest.ts` | 133 |
| `collectDistinctModTypes` | Function | `src/core/deploymentManifest.ts` | 53 |
| `matchEhcollFile` | Function | `src/core/doctor/heal.ts` | 177 |
| `captureLoadOrder` | Function | `src/core/loadOrder.ts` | 40 |
| `reconcileExternalModsConfig` | Function | `src/core/manifest/collectionConfig.ts` | 332 |
| `toBuildManifestExternalMods` | Function | `src/core/manifest/collectionConfig.ts` | 373 |
| `applyHint` | Function | `src/core/manifest/externalHints.ts` | 229 |
| `locateCollectionPackage` | Function | `src/core/manifest/locatePackage.ts` | 28 |
| `buildOutputFileName` | Function | `src/core/manifest/packageFileName.ts` | 32 |
| `safePackageVersion` | Function | `src/core/manifest/packageFileName.ts` | 27 |
| `slugifyPackageName` | Function | `src/core/manifest/packageFileName.ts` | 15 |
| `pickModArchiveFile` | Function | `src/utils/utils.ts` | 113 |
| `action` | Function | `src/actions/buildPackageAction.ts` | 342 |
| `action` | Function | `src/actions/buildPackageAction.ts` | 350 |
| `action` | Function | `src/actions/compareModsAction.ts` | 104 |
| `action` | Function | `src/actions/comparePluginsAction.ts` | 62 |
| `action` | Function | `src/actions/exportModsAction.ts` | 123 |
| `openFile` | Function | `src/utils/utils.ts` | 39 |
| `action` | Function | `src/actions/buildPackageAction.ts` | 346 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CreateBuildPackageAction → GetVortexUserDataPath` | cross_community | 8 |
| `CreateBuildPackageAction → Truncate` | cross_community | 4 |

## How to Explore

1. `context({name: "createBuildPackageAction"})` — see callers and callees
2. `query({search_query: "actions"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
