---
name: gitnexus-area-runtime
description: "Skill for the Runtime area of Event-Horizon. 17 symbols across 7 files."
---

# Runtime

17 symbols | 7 files | Cohesion: 89%

## When to Use

- Working with code in `src/`
- Understanding how getEHRuntime, runtime, installPrerequisites work
- Modifying runtime-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/ui/runtime/ehRuntime.ts` | EHRuntime, getEHRuntime, notify, setBuildBusy, setInstallBusy |
| `src/ui/pages/install/installSession.ts` | cancelInstall, getSnapshot, notify |
| `src/core/runtime/nodePrereqDeps.ts` | download, go, run |
| `src/core/runtime/installPrerequisites.ts` | installPrerequisites, summarisePrereqResults |
| `src/core/runtime/prerequisites.ts` | classifyExitCode, verdictIsGood |
| `src/ui/runtime/useEHRuntime.ts` | runtime |
| `src/core/runtime/installPrerequisites.test.ts` | run |

## Entry Points

Start here when exploring this area:

- **`getEHRuntime`** (Function) — `src/ui/runtime/ehRuntime.ts:79`
- **`runtime`** (Function) — `src/ui/runtime/useEHRuntime.ts:14`
- **`installPrerequisites`** (Function) — `src/core/runtime/installPrerequisites.ts:83`
- **`summarisePrereqResults`** (Function) — `src/core/runtime/installPrerequisites.ts:175`
- **`classifyExitCode`** (Function) — `src/core/runtime/prerequisites.ts:154`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getEHRuntime` | Function | `src/ui/runtime/ehRuntime.ts` | 79 |
| `runtime` | Function | `src/ui/runtime/useEHRuntime.ts` | 14 |
| `installPrerequisites` | Function | `src/core/runtime/installPrerequisites.ts` | 83 |
| `summarisePrereqResults` | Function | `src/core/runtime/installPrerequisites.ts` | 175 |
| `classifyExitCode` | Function | `src/core/runtime/prerequisites.ts` | 154 |
| `verdictIsGood` | Function | `src/core/runtime/prerequisites.ts` | 186 |
| `EHRuntime` | Class | `src/ui/runtime/ehRuntime.ts` | 38 |
| `run` | Function | `src/core/runtime/installPrerequisites.test.ts` | 151 |
| `download` | Function | `src/core/runtime/nodePrereqDeps.ts` | 30 |
| `go` | Function | `src/core/runtime/nodePrereqDeps.ts` | 36 |
| `run` | Function | `src/core/runtime/nodePrereqDeps.ts` | 90 |
| `cancelInstall` | Method | `src/ui/pages/install/installSession.ts` | 750 |
| `getSnapshot` | Method | `src/ui/pages/install/installSession.ts` | 98 |
| `notify` | Method | `src/ui/pages/install/installSession.ts` | 817 |
| `notify` | Method | `src/ui/runtime/ehRuntime.ts` | 65 |
| `setBuildBusy` | Method | `src/ui/runtime/ehRuntime.ts` | 53 |
| `setInstallBusy` | Method | `src/ui/runtime/ehRuntime.ts` | 59 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Heal → EHRuntime` | cross_community | 6 |
| `Heal → Notify` | cross_community | 6 |
| `Heal → GetSnapshot` | cross_community | 5 |
| `Session → EHRuntime` | cross_community | 5 |
| `Session → Notify` | cross_community | 5 |
| `OnHashProgress → EHRuntime` | cross_community | 5 |
| `OnHashProgress → Notify` | cross_community | 5 |
| `OnPhase → EHRuntime` | cross_community | 5 |
| `OnPhase → Notify` | cross_community | 5 |
| `OnHashProgress → EHRuntime` | cross_community | 5 |

## How to Explore

1. `context({name: "getEHRuntime"})` — see callers and callees
2. `query({search_query: "runtime"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
