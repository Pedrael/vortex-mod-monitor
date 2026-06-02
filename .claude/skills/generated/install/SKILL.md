---
name: install
description: "Skill for the Install area of vortex-mod-monitor. 69 symbols across 12 files."
---

# Install

69 symbols | 12 files | Cohesion: 72%

## When to Use

- Working with code in `src/`
- Understanding how useKeyboardShortcut, formatBytes, useToast work
- Modifying install-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/install/steps.tsx` | StepFrame, PickStep, handlePick, StaleReceiptStep, formatTime (+21) |
| `src/ui/pages/install/installSession.ts` | pickFile, onPhase, onHashProgress, resolveStaleReceipt, openDecisionsFromPreview (+14) |
| `src/ui/pages/install/state.ts` | wizardReducer, selectConflictResolutions, defaultConflictChoice, defaultOrphanChoice, canProceedFromDecisions (+2) |
| `src/core/installLedger.ts` | InstallLedgerError, getReceiptPath, deleteReceipt, isUuid |
| `src/ui/pages/CollectionsPage.tsx` | CollectionsList, refresh, ReceiptCard |
| `src/ui/pages/install/InstallPage.tsx` | InstallWizard, ErrorRetry, session |
| `src/ui/pages/build/BuildPage.tsx` | ImportPreviousButton, handleClick |
| `src/ui/hooks/useKeyboardShortcut.ts` | useKeyboardShortcut |
| `src/utils/diskSpace.ts` | formatBytes |
| `src/ui/components/Toast.tsx` | useToast |

## Entry Points

Start here when exploring this area:

- **`useKeyboardShortcut`** (Function) — `src/ui/hooks/useKeyboardShortcut.ts:35`
- **`formatBytes`** (Function) — `src/utils/diskSpace.ts:84`
- **`useToast`** (Function) — `src/ui/components/Toast.tsx:50`
- **`useErrorReporter`** (Function) — `src/ui/errors/ErrorContext.tsx:48`
- **`PickStep`** (Function) — `src/ui/pages/install/steps.tsx:183`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `InstallLedgerError` | Class | `src/core/installLedger.ts` | 70 |
| `useKeyboardShortcut` | Function | `src/ui/hooks/useKeyboardShortcut.ts` | 35 |
| `formatBytes` | Function | `src/utils/diskSpace.ts` | 84 |
| `useToast` | Function | `src/ui/components/Toast.tsx` | 50 |
| `useErrorReporter` | Function | `src/ui/errors/ErrorContext.tsx` | 48 |
| `PickStep` | Function | `src/ui/pages/install/steps.tsx` | 183 |
| `handlePick` | Function | `src/ui/pages/install/steps.tsx` | 192 |
| `StaleReceiptStep` | Function | `src/ui/pages/install/steps.tsx` | 437 |
| `ConfirmStep` | Function | `src/ui/pages/install/steps.tsx` | 1469 |
| `InstallingStep` | Function | `src/ui/pages/install/steps.tsx` | 1660 |
| `DoneStep` | Function | `src/ui/pages/install/steps.tsx` | 1746 |
| `useApi` | Function | `src/ui/state/ApiContext.tsx` | 33 |
| `isAbortError` | Function | `src/ui/pages/install/installSession.ts` | 460 |
| `wizardReducer` | Function | `src/ui/pages/install/state.ts` | 176 |
| `selectConflictResolutions` | Function | `src/ui/pages/install/state.ts` | 311 |
| `defaultConflictChoice` | Function | `src/ui/pages/install/state.ts` | 325 |
| `defaultOrphanChoice` | Function | `src/ui/pages/install/state.ts` | 343 |
| `canProceedFromDecisions` | Function | `src/ui/pages/install/state.ts` | 366 |
| `fillDefaultConflictChoices` | Function | `src/ui/pages/install/state.ts` | 383 |
| `fillDefaultOrphanChoices` | Function | `src/ui/pages/install/state.ts` | 399 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `HomePage → InstallLedgerError` | cross_community | 7 |
| `Dashboard → IsUuid` | cross_community | 6 |
| `HomePage → IsUuid` | cross_community | 6 |
| `PickFile → Notify` | cross_community | 5 |
| `PickFile → EHRuntime` | cross_community | 5 |
| `ResolveStaleReceipt → Notify` | cross_community | 5 |
| `ResolveStaleReceipt → EHRuntime` | cross_community | 5 |
| `StartInstall → Notify` | cross_community | 5 |
| `StartInstall → EHRuntime` | cross_community | 5 |
| `OnPhase → Notify` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Pages | 23 calls |
| Build | 9 calls |
| Resolver | 2 calls |
| Installer | 2 calls |
| Runtime | 1 calls |
| Dashboard | 1 calls |
| Actions | 1 calls |
| Errors | 1 calls |

## How to Explore

1. `gitnexus_context({name: "useKeyboardShortcut"})` — see callers and callees
2. `gitnexus_query({query: "install"})` — find related execution flows
3. Read key files listed above for implementation details
