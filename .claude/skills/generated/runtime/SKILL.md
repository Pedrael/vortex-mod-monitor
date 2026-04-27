---
name: runtime
description: "Skill for the Runtime area of vortex-mod-monitor. 6 symbols across 3 files."
---

# Runtime

6 symbols | 3 files | Cohesion: 83%

## When to Use

- Working with code in `src/`
- Understanding how useEHRuntime, getEHRuntime, ConcurrentOpBanner work
- Modifying runtime-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/runtime/ehRuntime.ts` | EHRuntime, getSnapshot, subscribe, getEHRuntime |
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

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ReceiptDetailModal → EHRuntime` | cross_community | 7 |
| `ApplyGroupRule → EHRuntime` | cross_community | 6 |
| `ApplyGroupDefinition → EHRuntime` | cross_community | 6 |
| `ApplyPluginGroup → EHRuntime` | cross_community | 6 |
| `DecisionsStep → EHRuntime` | cross_community | 5 |
| `OnBuild → EHRuntime` | cross_community | 5 |
| `PickFile → EHRuntime` | cross_community | 5 |
| `ResolveStaleReceipt → EHRuntime` | cross_community | 5 |
| `OpenConfirm → EHRuntime` | cross_community | 5 |
| `StartInstall → EHRuntime` | cross_community | 5 |

## How to Explore

1. `gitnexus_context({name: "useEHRuntime"})` — see callers and callees
2. `gitnexus_query({query: "runtime"})` — find related execution flows
3. Read key files listed above for implementation details
