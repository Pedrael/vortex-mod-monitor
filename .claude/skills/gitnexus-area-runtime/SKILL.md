---
name: gitnexus-area-runtime
description: "Skill for the Runtime area of Event-Horizon. 11 symbols across 6 files."
---

# Runtime

11 symbols | 6 files | Cohesion: 100%

## When to Use

- Working with code in `src/`
- Understanding how verify, installPrerequisites, summarisePrereqResults work
- Modifying runtime-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/runtime/nodePrereqDeps.ts` | download, go, run |
| `src/core/curator/bulkUpdate.test.ts` | verify, ok |
| `src/core/runtime/installPrerequisites.ts` | installPrerequisites, summarisePrereqResults |
| `src/core/runtime/prerequisites.ts` | classifyExitCode, verdictIsGood |
| `src/core/curator/bulkUpdate.ts` | verify |
| `src/core/runtime/installPrerequisites.test.ts` | run |

## Entry Points

Start here when exploring this area:

- **`verify`** (Function) — `src/core/curator/bulkUpdate.ts:103`
- **`installPrerequisites`** (Function) — `src/core/runtime/installPrerequisites.ts:83`
- **`summarisePrereqResults`** (Function) — `src/core/runtime/installPrerequisites.ts:175`
- **`classifyExitCode`** (Function) — `src/core/runtime/prerequisites.ts:154`
- **`verdictIsGood`** (Function) — `src/core/runtime/prerequisites.ts:186`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `verify` | Function | `src/core/curator/bulkUpdate.ts` | 103 |
| `installPrerequisites` | Function | `src/core/runtime/installPrerequisites.ts` | 83 |
| `summarisePrereqResults` | Function | `src/core/runtime/installPrerequisites.ts` | 175 |
| `classifyExitCode` | Function | `src/core/runtime/prerequisites.ts` | 154 |
| `verdictIsGood` | Function | `src/core/runtime/prerequisites.ts` | 186 |
| `verify` | Function | `src/core/curator/bulkUpdate.test.ts` | 71 |
| `ok` | Function | `src/core/curator/bulkUpdate.test.ts` | 27 |
| `run` | Function | `src/core/runtime/installPrerequisites.test.ts` | 151 |
| `download` | Function | `src/core/runtime/nodePrereqDeps.ts` | 30 |
| `go` | Function | `src/core/runtime/nodePrereqDeps.ts` | 36 |
| `run` | Function | `src/core/runtime/nodePrereqDeps.ts` | 90 |

## How to Explore

1. `context({name: "verify"})` — see callers and callees
2. `query({search_query: "runtime"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
