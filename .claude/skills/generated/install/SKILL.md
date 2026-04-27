---
name: install
description: "Skill for the Install area of vortex-mod-monitor. 68 symbols across 17 files."
---

# Install

68 symbols | 17 files | Cohesion: 79%

## When to Use

- Working with code in `src/`
- Understanding how pickEhcollFile, deleteReceipt, useApi work
- Modifying install-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/install/installSession.ts` | InstallSession, getSnapshot, subscribe, pickFile, cancelLoading (+15) |
| `src/ui/pages/install/steps.tsx` | PickStep, StaleReceiptStep, handleDelete, formatTime, ConflictRow (+8) |
| `src/ui/pages/install/state.ts` | wizardReducer, selectConflictResolutions, defaultConflictChoice, defaultOrphanChoice, canProceedFromDecisions (+2) |
| `src/ui/pages/CollectionsPage.tsx` | CollectionsList, ReceiptDetailModal, handleExportDiagnostic, handleUninstall, saveDiagnosticReport (+1) |
| `src/ui/runtime/ehRuntime.ts` | setBuildBusy, setInstallBusy, notify |
| `src/ui/pages/build/buildSession.ts` | patchForm, dismissDraftBanner, setState |
| `src/ui/pages/build/BuildPage.tsx` | handleChange, handleDismissDraftBanner, ImportPreviousButton |
| `src/utils/diskSpace.ts` | getFreeBytes, findExistingAncestor, formatBytes |
| `src/core/installer/profile.ts` | switchToProfile, makeAbortError |
| `src/utils/utils.ts` | pickEhcollFile |

## Entry Points

Start here when exploring this area:

- **`pickEhcollFile`** (Function) — `src/utils/utils.ts:70`
- **`deleteReceipt`** (Function) — `src/core/installLedger.ts:382`
- **`useApi`** (Function) — `src/ui/state/ApiContext.tsx:33`
- **`useErrorReporter`** (Function) — `src/ui/errors/ErrorContext.tsx:48`
- **`useToast`** (Function) — `src/ui/components/Toast.tsx:50`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `pickEhcollFile` | Function | `src/utils/utils.ts` | 70 |
| `deleteReceipt` | Function | `src/core/installLedger.ts` | 382 |
| `useApi` | Function | `src/ui/state/ApiContext.tsx` | 33 |
| `useErrorReporter` | Function | `src/ui/errors/ErrorContext.tsx` | 48 |
| `useToast` | Function | `src/ui/components/Toast.tsx` | 50 |
| `PickStep` | Function | `src/ui/pages/install/steps.tsx` | 183 |
| `StaleReceiptStep` | Function | `src/ui/pages/install/steps.tsx` | 437 |
| `handleDelete` | Function | `src/ui/pages/install/steps.tsx` | 452 |
| `switchToProfile` | Function | `src/core/installer/profile.ts` | 80 |
| `wizardReducer` | Function | `src/ui/pages/install/state.ts` | 176 |
| `getInstallSession` | Function | `src/ui/pages/install/installSession.ts` | 447 |
| `isAbortError` | Function | `src/ui/pages/install/installSession.ts` | 460 |
| `selectConflictResolutions` | Function | `src/ui/pages/install/state.ts` | 311 |
| `defaultConflictChoice` | Function | `src/ui/pages/install/state.ts` | 325 |
| `defaultOrphanChoice` | Function | `src/ui/pages/install/state.ts` | 343 |
| `canProceedFromDecisions` | Function | `src/ui/pages/install/state.ts` | 366 |
| `fillDefaultConflictChoices` | Function | `src/ui/pages/install/state.ts` | 383 |
| `fillDefaultOrphanChoices` | Function | `src/ui/pages/install/state.ts` | 399 |
| `DecisionsStep` | Function | `src/ui/pages/install/steps.tsx` | 989 |
| `getFreeBytes` | Function | `src/utils/diskSpace.ts` | 28 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ReceiptDetailModal → EHRuntime` | cross_community | 7 |
| `ReceiptDetailModal → Notify` | cross_community | 7 |
| `ReceiptDetailModal → GetSnapshot` | cross_community | 6 |
| `Dashboard → InstallLedgerError` | cross_community | 6 |
| `ApplyGroupRule → EHRuntime` | cross_community | 6 |
| `ApplyGroupRule → Notify` | cross_community | 6 |
| `ApplyGroupDefinition → EHRuntime` | cross_community | 6 |
| `ApplyGroupDefinition → Notify` | cross_community | 6 |
| `ApplyPluginGroup → EHRuntime` | cross_community | 6 |
| `ApplyPluginGroup → Notify` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Installer | 4 calls |
| Resolver | 4 calls |
| Build | 3 calls |
| Runtime | 2 calls |
| Dashboard | 1 calls |
| Errors | 1 calls |
| Actions | 1 calls |
| Pages | 1 calls |

## How to Explore

1. `gitnexus_context({name: "pickEhcollFile"})` — see callers and callees
2. `gitnexus_query({query: "install"})` — find related execution flows
3. Read key files listed above for implementation details
