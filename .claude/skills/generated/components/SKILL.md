---
name: components
description: "Skill for the Components area of vortex-mod-monitor. 3 symbols across 1 files."
---

# Components

3 symbols | 1 files | Cohesion: 100%

## When to Use

- Working with code in `src/`
- Understanding how ProgressRing, renderLabel work
- Modifying components-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/components/ProgressRing.tsx` | ProgressRing, renderLabel, clamp |

## Entry Points

Start here when exploring this area:

- **`ProgressRing`** (Function) — `src/ui/components/ProgressRing.tsx:29`
- **`renderLabel`** (Function) — `src/ui/components/ProgressRing.tsx:42`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ProgressRing` | Function | `src/ui/components/ProgressRing.tsx` | 29 |
| `renderLabel` | Function | `src/ui/components/ProgressRing.tsx` | 42 |
| `clamp` | Function | `src/ui/components/ProgressRing.tsx` | 100 |

## How to Explore

1. `gitnexus_context({name: "ProgressRing"})` — see callers and callees
2. `gitnexus_query({query: "components"})` — find related execution flows
3. Read key files listed above for implementation details
