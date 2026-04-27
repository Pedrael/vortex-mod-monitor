---
name: install
description: "Skill for the Install area of vortex-mod-monitor. 49 symbols across 9 files."
---

# Install

49 symbols | 9 files | Cohesion: 84%

## When to Use

- Working with code in `src/`
- Understanding how wizardReducer, getInstallSession, isAbortError work
- Modifying install-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/install/installSession.ts` | InstallSession, getSnapshot, subscribe, pickFile, cancelLoading (+15) |
| `src/ui/pages/install/steps.tsx` | ConflictRow, handlePickFile, OrphanRow, decisionLabel, describeConflict (+6) |
| `src/ui/pages/install/state.ts` | wizardReducer, selectConflictResolutions, defaultConflictChoice, defaultOrphanChoice, canProceedFromDecisions (+2) |
| `src/ui/pages/build/BuildPage.tsx` | FormPanel, updateCurator, updateOverride, ExternalModsTable |
| `src/utils/diskSpace.ts` | getFreeBytes, findExistingAncestor, formatBytes |
| `src/ui/pages/install/InstallPage.tsx` | InstallWizard |
| `src/utils/utils.ts` | pickModArchiveFile |
| `src/core/installer/profile.ts` | onChange |
| `src/ui/hooks/useKeyboardShortcut.ts` | useKeyboardShortcut |

## Entry Points

Start here when exploring this area:

- **`wizardReducer`** (Function) — `src/ui/pages/install/state.ts:175`
- **`getInstallSession`** (Function) — `src/ui/pages/install/installSession.ts:447`
- **`isAbortError`** (Function) — `src/ui/pages/install/installSession.ts:460`
- **`pickModArchiveFile`** (Function) — `src/utils/utils.ts:102`
- **`onChange`** (Function) — `src/core/installer/profile.ts:142`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `wizardReducer` | Function | `src/ui/pages/install/state.ts` | 175 |
| `getInstallSession` | Function | `src/ui/pages/install/installSession.ts` | 447 |
| `isAbortError` | Function | `src/ui/pages/install/installSession.ts` | 460 |
| `pickModArchiveFile` | Function | `src/utils/utils.ts` | 102 |
| `onChange` | Function | `src/core/installer/profile.ts` | 142 |
| `DecisionsStep` | Function | `src/ui/pages/install/steps.tsx` | 902 |
| `selectConflictResolutions` | Function | `src/ui/pages/install/state.ts` | 306 |
| `defaultConflictChoice` | Function | `src/ui/pages/install/state.ts` | 320 |
| `defaultOrphanChoice` | Function | `src/ui/pages/install/state.ts` | 338 |
| `canProceedFromDecisions` | Function | `src/ui/pages/install/state.ts` | 361 |
| `fillDefaultConflictChoices` | Function | `src/ui/pages/install/state.ts` | 378 |
| `fillDefaultOrphanChoices` | Function | `src/ui/pages/install/state.ts` | 394 |
| `getFreeBytes` | Function | `src/utils/diskSpace.ts` | 28 |
| `formatBytes` | Function | `src/utils/diskSpace.ts` | 84 |
| `useKeyboardShortcut` | Function | `src/ui/hooks/useKeyboardShortcut.ts` | 35 |
| `PreviewStep` | Function | `src/ui/pages/install/steps.tsx` | 601 |
| `ConfirmStep` | Function | `src/ui/pages/install/steps.tsx` | 1382 |
| `InstallSession` | Class | `src/ui/pages/install/installSession.ts` | 79 |
| `InstallWizard` | Function | `src/ui/pages/install/InstallPage.tsx` | 63 |
| `ConflictRow` | Function | `src/ui/pages/install/steps.tsx` | 1069 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ReceiptDetailModal → EHRuntime` | cross_community | 7 |
| `ReceiptDetailModal → Notify` | cross_community | 7 |
| `ReceiptDetailModal → GetSnapshot` | cross_community | 6 |
| `DecisionsStep → EHRuntime` | cross_community | 5 |
| `DecisionsStep → Notify` | cross_community | 5 |
| `ReceiptDetailModal → WizardReducer` | cross_community | 5 |
| `PickFile → EHRuntime` | cross_community | 5 |
| `PickFile → Notify` | cross_community | 5 |
| `PickFile → ReadEhcollError` | cross_community | 5 |
| `ResolveStaleReceipt → EHRuntime` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Pages | 5 calls |
| Installer | 3 calls |
| Resolver | 2 calls |
| Build | 2 calls |
| Errors | 1 calls |
| Runtime | 1 calls |

## How to Explore

1. `gitnexus_context({name: "wizardReducer"})` — see callers and callees
2. `gitnexus_query({query: "install"})` — find related execution flows
3. Read key files listed above for implementation details
