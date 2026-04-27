---
name: errors
description: "Skill for the Errors area of vortex-mod-monitor. 34 symbols across 6 files."
---

# Errors

34 symbols | 6 files | Cohesion: 89%

## When to Use

- Working with code in `src/`
- Understanding how getReceiptPath, getInstallLedgerDir, parseReceipt work
- Modifying errors-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/installLedger.ts` | InstallLedgerError, getReceiptPath, getInstallLedgerDir, parseReceipt, serializeReceipt (+8) |
| `src/ui/errors/formatError.ts` | buildErrorReport, classify, classifyMultiError, classifyGenericError, classifyUnknown (+5) |
| `src/ui/errors/ErrorReportModal.tsx` | ErrorReportModal, handleCopy, handleSave, tryRequireElectron, copyToClipboard (+1) |
| `src/ui/errors/ErrorContext.tsx` | onError, ErrorProvider |
| `src/ui/pages/install/InstallPage.tsx` | ErrorRetry, copyTextToClipboard |
| `src/ui/errors/ErrorBoundary.tsx` | componentDidCatch |

## Entry Points

Start here when exploring this area:

- **`getReceiptPath`** (Function) — `src/core/installLedger.ts:121`
- **`getInstallLedgerDir`** (Function) — `src/core/installLedger.ts:137`
- **`parseReceipt`** (Function) — `src/core/installLedger.ts:152`
- **`serializeReceipt`** (Function) — `src/core/installLedger.ts:253`
- **`readReceipt`** (Function) — `src/core/installLedger.ts:270`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `InstallLedgerError` | Class | `src/core/installLedger.ts` | 67 |
| `getReceiptPath` | Function | `src/core/installLedger.ts` | 121 |
| `getInstallLedgerDir` | Function | `src/core/installLedger.ts` | 137 |
| `parseReceipt` | Function | `src/core/installLedger.ts` | 152 |
| `serializeReceipt` | Function | `src/core/installLedger.ts` | 253 |
| `readReceipt` | Function | `src/core/installLedger.ts` | 270 |
| `writeReceipt` | Function | `src/core/installLedger.ts` | 294 |
| `listReceipts` | Function | `src/core/installLedger.ts` | 342 |
| `onError` | Function | `src/ui/errors/ErrorContext.tsx` | 121 |
| `buildErrorReport` | Function | `src/ui/errors/formatError.ts` | 134 |
| `ErrorReportModal` | Function | `src/ui/errors/ErrorReportModal.tsx` | 35 |
| `handleCopy` | Function | `src/ui/errors/ErrorReportModal.tsx` | 60 |
| `handleSave` | Function | `src/ui/errors/ErrorReportModal.tsx` | 71 |
| `formatError` | Function | `src/ui/errors/formatError.ts` | 111 |
| `ErrorProvider` | Function | `src/ui/errors/ErrorContext.tsx` | 84 |
| `componentDidCatch` | Method | `src/ui/errors/ErrorBoundary.tsx` | 78 |
| `validateModEntries` | Function | `src/core/installLedger.ts` | 380 |
| `expectString` | Function | `src/core/installLedger.ts` | 433 |
| `isUuid` | Function | `src/core/installLedger.ts` | 469 |
| `isSemverLike` | Function | `src/core/installLedger.ts` | 476 |

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
| `ErrorProvider → CleanStack` | cross_community | 5 |
| `ErrorProvider → GuessGenericTitle` | cross_community | 5 |
| `ErrorProvider → GuessGenericHints` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Pages | 1 calls |

## How to Explore

1. `gitnexus_context({name: "getReceiptPath"})` — see callers and callees
2. `gitnexus_query({query: "errors"})` — find related execution flows
3. Read key files listed above for implementation details
