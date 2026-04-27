---
name: components
description: "Skill for the Components area of vortex-mod-monitor. 6 symbols across 2 files."
---

# Components

6 symbols | 2 files | Cohesion: 100%

## When to Use

- Working with code in `src/`
- Understanding how ToastProvider, ProgressRing, renderLabel work
- Modifying components-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/components/Toast.tsx` | ToastProvider, toastDedupKey, nodeToText |
| `src/ui/components/ProgressRing.tsx` | ProgressRing, renderLabel, clamp |

## Entry Points

Start here when exploring this area:

- **`ToastProvider`** (Function) — `src/ui/components/Toast.tsx:74`
- **`ProgressRing`** (Function) — `src/ui/components/ProgressRing.tsx:29`
- **`renderLabel`** (Function) — `src/ui/components/ProgressRing.tsx:42`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ToastProvider` | Function | `src/ui/components/Toast.tsx` | 74 |
| `ProgressRing` | Function | `src/ui/components/ProgressRing.tsx` | 29 |
| `renderLabel` | Function | `src/ui/components/ProgressRing.tsx` | 42 |
| `toastDedupKey` | Function | `src/ui/components/Toast.tsx` | 174 |
| `nodeToText` | Function | `src/ui/components/Toast.tsx` | 182 |
| `clamp` | Function | `src/ui/components/ProgressRing.tsx` | 100 |

## How to Explore

1. `gitnexus_context({name: "ToastProvider"})` — see callers and callees
2. `gitnexus_query({query: "components"})` — find related execution flows
3. Read key files listed above for implementation details
