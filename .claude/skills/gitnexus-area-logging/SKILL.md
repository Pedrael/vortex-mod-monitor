---
name: gitnexus-area-logging
description: "Skill for the Logging area of vortex-mod-monitor. 12 symbols across 3 files."
---

# Logging

12 symbols | 3 files | Cohesion: 74%

## When to Use

- Working with code in `src/`
- Understanding how getLogFilePath, getEventHorizonDir, getEventHorizonRoot work
- Modifying logging-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/logging/ehLog.ts` | enqueue, getLogFilePath, resolveLogFile, fail, ok (+3) |
| `src/core/paths.ts` | getEventHorizonDir, getEventHorizonRoot |
| `src/index.ts` | init, installEventHorizonIconSet |

## Entry Points

Start here when exploring this area:

- **`getLogFilePath`** (Function) — `src/core/logging/ehLog.ts:69`
- **`getEventHorizonDir`** (Function) — `src/core/paths.ts:53`
- **`getEventHorizonRoot`** (Function) — `src/core/paths.ts:43`
- **`fail`** (Function) — `src/core/logging/ehLog.ts:164`
- **`ok`** (Function) — `src/core/logging/ehLog.ts:159`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getLogFilePath` | Function | `src/core/logging/ehLog.ts` | 69 |
| `getEventHorizonDir` | Function | `src/core/paths.ts` | 53 |
| `getEventHorizonRoot` | Function | `src/core/paths.ts` | 43 |
| `fail` | Function | `src/core/logging/ehLog.ts` | 164 |
| `ok` | Function | `src/core/logging/ehLog.ts` | 159 |
| `step` | Function | `src/core/logging/ehLog.ts` | 158 |
| `ehLog` | Function | `src/core/logging/ehLog.ts` | 115 |
| `enqueue` | Function | `src/core/logging/ehLog.ts` | 98 |
| `resolveLogFile` | Function | `src/core/logging/ehLog.ts` | 51 |
| `init` | Function | `src/index.ts` | 53 |
| `installEventHorizonIconSet` | Function | `src/index.ts` | 33 |
| `truncate` | Function | `src/core/logging/ehLog.ts` | 73 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Init → GetVortexUserDataPath` | cross_community | 9 |
| `CreateBuildPackageAction → GetVortexUserDataPath` | cross_community | 8 |
| `Fail → GetVortexUserDataPath` | cross_community | 7 |
| `Ok → GetVortexUserDataPath` | cross_community | 7 |
| `Step → GetVortexUserDataPath` | cross_community | 7 |
| `Init → Truncate` | cross_community | 5 |
| `CreateBuildPackageAction → Truncate` | cross_community | 4 |
| `Init → Fail` | cross_community | 3 |
| `Init → Ok` | cross_community | 3 |
| `Init → GetActiveGameId` | cross_community | 3 |

## How to Explore

1. `context({name: "getLogFilePath"})` — see callers and callees
2. `query({search_query: "logging"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
