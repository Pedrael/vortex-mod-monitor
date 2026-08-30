---
name: gitnexus-area-components
description: "Skill for the Components area of Event-Horizon. 14 symbols across 5 files."
---

# Components

14 symbols | 5 files | Cohesion: 93%

## When to Use

- Working with code in `src/`
- Understanding how EventHorizonMainPage, ToastProvider, ErrorProvider work
- Modifying components-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/components/Toast.tsx` | ToastCard, ToastHost, ToastProvider, show, nodeToText (+5) |
| `src/ui/EventHorizonMainPage.tsx` | EventHorizonMainPage |
| `src/ui/errors/ErrorContext.tsx` | ErrorProvider |
| `src/ui/state/ApiContext.tsx` | ApiProvider |
| `src/ui/theme/EventHorizonStyles.tsx` | EventHorizonStyles |

## Entry Points

Start here when exploring this area:

- **`EventHorizonMainPage`** (Function) — `src/ui/EventHorizonMainPage.tsx:63`
- **`ToastProvider`** (Function) — `src/ui/components/Toast.tsx:74`
- **`ErrorProvider`** (Function) — `src/ui/errors/ErrorContext.tsx:84`
- **`ApiProvider`** (Function) — `src/ui/state/ApiContext.tsx:25`
- **`EventHorizonStyles`** (Function) — `src/ui/theme/EventHorizonStyles.tsx:41`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `EventHorizonMainPage` | Function | `src/ui/EventHorizonMainPage.tsx` | 63 |
| `ToastProvider` | Function | `src/ui/components/Toast.tsx` | 74 |
| `ErrorProvider` | Function | `src/ui/errors/ErrorContext.tsx` | 84 |
| `ApiProvider` | Function | `src/ui/state/ApiContext.tsx` | 25 |
| `EventHorizonStyles` | Function | `src/ui/theme/EventHorizonStyles.tsx` | 41 |
| `show` | Function | `src/ui/components/Toast.tsx` | 89 |
| `dismiss` | Function | `src/ui/components/Toast.tsx` | 79 |
| `handle` | Function | `src/ui/components/Toast.tsx` | 135 |
| `ToastInput` | Interface | `src/ui/components/Toast.tsx` | 18 |
| `ToastCard` | Function | `src/ui/components/Toast.tsx` | 225 |
| `ToastHost` | Function | `src/ui/components/Toast.tsx` | 194 |
| `nodeToText` | Function | `src/ui/components/Toast.tsx` | 182 |
| `toastDedupKey` | Function | `src/ui/components/Toast.tsx` | 174 |
| `ToastInstance` | Interface | `src/ui/components/Toast.tsx` | 33 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `EventHorizonMainPage → ToastCard` | intra_community | 4 |
| `EventHorizonMainPage → Button` | cross_community | 4 |
| `EventHorizonMainPage → Modal` | cross_community | 4 |
| `EventHorizonMainPage → BuildErrorReport` | cross_community | 4 |
| `EventHorizonMainPage → UseApiOptional` | cross_community | 4 |
| `Show → NodeToText` | intra_community | 3 |

## How to Explore

1. `context({name: "EventHorizonMainPage"})` — see callers and callees
2. `query({search_query: "components"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
