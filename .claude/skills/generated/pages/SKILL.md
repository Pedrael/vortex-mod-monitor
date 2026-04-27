---
name: pages
description: "Skill for the Pages area of vortex-mod-monitor. 29 symbols across 14 files."
---

# Pages

29 symbols | 14 files | Cohesion: 76%

## When to Use

- Working with code in `src/`
- Understanding how pickEhcollFile, useApi, useErrorReporter work
- Modifying pages-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/pages/CollectionsPage.tsx` | CollectionsList, ReceiptDetailModal, handleExportDiagnostic, saveDiagnosticReport, CollectionsPage (+1) |
| `src/ui/pages/HomePage.tsx` | Dashboard, HomePage, PlayerPanel, CuratorPanel |
| `src/ui/pages/install/steps.tsx` | PickStep, StaleReceiptStep, formatTime, handleDelete |
| `src/ui/errors/ErrorContext.tsx` | useErrorReporter, useErrorReporterFormatted |
| `src/ui/pages/build/BuildPage.tsx` | ImportPreviousButton, BuildPage |
| `src/ui/pages/dashboard/data.ts` | formatBytes, formatRelativeTime |
| `src/ui/pages/AboutPage.tsx` | handleClick, openExternal |
| `src/utils/utils.ts` | pickEhcollFile |
| `src/ui/state/ApiContext.tsx` | useApi |
| `src/ui/components/Toast.tsx` | useToast |

## Entry Points

Start here when exploring this area:

- **`pickEhcollFile`** (Function) — `src/utils/utils.ts:70`
- **`useApi`** (Function) — `src/ui/state/ApiContext.tsx:33`
- **`useErrorReporter`** (Function) — `src/ui/errors/ErrorContext.tsx:48`
- **`useToast`** (Function) — `src/ui/components/Toast.tsx:50`
- **`PickStep`** (Function) — `src/ui/pages/install/steps.tsx:183`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `pickEhcollFile` | Function | `src/utils/utils.ts` | 70 |
| `useApi` | Function | `src/ui/state/ApiContext.tsx` | 33 |
| `useErrorReporter` | Function | `src/ui/errors/ErrorContext.tsx` | 48 |
| `useToast` | Function | `src/ui/components/Toast.tsx` | 50 |
| `PickStep` | Function | `src/ui/pages/install/steps.tsx` | 183 |
| `StaleReceiptStep` | Function | `src/ui/pages/install/steps.tsx` | 435 |
| `HomePage` | Function | `src/ui/pages/HomePage.tsx` | 48 |
| `CollectionsPage` | Function | `src/ui/pages/CollectionsPage.tsx` | 56 |
| `useErrorReporterFormatted` | Function | `src/ui/errors/ErrorContext.tsx` | 64 |
| `InstallPage` | Function | `src/ui/pages/install/InstallPage.tsx` | 50 |
| `BuildPage` | Function | `src/ui/pages/build/BuildPage.tsx` | 71 |
| `deleteReceipt` | Function | `src/core/installLedger.ts` | 316 |
| `uninstallMod` | Function | `src/core/installer/modInstall.ts` | 258 |
| `handleDelete` | Function | `src/ui/pages/install/steps.tsx` | 450 |
| `formatBytes` | Function | `src/ui/pages/dashboard/data.ts` | 307 |
| `formatRelativeTime` | Function | `src/ui/pages/dashboard/data.ts` | 314 |
| `Dashboard` | Function | `src/ui/pages/HomePage.tsx` | 61 |
| `CollectionsList` | Function | `src/ui/pages/CollectionsPage.tsx` | 71 |
| `ReceiptDetailModal` | Function | `src/ui/pages/CollectionsPage.tsx` | 503 |
| `handleExportDiagnostic` | Function | `src/ui/pages/CollectionsPage.tsx` | 520 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ReceiptDetailModal → EHRuntime` | cross_community | 7 |
| `ReceiptDetailModal → Notify` | cross_community | 7 |
| `ReceiptDetailModal → GetSnapshot` | cross_community | 6 |
| `Dashboard → InstallLedgerError` | cross_community | 6 |
| `ReceiptDetailModal → WizardReducer` | cross_community | 5 |
| `Dashboard → GetInstallLedgerDir` | cross_community | 5 |
| `Dashboard → IsUuid` | cross_community | 5 |
| `Dashboard → OnError` | cross_community | 5 |
| `CollectionsList → EHRuntime` | cross_community | 4 |
| `CollectionsList → Notify` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Errors | 2 calls |
| Build | 2 calls |
| Dashboard | 1 calls |
| Resolver | 1 calls |
| Installer | 1 calls |
| Install | 1 calls |
| Manifest | 1 calls |

## How to Explore

1. `gitnexus_context({name: "pickEhcollFile"})` — see callers and callees
2. `gitnexus_query({query: "pages"})` — find related execution flows
3. Read key files listed above for implementation details
