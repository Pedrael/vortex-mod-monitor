---
name: gitnexus-area-runtime
description: "Skill for the Runtime area of vortex-mod-monitor. 8 symbols across 3 files."
---

# Runtime

8 symbols | 3 files | Cohesion: 82%

## When to Use

- Working with code in `src/`
- Understanding how getEHRuntime, runtime work
- Modifying runtime-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/runtime/ehRuntime.ts` | EHRuntime, getEHRuntime, notify, setBuildBusy, setInstallBusy |
| `src/ui/pages/install/installSession.ts` | getSnapshot, notify |
| `src/ui/runtime/useEHRuntime.ts` | runtime |

## Entry Points

Start here when exploring this area:

- **`getEHRuntime`** (Function) — `src/ui/runtime/ehRuntime.ts:79`
- **`runtime`** (Function) — `src/ui/runtime/useEHRuntime.ts:14`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getEHRuntime` | Function | `src/ui/runtime/ehRuntime.ts` | 79 |
| `runtime` | Function | `src/ui/runtime/useEHRuntime.ts` | 14 |
| `EHRuntime` | Class | `src/ui/runtime/ehRuntime.ts` | 38 |
| `getSnapshot` | Method | `src/ui/pages/install/installSession.ts` | 92 |
| `notify` | Method | `src/ui/pages/install/installSession.ts` | 421 |
| `notify` | Method | `src/ui/runtime/ehRuntime.ts` | 65 |
| `setBuildBusy` | Method | `src/ui/runtime/ehRuntime.ts` | 53 |
| `setInstallBusy` | Method | `src/ui/runtime/ehRuntime.ts` | 59 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `StartInstall → EHRuntime` | cross_community | 6 |
| `StartInstall → Notify` | cross_community | 6 |
| `StartInstall → GetSnapshot` | cross_community | 5 |
| `Session → EHRuntime` | cross_community | 5 |
| `Session → Notify` | cross_community | 5 |
| `ReleaseBuild → EHRuntime` | cross_community | 5 |
| `ReleaseBuild → Notify` | cross_community | 5 |
| `OnHashProgress → EHRuntime` | cross_community | 5 |
| `OnHashProgress → Notify` | cross_community | 5 |
| `OnPhase → EHRuntime` | cross_community | 5 |

## How to Explore

1. `context({name: "getEHRuntime"})` — see callers and callees
2. `query({search_query: "runtime"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
