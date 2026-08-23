---
name: gitnexus-area-mo2
description: "Skill for the Mo2 area of vortex-mod-monitor. 38 symbols across 4 files."
---

# Mo2

38 symbols | 4 files | Cohesion: 82%

## When to Use

- Working with code in `src/`
- Understanding how writeMo2Instance, assignUniqueModFolderNames, getMo2GameName work
- Modifying mo2-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/mo2/mo2Layout.ts` | assignUniqueModFolderNames, getMo2GameName, joinPosixAware, planDownloads, planMo2Instance (+14) |
| `src/core/mo2/exportMo2Instance.ts` | Mo2WriteError, assertOutputDirSafe, formatBytes, renderF4seDeployScript, renderPriorityResolutionSection (+8) |
| `src/core/mo2/conflictPriority.ts` | computeConflictPriority, addEdge, collectCyclePairs, gatherReady, recordEdgeFile |
| `src/actions/exportMo2InstanceAction.ts` | computeConflictPriorityFromSnapshot |

## Entry Points

Start here when exploring this area:

- **`writeMo2Instance`** (Function) — `src/core/mo2/exportMo2Instance.ts:120`
- **`assignUniqueModFolderNames`** (Function) — `src/core/mo2/mo2Layout.ts:102`
- **`getMo2GameName`** (Function) — `src/core/mo2/mo2Layout.ts:43`
- **`planDownloads`** (Function) — `src/core/mo2/mo2Layout.ts:588`
- **`planMo2Instance`** (Function) — `src/core/mo2/mo2Layout.ts:674`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `Mo2WriteError` | Class | `src/core/mo2/exportMo2Instance.ts` | 105 |
| `writeMo2Instance` | Function | `src/core/mo2/exportMo2Instance.ts` | 120 |
| `assignUniqueModFolderNames` | Function | `src/core/mo2/mo2Layout.ts` | 102 |
| `getMo2GameName` | Function | `src/core/mo2/mo2Layout.ts` | 43 |
| `planDownloads` | Function | `src/core/mo2/mo2Layout.ts` | 588 |
| `planMo2Instance` | Function | `src/core/mo2/mo2Layout.ts` | 674 |
| `planMods` | Function | `src/core/mo2/mo2Layout.ts` | 468 |
| `sanitiseModFolderName` | Function | `src/core/mo2/mo2Layout.ts` | 80 |
| `planProfile` | Function | `src/core/mo2/mo2Layout.ts` | 649 |
| `renderArchivesTxt` | Function | `src/core/mo2/mo2Layout.ts` | 432 |
| `renderLoadOrderTxt` | Function | `src/core/mo2/mo2Layout.ts` | 343 |
| `renderLootUserlistYaml` | Function | `src/core/mo2/mo2Layout.ts` | 366 |
| `renderModlistTxt` | Function | `src/core/mo2/mo2Layout.ts` | 313 |
| `renderPluginsTxt` | Function | `src/core/mo2/mo2Layout.ts` | 330 |
| `computeConflictPriority` | Function | `src/core/mo2/conflictPriority.ts` | 227 |
| `addEdge` | Function | `src/core/mo2/conflictPriority.ts` | 311 |
| `collectCyclePairs` | Function | `src/core/mo2/conflictPriority.ts` | 391 |
| `gatherReady` | Function | `src/core/mo2/conflictPriority.ts` | 458 |
| `recordEdgeFile` | Function | `src/core/mo2/conflictPriority.ts` | 294 |
| `renderDownloadMetaIni` | Function | `src/core/mo2/mo2Layout.ts` | 202 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `WriteMo2Instance → OnFile` | cross_community | 4 |
| `WriteMo2Instance → OnSkip` | cross_community | 4 |
| `PlanMo2Instance → CoerceOptionalPositiveInt` | cross_community | 4 |
| `PlanMo2Instance → EscapeIniValue` | cross_community | 4 |
| `PlanMo2Instance → SanitiseModFolderName` | intra_community | 4 |
| `WriteMo2Instance → AbortError` | cross_community | 4 |
| `ComputeConflictPriority → RecordEdgeFile` | intra_community | 3 |
| `WriteMo2Instance → Mo2WriteError` | intra_community | 3 |
| `PlanMo2Instance → GetMo2GameName` | intra_community | 3 |
| `PlanMo2Instance → JoinPosixAware` | intra_community | 3 |

## How to Explore

1. `context({name: "writeMo2Instance"})` — see callers and callees
2. `query({search_query: "mo2"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
