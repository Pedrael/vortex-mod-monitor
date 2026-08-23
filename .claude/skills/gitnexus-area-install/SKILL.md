---
name: gitnexus-area-install
description: "Skill for the Install area of vortex-mod-monitor. 42 symbols across 5 files."
---

# Install

42 symbols | 5 files | Cohesion: 76%

## When to Use

- Working with code in `src/`
- Understanding how wizardReducer, canProceedFromDecisions, defaultConflictChoice work
- Modifying install-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/install/installSession.ts` | onHashProgress, onPhase, onHashProgress, onPhase, onProgress (+16) |
| `src/ui/pages/install/steps.tsx` | DecisionsStep, SectionHeader, BucketList, IntegritySection, RulesAndUserlistSection (+4) |
| `src/ui/pages/install/state.ts` | wizardReducer, canProceedFromDecisions, defaultConflictChoice, defaultOrphanChoice, fillDefaultConflictChoices (+2) |
| `src/core/installLedger.ts` | InstallLedgerError, deleteReceipt, getReceiptPath, isUuid |
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
| `InstallLedgerError` | Class | `src/core/installLedger.ts` | 70 |
| `wizardReducer` | Function | `src/ui/pages/install/state.ts` | 176 |
| `canProceedFromDecisions` | Function | `src/ui/pages/install/state.ts` | 366 |
| `defaultConflictChoice` | Function | `src/ui/pages/install/state.ts` | 325 |
| `defaultOrphanChoice` | Function | `src/ui/pages/install/state.ts` | 343 |
| `fillDefaultConflictChoices` | Function | `src/ui/pages/install/state.ts` | 383 |
| `fillDefaultOrphanChoices` | Function | `src/ui/pages/install/state.ts` | 399 |
| `selectConflictResolutions` | Function | `src/ui/pages/install/state.ts` | 311 |
| `DecisionsStep` | Function | `src/ui/pages/install/steps.tsx` | 989 |
| `deleteReceipt` | Function | `src/core/installLedger.ts` | 382 |
| `getReceiptPath` | Function | `src/core/installLedger.ts` | 124 |
| `handleDelete` | Function | `src/ui/pages/install/steps.tsx` | 452 |
| `isAbortError` | Function | `src/ui/pages/install/installSession.ts` | 460 |
| `getInstallSession` | Function | `src/ui/pages/install/installSession.ts` | 447 |
| `InstallSession` | Class | `src/ui/pages/install/installSession.ts` | 79 |
| `onHashProgress` | Function | `src/ui/pages/install/installSession.ts` | 132 |
| `onPhase` | Function | `src/ui/pages/install/installSession.ts` | 128 |
| `onHashProgress` | Function | `src/ui/pages/install/installSession.ts` | 228 |
| `onPhase` | Function | `src/ui/pages/install/installSession.ts` | 224 |
| `onProgress` | Function | `src/ui/pages/install/installSession.ts` | 347 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RouteOutlet → InstallLedgerError` | cross_community | 8 |
| `RouteOutlet → IsUuid` | cross_community | 8 |
| `StartInstall → EHRuntime` | cross_community | 6 |
| `StartInstall → Notify` | cross_community | 6 |
| `StartInstall → GetSnapshot` | cross_community | 5 |
| `OnHashProgress → EHRuntime` | cross_community | 5 |
| `OnHashProgress → Notify` | cross_community | 5 |
| `OnPhase → EHRuntime` | cross_community | 5 |
| `OnPhase → Notify` | cross_community | 5 |
| `OnHashProgress → EHRuntime` | cross_community | 5 |

## How to Explore

1. `context({name: "wizardReducer"})` — see callers and callees
2. `query({search_query: "install"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
