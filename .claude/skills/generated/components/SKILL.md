---
name: components
description: "Skill for the Components area of vortex-mod-monitor. 12 symbols across 5 files."
---

# Components

12 symbols | 5 files | Cohesion: 92%

## When to Use

- Working with code in `src/`
- Understanding how EventHorizonMainPage, ToastProvider, ErrorProvider work
- Modifying components-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/components/Toast.tsx` | ToastProvider, ToastHost, ToastCard, show, toastDedupKey (+3) |
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
- **`EventHorizonStyles`** (Function) — `src/ui/theme/EventHorizonStyles.tsx:37`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `EventHorizonMainPage` | Function | `src/ui/EventHorizonMainPage.tsx` | 63 |
| `ToastProvider` | Function | `src/ui/components/Toast.tsx` | 74 |
| `ErrorProvider` | Function | `src/ui/errors/ErrorContext.tsx` | 84 |
| `ApiProvider` | Function | `src/ui/state/ApiContext.tsx` | 25 |
| `EventHorizonStyles` | Function | `src/ui/theme/EventHorizonStyles.tsx` | 37 |
| `show` | Function | `src/ui/components/Toast.tsx` | 88 |
| `dismiss` | Function | `src/ui/components/Toast.tsx` | 79 |
| `handle` | Function | `src/ui/components/Toast.tsx` | 135 |
| `ToastHost` | Function | `src/ui/components/Toast.tsx` | 194 |
| `ToastCard` | Function | `src/ui/components/Toast.tsx` | 225 |
| `toastDedupKey` | Function | `src/ui/components/Toast.tsx` | 174 |
| `nodeToText` | Function | `src/ui/components/Toast.tsx` | 182 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `EventHorizonMainPage → TryRequireElectron` | cross_community | 6 |
| `EventHorizonMainPage → Modal` | cross_community | 4 |
| `EventHorizonMainPage → BuildErrorReport` | cross_community | 4 |
| `EventHorizonMainPage → Button` | cross_community | 4 |
| `EventHorizonMainPage → ToastCard` | intra_community | 4 |
| `Show → NodeToText` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Pages | 1 calls |
| Errors | 1 calls |

## How to Explore

1. `gitnexus_context({name: "EventHorizonMainPage"})` — see callers and callees
2. `gitnexus_query({query: "components"})` — find related execution flows
3. Read key files listed above for implementation details
