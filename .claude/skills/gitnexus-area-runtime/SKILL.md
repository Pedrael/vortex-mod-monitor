---
name: gitnexus-area-runtime
description: "Skill for the Runtime area of Event-Horizon. 8 symbols across 4 files."
---

# Runtime

8 symbols | 4 files | Cohesion: 100%

## When to Use

- Working with code in `src/`
- Understanding how installPrerequisites, summarisePrereqResults, classifyExitCode work
- Modifying runtime-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/runtime/nodePrereqDeps.ts` | download, go, run |
| `src/core/runtime/installPrerequisites.ts` | installPrerequisites, summarisePrereqResults |
| `src/core/runtime/prerequisites.ts` | classifyExitCode, verdictIsGood |
| `src/core/runtime/installPrerequisites.test.ts` | run |

## Entry Points

Start here when exploring this area:

- **`installPrerequisites`** (Function) — `src/core/runtime/installPrerequisites.ts:83`
- **`summarisePrereqResults`** (Function) — `src/core/runtime/installPrerequisites.ts:175`
- **`classifyExitCode`** (Function) — `src/core/runtime/prerequisites.ts:154`
- **`verdictIsGood`** (Function) — `src/core/runtime/prerequisites.ts:186`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `installPrerequisites` | Function | `src/core/runtime/installPrerequisites.ts` | 83 |
| `summarisePrereqResults` | Function | `src/core/runtime/installPrerequisites.ts` | 175 |
| `classifyExitCode` | Function | `src/core/runtime/prerequisites.ts` | 154 |
| `verdictIsGood` | Function | `src/core/runtime/prerequisites.ts` | 186 |
| `run` | Function | `src/core/runtime/installPrerequisites.test.ts` | 151 |
| `download` | Function | `src/core/runtime/nodePrereqDeps.ts` | 30 |
| `go` | Function | `src/core/runtime/nodePrereqDeps.ts` | 36 |
| `run` | Function | `src/core/runtime/nodePrereqDeps.ts` | 90 |

## How to Explore

1. `context({name: "installPrerequisites"})` — see callers and callees
2. `query({search_query: "runtime"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
