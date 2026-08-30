---
name: gitnexus-area-install
description: "Skill for the Install area of Event-Horizon. 86 symbols across 16 files."
---

# Install

86 symbols | 16 files | Cohesion: 76%

## When to Use

- Working with code in `src/`
- Understanding how reconcileMods, wizardReducer, canProceedFromDecisions work
- Modifying install-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/install/steps.tsx` | BucketList, CuratorReportsNotice, DamagedArchiveNotice, ExternalArchiveNotice, GameIniNotice (+27) |
| `src/ui/pages/install/installSession.ts` | onHashProgress, onPhase, onHashProgress, onPhase, onProgress (+19) |
| `src/ui/pages/install/state.ts` | wizardReducer, canProceedFromDecisions, countUndecidedConflicts, defaultConflictChoice, defaultOrphanChoice (+3) |
| `src/ui/pages/install/installProgress.ts` | describeElapsed, describeQuiet, estimateRemainingMs, formatDuration, trackPhase |
| `src/core/revealPath.ts` | describe, loadShell, openExternalUrl |
| `src/ui/runtime/ehRuntime.ts` | notify, setBuildBusy, setInstallBusy |
| `src/ui/pages/install/engine.ts` | checkAbort, checkAbort |
| `src/utils/abortError.ts` | AbortError |
| `src/core/archiveHashing.ts` | onAbort |
| `src/core/installer/applyLoadOrder.ts` | applyLoadOrder |

## Entry Points

Start here when exploring this area:

- **`reconcileMods`** (Function) — `src/ui/pages/install/steps.tsx:2726`
- **`wizardReducer`** (Function) — `src/ui/pages/install/state.ts:177`
- **`canProceedFromDecisions`** (Function) — `src/ui/pages/install/state.ts:373`
- **`countUndecidedConflicts`** (Function) — `src/ui/pages/install/state.ts:400`
- **`defaultConflictChoice`** (Function) — `src/ui/pages/install/state.ts:332`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `AbortError` | Class | `src/utils/abortError.ts` | 22 |
| `reconcileMods` | Function | `src/ui/pages/install/steps.tsx` | 2726 |
| `wizardReducer` | Function | `src/ui/pages/install/state.ts` | 177 |
| `canProceedFromDecisions` | Function | `src/ui/pages/install/state.ts` | 373 |
| `countUndecidedConflicts` | Function | `src/ui/pages/install/state.ts` | 400 |
| `defaultConflictChoice` | Function | `src/ui/pages/install/state.ts` | 332 |
| `defaultOrphanChoice` | Function | `src/ui/pages/install/state.ts` | 350 |
| `fillDefaultConflictChoices` | Function | `src/ui/pages/install/state.ts` | 416 |
| `fillDefaultOrphanChoices` | Function | `src/ui/pages/install/state.ts` | 432 |
| `selectConflictResolutions` | Function | `src/ui/pages/install/state.ts` | 318 |
| `DecisionsStep` | Function | `src/ui/pages/install/steps.tsx` | 1060 |
| `describeElapsed` | Function | `src/ui/pages/install/installProgress.ts` | 147 |
| `describeQuiet` | Function | `src/ui/pages/install/installProgress.ts` | 114 |
| `estimateRemainingMs` | Function | `src/ui/pages/install/installProgress.ts` | 89 |
| `formatDuration` | Function | `src/ui/pages/install/installProgress.ts` | 132 |
| `trackPhase` | Function | `src/ui/pages/install/installProgress.ts` | 66 |
| `InstallingStep` | Function | `src/ui/pages/install/steps.tsx` | 1957 |
| `onAbort` | Function | `src/core/archiveHashing.ts` | 50 |
| `applyLoadOrder` | Function | `src/core/installer/applyLoadOrder.ts` | 99 |
| `checkAbort` | Function | `src/ui/pages/build/engine.ts` | 723 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RunInstall → AbortError` | cross_community | 6 |
| `StartInstall → EHRuntime` | cross_community | 6 |
| `StartInstall → Notify` | cross_community | 6 |
| `DoneStep → Pill` | cross_community | 5 |
| `StartInstall → GetSnapshot` | cross_community | 5 |
| `Take → AbortError` | cross_community | 5 |
| `Session → Notify` | cross_community | 5 |
| `ReleaseBuild → Notify` | cross_community | 5 |
| `OnHashProgress → EHRuntime` | cross_community | 5 |
| `OnHashProgress → Notify` | cross_community | 5 |

## How to Explore

1. `context({name: "reconcileMods"})` — see callers and callees
2. `query({search_query: "install"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
