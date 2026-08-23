---
name: gitnexus-area-install
description: "Skill for the Install area of vortex-mod-monitor. 43 symbols across 5 files."
---

# Install

43 symbols | 5 files | Cohesion: 77%

## When to Use

- Working with code in `src/`
- Understanding how wizardReducer, canProceedFromDecisions, defaultConflictChoice work
- Modifying install-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/install/installSession.ts` | onHashProgress, onPhase, onHashProgress, onPhase, onProgress (+16) |
| `src/ui/pages/install/steps.tsx` | DecisionsStep, ConflictRow, handlePickFile, OrphanRow, RadioOption (+8) |
| `src/ui/pages/install/state.ts` | wizardReducer, canProceedFromDecisions, defaultConflictChoice, defaultOrphanChoice, fillDefaultConflictChoices (+2) |
| `src/utils/utils.ts` | pickModArchiveFile |
| `src/ui/pages/install/InstallPage.tsx` | session |

## Entry Points

Start here when exploring this area:

- **`wizardReducer`** (Function) — `src/ui/pages/install/state.ts:176`
- **`canProceedFromDecisions`** (Function) — `src/ui/pages/install/state.ts:366`
- **`defaultConflictChoice`** (Function) — `src/ui/pages/install/state.ts:325`
- **`defaultOrphanChoice`** (Function) — `src/ui/pages/install/state.ts:343`
- **`fillDefaultConflictChoices`** (Function) — `src/ui/pages/install/state.ts:383`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `wizardReducer` | Function | `src/ui/pages/install/state.ts` | 176 |
| `canProceedFromDecisions` | Function | `src/ui/pages/install/state.ts` | 366 |
| `defaultConflictChoice` | Function | `src/ui/pages/install/state.ts` | 325 |
| `defaultOrphanChoice` | Function | `src/ui/pages/install/state.ts` | 343 |
| `fillDefaultConflictChoices` | Function | `src/ui/pages/install/state.ts` | 383 |
| `fillDefaultOrphanChoices` | Function | `src/ui/pages/install/state.ts` | 399 |
| `selectConflictResolutions` | Function | `src/ui/pages/install/state.ts` | 311 |
| `DecisionsStep` | Function | `src/ui/pages/install/steps.tsx` | 990 |
| `pickModArchiveFile` | Function | `src/utils/utils.ts` | 91 |
| `isAbortError` | Function | `src/ui/pages/install/installSession.ts` | 460 |
| `getInstallSession` | Function | `src/ui/pages/install/installSession.ts` | 447 |
| `InstallSession` | Class | `src/ui/pages/install/installSession.ts` | 79 |
| `onHashProgress` | Function | `src/ui/pages/install/installSession.ts` | 132 |
| `onPhase` | Function | `src/ui/pages/install/installSession.ts` | 128 |
| `onHashProgress` | Function | `src/ui/pages/install/installSession.ts` | 228 |
| `onPhase` | Function | `src/ui/pages/install/installSession.ts` | 224 |
| `onProgress` | Function | `src/ui/pages/install/installSession.ts` | 347 |
| `ConflictRow` | Function | `src/ui/pages/install/steps.tsx` | 1157 |
| `handlePickFile` | Function | `src/ui/pages/install/steps.tsx` | 1167 |
| `OrphanRow` | Function | `src/ui/pages/install/steps.tsx` | 1295 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `StartInstall → EHRuntime` | cross_community | 6 |
| `StartInstall → Notify` | cross_community | 6 |
| `StartInstall → GetSnapshot` | cross_community | 5 |
| `OnHashProgress → EHRuntime` | cross_community | 5 |
| `OnHashProgress → Notify` | cross_community | 5 |
| `OnPhase → EHRuntime` | cross_community | 5 |
| `OnPhase → Notify` | cross_community | 5 |
| `OnHashProgress → EHRuntime` | cross_community | 5 |
| `OnHashProgress → Notify` | cross_community | 5 |
| `OnPhase → EHRuntime` | cross_community | 5 |

## How to Explore

1. `context({name: "wizardReducer"})` — see callers and callees
2. `query({search_query: "install"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
