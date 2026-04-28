---
name: pages
description: "Skill for the Pages area of vortex-mod-monitor. 28 symbols across 13 files."
---

# Pages

28 symbols | 13 files | Cohesion: 79%

## When to Use

- Working with code in `src/`
- Understanding how pickEhcollFile, deleteReceipt, useApi work
- Modifying pages-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/CollectionsPage.tsx` | CollectionsList, ReceiptDetailModal, handleExportDiagnostic, handleUninstall, saveDiagnosticReport (+1) |
| `src/ui/pages/HomePage.tsx` | Dashboard, HomePage, PlayerPanel, CuratorPanel |
| `src/ui/pages/install/steps.tsx` | PickStep, StaleReceiptStep, handleDelete, formatTime |
| `src/ui/errors/ErrorContext.tsx` | useErrorReporter, useErrorReporterFormatted |
| `src/ui/pages/build/BuildPage.tsx` | ImportPreviousButton, BuildPage |
| `src/ui/pages/dashboard/data.ts` | formatBytes, formatRelativeTime |
| `src/ui/pages/AboutPage.tsx` | handleClick, openExternal |
| `src/utils/utils.ts` | pickEhcollFile |
| `src/core/installLedger.ts` | deleteReceipt |
| `src/ui/state/ApiContext.tsx` | useApi |

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
| `HomePage` | Function | `src/ui/pages/HomePage.tsx` | 48 |
| `CollectionsPage` | Function | `src/ui/pages/CollectionsPage.tsx` | 56 |
| `useErrorReporterFormatted` | Function | `src/ui/errors/ErrorContext.tsx` | 64 |
| `InstallPage` | Function | `src/ui/pages/install/InstallPage.tsx` | 50 |
| `BuildPage` | Function | `src/ui/pages/build/BuildPage.tsx` | 75 |
| `formatBytes` | Function | `src/ui/pages/dashboard/data.ts` | 307 |
| `formatRelativeTime` | Function | `src/ui/pages/dashboard/data.ts` | 314 |
| `Dashboard` | Function | `src/ui/pages/HomePage.tsx` | 61 |
| `CollectionsList` | Function | `src/ui/pages/CollectionsPage.tsx` | 71 |
| `ReceiptDetailModal` | Function | `src/ui/pages/CollectionsPage.tsx` | 503 |
| `handleExportDiagnostic` | Function | `src/ui/pages/CollectionsPage.tsx` | 520 |
| `handleUninstall` | Function | `src/ui/pages/CollectionsPage.tsx` | 567 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ReceiptDetailModal → EHRuntime` | cross_community | 7 |
| `ReceiptDetailModal → Notify` | cross_community | 7 |
| `ReceiptDetailModal → GetSnapshot` | cross_community | 6 |
| `Dashboard → InstallLedgerError` | cross_community | 6 |
| `Dashboard → ExpectString` | cross_community | 6 |
| `ReceiptDetailModal → WizardReducer` | cross_community | 5 |
| `Dashboard → GetInstallLedgerDir` | cross_community | 5 |
| `Dashboard → IsUuid` | cross_community | 5 |
| `Dashboard → OnError` | cross_community | 5 |
| `ReceiptDetailModal → GetState` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Installer | 4 calls |
| Build | 2 calls |
| Dashboard | 1 calls |
| Resolver | 1 calls |
| Install | 1 calls |
| Manifest | 1 calls |

## How to Explore

1. `gitnexus_context({name: "pickEhcollFile"})` — see callers and callees
2. `gitnexus_query({query: "pages"})` — find related execution flows
3. Read key files listed above for implementation details
