---
name: errors
description: "Skill for the Errors area of vortex-mod-monitor. 26 symbols across 6 files."
---

# Errors

26 symbols | 6 files | Cohesion: 82%

## When to Use

- Working with code in `src/`
- Understanding how buildErrorReport, ErrorReportModal, handleCopy work
- Modifying errors-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/errors/formatError.ts` | buildErrorReport, classify, classifyMultiError, classifyGenericError, classifyUnknown (+5) |
| `src/ui/errors/ErrorReportModal.tsx` | ErrorReportModal, handleCopy, handleSave, tryRequireElectron, copyToClipboard (+1) |
| `src/core/installLedger.ts` | InstallLedgerError, getReceiptPath, getInstallLedgerDir, listReceipts, isUuid |
| `src/ui/pages/install/InstallPage.tsx` | ErrorRetry, copyTextToClipboard |
| `src/ui/errors/ErrorContext.tsx` | onError, ErrorProvider |
| `src/ui/errors/ErrorBoundary.tsx` | componentDidCatch |

## Entry Points

Start here when exploring this area:

- **`buildErrorReport`** (Function) — `src/ui/errors/formatError.ts:134`
- **`ErrorReportModal`** (Function) — `src/ui/errors/ErrorReportModal.tsx:35`
- **`handleCopy`** (Function) — `src/ui/errors/ErrorReportModal.tsx:60`
- **`handleSave`** (Function) — `src/ui/errors/ErrorReportModal.tsx:71`
- **`getReceiptPath`** (Function) — `src/core/installLedger.ts:121`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `InstallLedgerError` | Class | `src/core/installLedger.ts` | 67 |
| `buildErrorReport` | Function | `src/ui/errors/formatError.ts` | 134 |
| `ErrorReportModal` | Function | `src/ui/errors/ErrorReportModal.tsx` | 35 |
| `handleCopy` | Function | `src/ui/errors/ErrorReportModal.tsx` | 60 |
| `handleSave` | Function | `src/ui/errors/ErrorReportModal.tsx` | 71 |
| `getReceiptPath` | Function | `src/core/installLedger.ts` | 121 |
| `getInstallLedgerDir` | Function | `src/core/installLedger.ts` | 137 |
| `listReceipts` | Function | `src/core/installLedger.ts` | 342 |
| `onError` | Function | `src/ui/errors/ErrorContext.tsx` | 121 |
| `formatError` | Function | `src/ui/errors/formatError.ts` | 111 |
| `ErrorProvider` | Function | `src/ui/errors/ErrorContext.tsx` | 84 |
| `componentDidCatch` | Method | `src/ui/errors/ErrorBoundary.tsx` | 78 |
| `tryRequireElectron` | Function | `src/ui/errors/ErrorReportModal.tsx` | 293 |
| `copyToClipboard` | Function | `src/ui/errors/ErrorReportModal.tsx` | 302 |
| `saveReportToFile` | Function | `src/ui/errors/ErrorReportModal.tsx` | 316 |
| `ErrorRetry` | Function | `src/ui/pages/install/InstallPage.tsx` | 305 |
| `copyTextToClipboard` | Function | `src/ui/pages/install/InstallPage.tsx` | 374 |
| `classify` | Function | `src/ui/errors/formatError.ts` | 197 |
| `classifyMultiError` | Function | `src/ui/errors/formatError.ts` | 276 |
| `classifyGenericError` | Function | `src/ui/errors/formatError.ts` | 293 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Dashboard → InstallLedgerError` | cross_community | 6 |
| `Dashboard → GetInstallLedgerDir` | cross_community | 5 |
| `Dashboard → IsUuid` | cross_community | 5 |
| `Dashboard → OnError` | cross_community | 5 |
| `LoadDashboardData → ExpectString` | cross_community | 5 |
| `LoadDashboardData → IsUuid` | cross_community | 5 |
| `LoadDashboardData → IsSemverLike` | cross_community | 5 |
| `StartInstall → ClassifyUnknown` | cross_community | 5 |
| `ErrorProvider → CleanStack` | cross_community | 5 |
| `ErrorProvider → GuessGenericTitle` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Cluster_13 | 1 calls |
| Pages | 1 calls |

## How to Explore

1. `gitnexus_context({name: "buildErrorReport"})` — see callers and callees
2. `gitnexus_query({query: "errors"})` — find related execution flows
3. Read key files listed above for implementation details
