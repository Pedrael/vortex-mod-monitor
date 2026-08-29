---
name: gitnexus-area-install
description: "Skill for the Install area of vortex-mod-monitor. 63 symbols across 10 files."
---

# Install

63 symbols | 10 files | Cohesion: 69%

## When to Use

- Working with code in `src/`
- Understanding how wizardReducer, canProceedFromDecisions, countUndecidedConflicts work
- Modifying install-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/install/steps.tsx` | DecisionsStep, OrphanRow, RadioOption, SectionHeader, InstallingStep (+17) |
| `src/ui/pages/install/installSession.ts` | onHashProgress, onPhase, onHashProgress, onPhase, onProgress (+16) |
| `src/ui/pages/install/state.ts` | wizardReducer, canProceedFromDecisions, countUndecidedConflicts, defaultConflictChoice, defaultOrphanChoice (+3) |
| `src/ui/pages/install/installProgress.ts` | describeElapsed, describeQuiet, estimateRemainingMs, formatDuration, trackPhase |
| `src/core/revealPath.ts` | loadShell, openExternalUrl |
| `src/core/revealPath.test.ts` | openExternal |
| `src/ui/pages/install/downloadGuidance.ts` | describeDownload |
| `src/ui/hooks/useKeyboardShortcut.ts` | useKeyboardShortcut |
| `src/utils/diskSpace.ts` | formatBytes |
| `src/ui/pages/install/InstallPage.tsx` | session |

## Entry Points

Start here when exploring this area:

- **`wizardReducer`** (Function) — `src/ui/pages/install/state.ts:177`
- **`canProceedFromDecisions`** (Function) — `src/ui/pages/install/state.ts:373`
- **`countUndecidedConflicts`** (Function) — `src/ui/pages/install/state.ts:400`
- **`defaultConflictChoice`** (Function) — `src/ui/pages/install/state.ts:332`
- **`defaultOrphanChoice`** (Function) — `src/ui/pages/install/state.ts:350`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `wizardReducer` | Function | `src/ui/pages/install/state.ts` | 177 |
| `canProceedFromDecisions` | Function | `src/ui/pages/install/state.ts` | 373 |
| `countUndecidedConflicts` | Function | `src/ui/pages/install/state.ts` | 400 |
| `defaultConflictChoice` | Function | `src/ui/pages/install/state.ts` | 332 |
| `defaultOrphanChoice` | Function | `src/ui/pages/install/state.ts` | 350 |
| `fillDefaultConflictChoices` | Function | `src/ui/pages/install/state.ts` | 416 |
| `fillDefaultOrphanChoices` | Function | `src/ui/pages/install/state.ts` | 432 |
| `selectConflictResolutions` | Function | `src/ui/pages/install/state.ts` | 318 |
| `DecisionsStep` | Function | `src/ui/pages/install/steps.tsx` | 1050 |
| `describeElapsed` | Function | `src/ui/pages/install/installProgress.ts` | 147 |
| `describeQuiet` | Function | `src/ui/pages/install/installProgress.ts` | 114 |
| `estimateRemainingMs` | Function | `src/ui/pages/install/installProgress.ts` | 89 |
| `formatDuration` | Function | `src/ui/pages/install/installProgress.ts` | 132 |
| `trackPhase` | Function | `src/ui/pages/install/installProgress.ts` | 66 |
| `InstallingStep` | Function | `src/ui/pages/install/steps.tsx` | 1788 |
| `openExternalUrl` | Function | `src/core/revealPath.ts` | 139 |
| `describeDownload` | Function | `src/ui/pages/install/downloadGuidance.ts` | 44 |
| `isAbortError` | Function | `src/ui/pages/install/installSession.ts` | 506 |
| `useKeyboardShortcut` | Function | `src/ui/hooks/useKeyboardShortcut.ts` | 35 |
| `ConfirmStep` | Function | `src/ui/pages/install/steps.tsx` | 1633 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `StartInstall → EHRuntime` | cross_community | 6 |
| `StartInstall → Notify` | cross_community | 6 |
| `DoneStep → Pill` | cross_community | 5 |
| `StartInstall → GetSnapshot` | cross_community | 5 |
| `OnHashProgress → EHRuntime` | cross_community | 5 |
| `OnHashProgress → Notify` | cross_community | 5 |
| `OnPhase → EHRuntime` | cross_community | 5 |
| `OnPhase → Notify` | cross_community | 5 |
| `OnHashProgress → EHRuntime` | cross_community | 5 |
| `OnHashProgress → Notify` | cross_community | 5 |

## How to Explore

1. `context({name: "wizardReducer"})` — see callers and callees
2. `query({search_query: "install"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
