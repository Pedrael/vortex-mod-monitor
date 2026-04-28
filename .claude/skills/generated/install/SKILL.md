---
name: install
description: "Skill for the Install area of vortex-mod-monitor. 49 symbols across 10 files."
---

# Install

49 symbols | 10 files | Cohesion: 69%

## When to Use

- Working with code in `src/`
- Understanding how pickModArchiveFile, onChange, getInstallSession work
- Modifying install-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/install/installSession.ts` | InstallSession, subscribe, cancelLoading, openDecisionsFromPreview, setConflictChoice (+13) |
| `src/ui/pages/install/steps.tsx` | ConflictRow, handlePickFile, OrphanRow, decisionLabel, describeConflict (+4) |
| `src/ui/pages/install/state.ts` | selectConflictResolutions, defaultConflictChoice, defaultOrphanChoice, canProceedFromDecisions, fillDefaultConflictChoices (+2) |
| `src/ui/pages/build/BuildPage.tsx` | FormPanel, updateCurator, updateOverride, IntegrityLevelCard, ExternalModsTable |
| `src/core/installer/profile.ts` | onChange, createFreshProfile, pickNonCollidingName |
| `src/utils/diskSpace.ts` | getFreeBytes, findExistingAncestor, formatBytes |
| `src/utils/utils.ts` | pickModArchiveFile |
| `src/ui/pages/install/InstallPage.tsx` | InstallWizard |
| `src/ui/hooks/useKeyboardShortcut.ts` | useKeyboardShortcut |
| `src/core/installer/applyLoadOrder.ts` | applyLoadOrder |

## Entry Points

Start here when exploring this area:

- **`pickModArchiveFile`** (Function) — `src/utils/utils.ts:103`
- **`onChange`** (Function) — `src/core/installer/profile.ts:142`
- **`getInstallSession`** (Function) — `src/ui/pages/install/installSession.ts:447`
- **`selectConflictResolutions`** (Function) — `src/ui/pages/install/state.ts:311`
- **`defaultConflictChoice`** (Function) — `src/ui/pages/install/state.ts:325`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `pickModArchiveFile` | Function | `src/utils/utils.ts` | 103 |
| `onChange` | Function | `src/core/installer/profile.ts` | 142 |
| `getInstallSession` | Function | `src/ui/pages/install/installSession.ts` | 447 |
| `selectConflictResolutions` | Function | `src/ui/pages/install/state.ts` | 311 |
| `defaultConflictChoice` | Function | `src/ui/pages/install/state.ts` | 325 |
| `defaultOrphanChoice` | Function | `src/ui/pages/install/state.ts` | 343 |
| `canProceedFromDecisions` | Function | `src/ui/pages/install/state.ts` | 366 |
| `fillDefaultConflictChoices` | Function | `src/ui/pages/install/state.ts` | 383 |
| `fillDefaultOrphanChoices` | Function | `src/ui/pages/install/state.ts` | 399 |
| `DecisionsStep` | Function | `src/ui/pages/install/steps.tsx` | 989 |
| `getFreeBytes` | Function | `src/utils/diskSpace.ts` | 28 |
| `formatBytes` | Function | `src/utils/diskSpace.ts` | 84 |
| `useKeyboardShortcut` | Function | `src/ui/hooks/useKeyboardShortcut.ts` | 35 |
| `PreviewStep` | Function | `src/ui/pages/install/steps.tsx` | 603 |
| `ConfirmStep` | Function | `src/ui/pages/install/steps.tsx` | 1469 |
| `createFreshProfile` | Function | `src/core/installer/profile.ts` | 38 |
| `pickNonCollidingName` | Function | `src/core/installer/profile.ts` | 206 |
| `applyLoadOrder` | Function | `src/core/installer/applyLoadOrder.ts` | 99 |
| `wizardReducer` | Function | `src/ui/pages/install/state.ts` | 176 |
| `isAbortError` | Function | `src/ui/pages/install/installSession.ts` | 460 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ReceiptDetailModal → EHRuntime` | cross_community | 7 |
| `ReceiptDetailModal → Notify` | cross_community | 7 |
| `ReceiptDetailModal → GetSnapshot` | cross_community | 6 |
| `ApplyGroupRule → EHRuntime` | cross_community | 6 |
| `ApplyGroupRule → Notify` | cross_community | 6 |
| `ApplyGroupDefinition → EHRuntime` | cross_community | 6 |
| `ApplyGroupDefinition → Notify` | cross_community | 6 |
| `ApplyPluginGroup → EHRuntime` | cross_community | 6 |
| `ApplyPluginGroup → Notify` | cross_community | 6 |
| `DecisionsStep → EHRuntime` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Pages | 5 calls |
| Resolver | 3 calls |
| Installer | 3 calls |
| Runtime | 2 calls |
| Manifest | 1 calls |
| Actions | 1 calls |
| Errors | 1 calls |
| Build | 1 calls |

## How to Explore

1. `gitnexus_context({name: "pickModArchiveFile"})` — see callers and callees
2. `gitnexus_query({query: "install"})` — find related execution flows
3. Read key files listed above for implementation details
