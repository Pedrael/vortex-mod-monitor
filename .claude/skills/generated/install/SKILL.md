---
name: install
description: "Skill for the Install area of vortex-mod-monitor. 52 symbols across 10 files."
---

# Install

52 symbols | 10 files | Cohesion: 70%

## When to Use

- Working with code in `src/`
- Understanding how pickModArchiveFile, onChange, createFreshProfile work
- Modifying install-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/install/installSession.ts` | openDecisionsFromPreview, setConflictChoice, setOrphanChoice, backToPreview, reset (+13) |
| `src/ui/pages/install/steps.tsx` | ConflictRow, handlePickFile, OrphanRow, decisionLabel, describeConflict (+6) |
| `src/ui/pages/install/state.ts` | wizardReducer, selectConflictResolutions, defaultConflictChoice, defaultOrphanChoice, canProceedFromDecisions (+2) |
| `src/core/installer/profile.ts` | onChange, createFreshProfile, enableModInProfile, pickNonCollidingName, switchToProfile |
| `src/ui/pages/build/BuildPage.tsx` | FormPanel, updateCurator, updateOverride, ExternalModsTable |
| `src/utils/diskSpace.ts` | getFreeBytes, findExistingAncestor, formatBytes |
| `src/utils/utils.ts` | pickModArchiveFile |
| `src/ui/pages/CollectionsPage.tsx` | handleSwitchProfile |
| `src/ui/pages/install/InstallPage.tsx` | InstallWizard |
| `src/ui/hooks/useKeyboardShortcut.ts` | useKeyboardShortcut |

## Entry Points

Start here when exploring this area:

- **`pickModArchiveFile`** (Function) — `src/utils/utils.ts:102`
- **`onChange`** (Function) — `src/core/installer/profile.ts:96`
- **`createFreshProfile`** (Function) — `src/core/installer/profile.ts:38`
- **`enableModInProfile`** (Function) — `src/core/installer/profile.ts:115`
- **`pickNonCollidingName`** (Function) — `src/core/installer/profile.ts:131`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `pickModArchiveFile` | Function | `src/utils/utils.ts` | 102 |
| `onChange` | Function | `src/core/installer/profile.ts` | 96 |
| `createFreshProfile` | Function | `src/core/installer/profile.ts` | 38 |
| `enableModInProfile` | Function | `src/core/installer/profile.ts` | 115 |
| `pickNonCollidingName` | Function | `src/core/installer/profile.ts` | 131 |
| `wizardReducer` | Function | `src/ui/pages/install/state.ts` | 175 |
| `switchToProfile` | Function | `src/core/installer/profile.ts` | 68 |
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
| `useKeyboardShortcut` | Function | `src/ui/hooks/useKeyboardShortcut.ts` | 28 |
| `PreviewStep` | Function | `src/ui/pages/install/steps.tsx` | 601 |
| `ConfirmStep` | Function | `src/ui/pages/install/steps.tsx` | 1382 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ReceiptDetailModal → EHRuntime` | cross_community | 7 |
| `ReceiptDetailModal → Notify` | cross_community | 7 |
| `ReceiptDetailModal → GetSnapshot` | cross_community | 6 |
| `ExecuteDecision → GetSnapshot` | cross_community | 6 |
| `ExecuteDivergedChoice → EHRuntime` | cross_community | 6 |
| `ExecuteDivergedChoice → Notify` | cross_community | 6 |
| `DecisionsStep → EHRuntime` | cross_community | 5 |
| `DecisionsStep → Notify` | cross_community | 5 |
| `ReceiptDetailModal → WizardReducer` | cross_community | 5 |
| `PickFile → EHRuntime` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Pages | 5 calls |
| Resolver | 4 calls |
| Runtime | 2 calls |
| Installer | 1 calls |
| Errors | 1 calls |
| Build | 1 calls |

## How to Explore

1. `gitnexus_context({name: "pickModArchiveFile"})` — see callers and callees
2. `gitnexus_query({query: "install"})` — find related execution flows
3. Read key files listed above for implementation details
