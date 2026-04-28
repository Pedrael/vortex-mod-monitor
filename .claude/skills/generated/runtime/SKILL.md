---
name: runtime
description: "Skill for the Runtime area of vortex-mod-monitor. 14 symbols across 5 files."
---

# Runtime

14 symbols | 5 files | Cohesion: 74%

## When to Use

- Working with code in `src/`
- Understanding how getEHRuntime, useEHRuntime, ConcurrentOpBanner work
- Modifying runtime-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/runtime/ehRuntime.ts` | EHRuntime, setBuildBusy, setInstallBusy, notify, getEHRuntime (+2) |
| `src/ui/pages/build/buildSessionRegistry.ts` | remove, isAnyBusy, emit |
| `src/ui/pages/install/installSession.ts` | getSnapshot, notify |
| `src/ui/runtime/useEHRuntime.ts` | useEHRuntime |
| `src/ui/runtime/ConcurrentOpBanner.tsx` | ConcurrentOpBanner |

## Entry Points

Start here when exploring this area:

- **`getEHRuntime`** (Function) — `src/ui/runtime/ehRuntime.ts:79`
- **`useEHRuntime`** (Function) — `src/ui/runtime/useEHRuntime.ts:13`
- **`ConcurrentOpBanner`** (Function) — `src/ui/runtime/ConcurrentOpBanner.tsx:17`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getEHRuntime` | Function | `src/ui/runtime/ehRuntime.ts` | 79 |
| `useEHRuntime` | Function | `src/ui/runtime/useEHRuntime.ts` | 13 |
| `ConcurrentOpBanner` | Function | `src/ui/runtime/ConcurrentOpBanner.tsx` | 17 |
| `EHRuntime` | Class | `src/ui/runtime/ehRuntime.ts` | 38 |
| `setBuildBusy` | Method | `src/ui/runtime/ehRuntime.ts` | 53 |
| `setInstallBusy` | Method | `src/ui/runtime/ehRuntime.ts` | 59 |
| `notify` | Method | `src/ui/runtime/ehRuntime.ts` | 65 |
| `getSnapshot` | Method | `src/ui/pages/install/installSession.ts` | 92 |
| `notify` | Method | `src/ui/pages/install/installSession.ts` | 421 |
| `remove` | Method | `src/ui/pages/build/buildSessionRegistry.ts` | 113 |
| `isAnyBusy` | Method | `src/ui/pages/build/buildSessionRegistry.ts` | 134 |
| `emit` | Method | `src/ui/pages/build/buildSessionRegistry.ts` | 258 |
| `getSnapshot` | Method | `src/ui/runtime/ehRuntime.ts` | 42 |
| `subscribe` | Method | `src/ui/runtime/ehRuntime.ts` | 46 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ReceiptDetailModal → EHRuntime` | cross_community | 7 |
| `ReceiptDetailModal → Notify` | cross_community | 7 |
| `HandleUpdatePublished → EHRuntime` | cross_community | 7 |
| `HandleNewDraft → EHRuntime` | cross_community | 7 |
| `HandleNewDraft → Notify` | cross_community | 7 |
| `HandleOpenDraft → EHRuntime` | cross_community | 7 |
| `HandleOpenDraft → Notify` | cross_community | 7 |
| `ReceiptDetailModal → GetSnapshot` | cross_community | 6 |
| `HandleUpdatePublished → Notify` | cross_community | 6 |
| `HandleUpdatePublished → GetState` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Resolver | 1 calls |

## How to Explore

1. `gitnexus_context({name: "getEHRuntime"})` — see callers and callees
2. `gitnexus_query({query: "runtime"})` — find related execution flows
3. Read key files listed above for implementation details
