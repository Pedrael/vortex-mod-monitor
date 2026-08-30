---
name: gitnexus-area-errors
description: "Skill for the Errors area of Event-Horizon. 29 symbols across 6 files."
---

# Errors

29 symbols | 6 files | Cohesion: 87%

## When to Use

- Working with code in `src/`
- Understanding how ErrorReportModal, handleCopy, handleSave work
- Modifying errors-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/errors/formatError.ts` | buildErrorReport, classify, classifyGenericError, classifyMultiError, classifyUnknown (+8) |
| `src/ui/errors/ErrorReportModal.tsx` | BulletList, ErrorReportModal, handleCopy, handleSave, Section (+4) |
| `src/ui/errors/ErrorContext.tsx` | onError, onRejection, report |
| `src/ui/pages/install/InstallPage.tsx` | handleCopy, copyTextToClipboard |
| `src/ui/state/ApiContext.tsx` | useApiOptional |
| `src/ui/errors/ErrorBoundary.tsx` | componentDidCatch |

## Entry Points

Start here when exploring this area:

- **`ErrorReportModal`** (Function) — `src/ui/errors/ErrorReportModal.tsx:38`
- **`handleCopy`** (Function) — `src/ui/errors/ErrorReportModal.tsx:67`
- **`handleSave`** (Function) — `src/ui/errors/ErrorReportModal.tsx:78`
- **`buildErrorReport`** (Function) — `src/ui/errors/formatError.ts:134`
- **`useApiOptional`** (Function) — `src/ui/state/ApiContext.tsx:49`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ErrorReportModal` | Function | `src/ui/errors/ErrorReportModal.tsx` | 38 |
| `handleCopy` | Function | `src/ui/errors/ErrorReportModal.tsx` | 67 |
| `handleSave` | Function | `src/ui/errors/ErrorReportModal.tsx` | 78 |
| `buildErrorReport` | Function | `src/ui/errors/formatError.ts` | 134 |
| `useApiOptional` | Function | `src/ui/state/ApiContext.tsx` | 49 |
| `onError` | Function | `src/ui/errors/ErrorContext.tsx` | 121 |
| `onRejection` | Function | `src/ui/errors/ErrorContext.tsx` | 132 |
| `report` | Function | `src/ui/errors/ErrorContext.tsx` | 105 |
| `formatError` | Function | `src/ui/errors/formatError.ts` | 111 |
| `componentDidCatch` | Method | `src/ui/errors/ErrorBoundary.tsx` | 78 |
| `BulletList` | Function | `src/ui/errors/ErrorReportModal.tsx` | 226 |
| `Section` | Function | `src/ui/errors/ErrorReportModal.tsx` | 197 |
| `TechnicalPanel` | Function | `src/ui/errors/ErrorReportModal.tsx` | 240 |
| `copyToClipboard` | Function | `src/ui/errors/ErrorReportModal.tsx` | 296 |
| `saveReportToFile` | Function | `src/ui/errors/ErrorReportModal.tsx` | 320 |
| `tryRequireElectron` | Function | `src/ui/errors/ErrorReportModal.tsx` | 287 |
| `handleCopy` | Function | `src/ui/pages/install/InstallPage.tsx` | 318 |
| `copyTextToClipboard` | Function | `src/ui/pages/install/InstallPage.tsx` | 380 |
| `classify` | Function | `src/ui/errors/formatError.ts` | 197 |
| `classifyGenericError` | Function | `src/ui/errors/formatError.ts` | 375 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `OnError → CleanStack` | cross_community | 6 |
| `OnError → GuessGenericHints` | cross_community | 6 |
| `OnError → GuessGenericTitle` | cross_community | 6 |
| `OnError → CountProblems` | cross_community | 6 |
| `OnRejection → CleanStack` | cross_community | 6 |
| `OnRejection → GuessGenericHints` | cross_community | 6 |
| `OnRejection → GuessGenericTitle` | cross_community | 6 |
| `OnRejection → CountProblems` | cross_community | 6 |
| `OnError → ManifestHints` | cross_community | 5 |
| `OnRejection → ManifestHints` | cross_community | 5 |

## How to Explore

1. `context({name: "ErrorReportModal"})` — see callers and callees
2. `query({search_query: "errors"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
