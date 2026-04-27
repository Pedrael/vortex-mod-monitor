---
name: runtime
description: "Skill for the Runtime area of vortex-mod-monitor. 11 symbols across 4 files."
---

# Runtime

11 symbols | 4 files | Cohesion: 76%

## When to Use

- Working with code in `src/`
- Understanding how useEHRuntime, getEHRuntime, ConcurrentOpBanner work
- Modifying runtime-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/runtime/ehRuntime.ts` | EHRuntime, getSnapshot, subscribe, getEHRuntime, setBuildBusy (+2) |
| `src/ui/pages/install/installSession.ts` | getSnapshot, notify |
| `src/ui/runtime/useEHRuntime.ts` | useEHRuntime |
| `src/ui/runtime/ConcurrentOpBanner.tsx` | ConcurrentOpBanner |

## Entry Points

Start here when exploring this area:

- **`useEHRuntime`** (Function) — `src/ui/runtime/useEHRuntime.ts:13`
- **`getEHRuntime`** (Function) — `src/ui/runtime/ehRuntime.ts:79`
- **`ConcurrentOpBanner`** (Function) — `src/ui/runtime/ConcurrentOpBanner.tsx:17`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `useEHRuntime` | Function | `src/ui/runtime/useEHRuntime.ts` | 13 |
| `getEHRuntime` | Function | `src/ui/runtime/ehRuntime.ts` | 79 |
| `ConcurrentOpBanner` | Function | `src/ui/runtime/ConcurrentOpBanner.tsx` | 17 |
| `EHRuntime` | Class | `src/ui/runtime/ehRuntime.ts` | 38 |
| `getSnapshot` | Method | `src/ui/runtime/ehRuntime.ts` | 42 |
| `subscribe` | Method | `src/ui/runtime/ehRuntime.ts` | 46 |
| `setBuildBusy` | Method | `src/ui/runtime/ehRuntime.ts` | 53 |
| `setInstallBusy` | Method | `src/ui/runtime/ehRuntime.ts` | 59 |
| `notify` | Method | `src/ui/runtime/ehRuntime.ts` | 65 |
| `getSnapshot` | Method | `src/ui/pages/install/installSession.ts` | 92 |
| `notify` | Method | `src/ui/pages/install/installSession.ts` | 421 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ReceiptDetailModal → EHRuntime` | cross_community | 7 |
| `ReceiptDetailModal → Notify` | cross_community | 7 |
| `ReceiptDetailModal → GetSnapshot` | cross_community | 6 |
| `ApplyGroupRule → EHRuntime` | cross_community | 6 |
| `ApplyGroupRule → Notify` | cross_community | 6 |
| `ApplyGroupDefinition → EHRuntime` | cross_community | 6 |
| `ApplyGroupDefinition → Notify` | cross_community | 6 |
| `ApplyPluginGroup → EHRuntime` | cross_community | 6 |
| `ApplyPluginGroup → Notify` | cross_community | 6 |
| `DecisionsStep → EHRuntime` | cross_community | 5 |

## How to Explore

1. `gitnexus_context({name: "useEHRuntime"})` — see callers and callees
2. `gitnexus_query({query: "runtime"})` — find related execution flows
3. Read key files listed above for implementation details
