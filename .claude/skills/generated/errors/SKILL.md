---
name: errors
description: "Skill for the Errors area of vortex-mod-monitor. 20 symbols across 5 files."
---

# Errors

20 symbols | 5 files | Cohesion: 90%

## When to Use

- Working with code in `src/`
- Understanding how buildErrorReport, ErrorReportModal, handleCopy work
- Modifying errors-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/errors/formatError.ts` | buildErrorReport, classify, classifyMultiError, classifyGenericError, classifyUnknown (+5) |
| `src/ui/errors/ErrorReportModal.tsx` | ErrorReportModal, handleCopy, handleSave, tryRequireElectron, copyToClipboard (+1) |
| `src/ui/pages/install/InstallPage.tsx` | ErrorRetry, copyTextToClipboard |
| `src/ui/errors/ErrorContext.tsx` | ErrorProvider |
| `src/ui/errors/ErrorBoundary.tsx` | componentDidCatch |

## Entry Points

Start here when exploring this area:

- **`buildErrorReport`** (Function) — `src/ui/errors/formatError.ts:134`
- **`ErrorReportModal`** (Function) — `src/ui/errors/ErrorReportModal.tsx:35`
- **`handleCopy`** (Function) — `src/ui/errors/ErrorReportModal.tsx:60`
- **`handleSave`** (Function) — `src/ui/errors/ErrorReportModal.tsx:71`
- **`formatError`** (Function) — `src/ui/errors/formatError.ts:111`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `buildErrorReport` | Function | `src/ui/errors/formatError.ts` | 134 |
| `ErrorReportModal` | Function | `src/ui/errors/ErrorReportModal.tsx` | 35 |
| `handleCopy` | Function | `src/ui/errors/ErrorReportModal.tsx` | 60 |
| `handleSave` | Function | `src/ui/errors/ErrorReportModal.tsx` | 71 |
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
| `classifyUnknown` | Function | `src/ui/errors/formatError.ts` | 309 |
| `guessGenericTitle` | Function | `src/ui/errors/formatError.ts` | 329 |
| `guessGenericHints` | Function | `src/ui/errors/formatError.ts` | 361 |
| `cleanStack` | Function | `src/ui/errors/formatError.ts` | 392 |
| `pickStringContext` | Function | `src/ui/errors/formatError.ts` | 408 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `StartInstall → ClassifyUnknown` | cross_community | 5 |
| `ErrorProvider → CleanStack` | cross_community | 5 |
| `ErrorProvider → GuessGenericTitle` | cross_community | 5 |
| `ErrorProvider → GuessGenericHints` | cross_community | 5 |
| `ComponentDidCatch → CleanStack` | cross_community | 5 |
| `ComponentDidCatch → GuessGenericTitle` | cross_community | 5 |
| `ComponentDidCatch → GuessGenericHints` | cross_community | 5 |
| `ErrorReportModal → TryRequireElectron` | intra_community | 4 |
| `PickFile → PickStringContext` | cross_community | 4 |
| `ResolveStaleReceipt → PickStringContext` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Pages | 1 calls |

## How to Explore

1. `gitnexus_context({name: "buildErrorReport"})` — see callers and callees
2. `gitnexus_query({query: "errors"})` — find related execution flows
3. Read key files listed above for implementation details
