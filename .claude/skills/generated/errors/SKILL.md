---
name: errors
description: "Skill for the Errors area of vortex-mod-monitor. 25 symbols across 5 files."
---

# Errors

25 symbols | 5 files | Cohesion: 81%

## When to Use

- Working with code in `src/`
- Understanding how buildErrorReport, ErrorReportModal, formatError work
- Modifying errors-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/errors/formatError.ts` | buildErrorReport, classify, classifyMultiError, classifyGenericError, classifyUnknown (+5) |
| `src/ui/errors/ErrorReportModal.tsx` | ErrorReportModal, Section, BulletList, TechnicalPanel, handleCopy (+4) |
| `src/ui/errors/ErrorContext.tsx` | report, onError, onRejection |
| `src/ui/pages/install/InstallPage.tsx` | handleCopy, copyTextToClipboard |
| `src/ui/errors/ErrorBoundary.tsx` | componentDidCatch |

## Entry Points

Start here when exploring this area:

- **`buildErrorReport`** (Function) — `src/ui/errors/formatError.ts:134`
- **`ErrorReportModal`** (Function) — `src/ui/errors/ErrorReportModal.tsx:35`
- **`formatError`** (Function) — `src/ui/errors/formatError.ts:111`
- **`report`** (Function) — `src/ui/errors/ErrorContext.tsx:104`
- **`onError`** (Function) — `src/ui/errors/ErrorContext.tsx:121`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `buildErrorReport` | Function | `src/ui/errors/formatError.ts` | 134 |
| `ErrorReportModal` | Function | `src/ui/errors/ErrorReportModal.tsx` | 35 |
| `formatError` | Function | `src/ui/errors/formatError.ts` | 111 |
| `report` | Function | `src/ui/errors/ErrorContext.tsx` | 104 |
| `onError` | Function | `src/ui/errors/ErrorContext.tsx` | 121 |
| `onRejection` | Function | `src/ui/errors/ErrorContext.tsx` | 132 |
| `handleCopy` | Function | `src/ui/errors/ErrorReportModal.tsx` | 60 |
| `handleSave` | Function | `src/ui/errors/ErrorReportModal.tsx` | 71 |
| `componentDidCatch` | Method | `src/ui/errors/ErrorBoundary.tsx` | 78 |
| `Section` | Function | `src/ui/errors/ErrorReportModal.tsx` | 197 |
| `BulletList` | Function | `src/ui/errors/ErrorReportModal.tsx` | 226 |
| `TechnicalPanel` | Function | `src/ui/errors/ErrorReportModal.tsx` | 246 |
| `handleCopy` | Function | `src/ui/pages/install/InstallPage.tsx` | 312 |
| `copyTextToClipboard` | Function | `src/ui/pages/install/InstallPage.tsx` | 374 |
| `classify` | Function | `src/ui/errors/formatError.ts` | 197 |
| `classifyMultiError` | Function | `src/ui/errors/formatError.ts` | 276 |
| `classifyGenericError` | Function | `src/ui/errors/formatError.ts` | 293 |
| `classifyUnknown` | Function | `src/ui/errors/formatError.ts` | 309 |
| `guessGenericTitle` | Function | `src/ui/errors/formatError.ts` | 329 |
| `guessGenericHints` | Function | `src/ui/errors/formatError.ts` | 361 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `EventHorizonMainPage → TryRequireElectron` | cross_community | 6 |
| `OnError → CleanStack` | cross_community | 6 |
| `OnError → GuessGenericTitle` | cross_community | 6 |
| `OnError → GuessGenericHints` | cross_community | 6 |
| `OnRejection → CleanStack` | cross_community | 6 |
| `OnRejection → GuessGenericTitle` | cross_community | 6 |
| `OnRejection → GuessGenericHints` | cross_community | 6 |
| `OnError → ClassifyUnknown` | cross_community | 5 |
| `OnRejection → ClassifyUnknown` | cross_community | 5 |
| `ComponentDidCatch → CleanStack` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Pages | 2 calls |
| Build | 1 calls |

## How to Explore

1. `gitnexus_context({name: "buildErrorReport"})` — see callers and callees
2. `gitnexus_query({query: "errors"})` — find related execution flows
3. Read key files listed above for implementation details
