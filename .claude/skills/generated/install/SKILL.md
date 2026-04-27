---
name: install
description: "Skill for the Install area of vortex-mod-monitor. 43 symbols across 9 files."
---

# Install

43 symbols | 9 files | Cohesion: 75%

## When to Use

- Working with code in `src/`
- Understanding how pickModArchiveFile, onChange, getInstallSession work
- Modifying install-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/install/installSession.ts` | InstallSession, subscribe, cancelLoading, openDecisionsFromPreview, setConflictChoice (+10) |
| `src/ui/pages/install/steps.tsx` | ConflictRow, handlePickFile, OrphanRow, decisionLabel, describeConflict (+6) |
| `src/ui/pages/install/state.ts` | selectConflictResolutions, defaultConflictChoice, defaultOrphanChoice, canProceedFromDecisions, fillDefaultConflictChoices (+1) |
| `src/ui/pages/build/BuildPage.tsx` | FormPanel, updateCurator, updateOverride, ExternalModsTable |
| `src/utils/diskSpace.ts` | getFreeBytes, findExistingAncestor, formatBytes |
| `src/utils/utils.ts` | pickModArchiveFile |
| `src/core/installer/profile.ts` | onChange |
| `src/ui/pages/install/InstallPage.tsx` | InstallWizard |
| `src/ui/hooks/useKeyboardShortcut.ts` | useKeyboardShortcut |

## Entry Points

Start here when exploring this area:

- **`pickModArchiveFile`** (Function) — `src/utils/utils.ts:103`
- **`onChange`** (Function) — `src/core/installer/profile.ts:142`
- **`getInstallSession`** (Function) — `src/ui/pages/install/installSession.ts:447`
- **`selectConflictResolutions`** (Function) — `src/ui/pages/install/state.ts:306`
- **`defaultConflictChoice`** (Function) — `src/ui/pages/install/state.ts:320`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `pickModArchiveFile` | Function | `src/utils/utils.ts` | 103 |
| `onChange` | Function | `src/core/installer/profile.ts` | 142 |
| `getInstallSession` | Function | `src/ui/pages/install/installSession.ts` | 447 |
| `selectConflictResolutions` | Function | `src/ui/pages/install/state.ts` | 306 |
| `defaultConflictChoice` | Function | `src/ui/pages/install/state.ts` | 320 |
| `defaultOrphanChoice` | Function | `src/ui/pages/install/state.ts` | 338 |
| `canProceedFromDecisions` | Function | `src/ui/pages/install/state.ts` | 361 |
| `fillDefaultConflictChoices` | Function | `src/ui/pages/install/state.ts` | 378 |
| `fillDefaultOrphanChoices` | Function | `src/ui/pages/install/state.ts` | 394 |
| `DecisionsStep` | Function | `src/ui/pages/install/steps.tsx` | 902 |
| `getFreeBytes` | Function | `src/utils/diskSpace.ts` | 28 |
| `formatBytes` | Function | `src/utils/diskSpace.ts` | 84 |
| `useKeyboardShortcut` | Function | `src/ui/hooks/useKeyboardShortcut.ts` | 35 |
| `PreviewStep` | Function | `src/ui/pages/install/steps.tsx` | 601 |
| `ConfirmStep` | Function | `src/ui/pages/install/steps.tsx` | 1382 |
| `isAbortError` | Function | `src/ui/pages/install/installSession.ts` | 460 |
| `InstallSession` | Class | `src/ui/pages/install/installSession.ts` | 79 |
| `ConflictRow` | Function | `src/ui/pages/install/steps.tsx` | 1069 |
| `handlePickFile` | Function | `src/ui/pages/install/steps.tsx` | 1079 |
| `OrphanRow` | Function | `src/ui/pages/install/steps.tsx` | 1207 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `DecisionsStep → EHRuntime` | cross_community | 5 |
| `DecisionsStep → Notify` | cross_community | 5 |
| `PickFile → EHRuntime` | cross_community | 5 |
| `PickFile → Notify` | cross_community | 5 |
| `PickFile → ReadEhcollError` | cross_community | 5 |
| `ResolveStaleReceipt → EHRuntime` | cross_community | 5 |
| `ResolveStaleReceipt → Notify` | cross_community | 5 |
| `OpenConfirm → EHRuntime` | cross_community | 5 |
| `OpenConfirm → Notify` | cross_community | 5 |
| `StartInstall → EHRuntime` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Installer | 16 calls |
| Pages | 5 calls |
| Resolver | 2 calls |
| Errors | 1 calls |
| Runtime | 1 calls |
| Build | 1 calls |

## How to Explore

1. `gitnexus_context({name: "pickModArchiveFile"})` — see callers and callees
2. `gitnexus_query({query: "install"})` — find related execution flows
3. Read key files listed above for implementation details
