---
name: gitnexus-area-errors
description: "Skill for the Errors area of vortex-mod-monitor. 25 symbols across 5 files."
---

# Errors

25 symbols | 5 files | Cohesion: 81%

## When to Use

- Working with code in `src/`
- Understanding how ErrorReportModal, buildErrorReport, onError work
- Modifying errors-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/errors/formatError.ts` | buildErrorReport, classify, classifyGenericError, classifyMultiError, classifyUnknown (+5) |
| `src/ui/errors/ErrorReportModal.tsx` | BulletList, ErrorReportModal, Section, TechnicalPanel, handleCopy (+4) |
| `src/ui/errors/ErrorContext.tsx` | onError, onRejection, report |
| `src/ui/pages/install/InstallPage.tsx` | handleCopy, copyTextToClipboard |
| `src/ui/errors/ErrorBoundary.tsx` | componentDidCatch |

## Entry Points

Start here when exploring this area:

- **`ErrorReportModal`** (Function) — `src/ui/errors/ErrorReportModal.tsx:35`
- **`buildErrorReport`** (Function) — `src/ui/errors/formatError.ts:134`
- **`onError`** (Function) — `src/ui/errors/ErrorContext.tsx:121`
- **`onRejection`** (Function) — `src/ui/errors/ErrorContext.tsx:132`
- **`report`** (Function) — `src/ui/errors/ErrorContext.tsx:105`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ErrorReportModal` | Function | `src/ui/errors/ErrorReportModal.tsx` | 35 |
| `buildErrorReport` | Function | `src/ui/errors/formatError.ts` | 134 |
| `onError` | Function | `src/ui/errors/ErrorContext.tsx` | 121 |
| `onRejection` | Function | `src/ui/errors/ErrorContext.tsx` | 132 |
| `report` | Function | `src/ui/errors/ErrorContext.tsx` | 105 |
| `formatError` | Function | `src/ui/errors/formatError.ts` | 111 |
| `handleCopy` | Function | `src/ui/errors/ErrorReportModal.tsx` | 60 |
| `handleSave` | Function | `src/ui/errors/ErrorReportModal.tsx` | 71 |
| `componentDidCatch` | Method | `src/ui/errors/ErrorBoundary.tsx` | 78 |
| `BulletList` | Function | `src/ui/errors/ErrorReportModal.tsx` | 226 |
| `Section` | Function | `src/ui/errors/ErrorReportModal.tsx` | 197 |
| `TechnicalPanel` | Function | `src/ui/errors/ErrorReportModal.tsx` | 246 |
| `handleCopy` | Function | `src/ui/pages/install/InstallPage.tsx` | 312 |
| `copyTextToClipboard` | Function | `src/ui/pages/install/InstallPage.tsx` | 374 |
| `classify` | Function | `src/ui/errors/formatError.ts` | 197 |
| `classifyGenericError` | Function | `src/ui/errors/formatError.ts` | 293 |
| `classifyMultiError` | Function | `src/ui/errors/formatError.ts` | 276 |
| `classifyUnknown` | Function | `src/ui/errors/formatError.ts` | 309 |
| `cleanStack` | Function | `src/ui/errors/formatError.ts` | 392 |
| `guessGenericHints` | Function | `src/ui/errors/formatError.ts` | 361 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `OnError → CleanStack` | cross_community | 6 |
| `OnError → GuessGenericHints` | cross_community | 6 |
| `OnError → GuessGenericTitle` | cross_community | 6 |
| `OnRejection → CleanStack` | cross_community | 6 |
| `OnRejection → GuessGenericHints` | cross_community | 6 |
| `OnRejection → GuessGenericTitle` | cross_community | 6 |
| `OnError → ClassifyUnknown` | cross_community | 5 |
| `OnRejection → ClassifyUnknown` | cross_community | 5 |
| `ComponentDidCatch → CleanStack` | cross_community | 5 |
| `ComponentDidCatch → GuessGenericHints` | cross_community | 5 |

## How to Explore

1. `context({name: "ErrorReportModal"})` — see callers and callees
2. `query({search_query: "errors"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
