---
name: gitnexus-area-scripts
description: "Skill for the Scripts area of vortex-mod-monitor. 48 symbols across 5 files."
---

# Scripts

48 symbols | 5 files | Cohesion: 90%

## When to Use

- Working with code in `scripts/`
- Understanding how verifyInstall, isEnospcError, withProjectTmpEnv work
- Modifying scripts-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `scripts/bearing-verify.mjs` | checkFile, checkHookExecutable, checkHooksJson, checkManifest, checkModuleDelivery (+16) |
| `scripts/bearing-ci.mjs` | blastRadius, collectDiff, detectChanges, num, git (+7) |
| `scripts/bearing-agent.mjs` | loadStaleness, markRefreshOutcome, run, runAllowFail, currentBranch (+2) |
| `scripts/bearing-token-benchmark.mjs` | classicalCost, cypher, gn, graphCost, pickTargets (+1) |
| `scripts/lib/project-tmp.mjs` | isEnospcError, withProjectTmpEnv |

## Entry Points

Start here when exploring this area:

- **`verifyInstall`** (Function) — `scripts/bearing-verify.mjs:395`
- **`isEnospcError`** (Function) — `scripts/lib/project-tmp.mjs:95`
- **`withProjectTmpEnv`** (Function) — `scripts/lib/project-tmp.mjs:25`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `verifyInstall` | Function | `scripts/bearing-verify.mjs` | 395 |
| `isEnospcError` | Function | `scripts/lib/project-tmp.mjs` | 95 |
| `withProjectTmpEnv` | Function | `scripts/lib/project-tmp.mjs` | 25 |
| `checkFile` | Function | `scripts/bearing-verify.mjs` | 108 |
| `checkHookExecutable` | Function | `scripts/bearing-verify.mjs` | 383 |
| `checkHooksJson` | Function | `scripts/bearing-verify.mjs` | 308 |
| `checkManifest` | Function | `scripts/bearing-verify.mjs` | 113 |
| `checkModuleDelivery` | Function | `scripts/bearing-verify.mjs` | 199 |
| `checkPackageGates` | Function | `scripts/bearing-verify.mjs` | 123 |
| `checkRetiredHookKeys` | Function | `scripts/bearing-verify.mjs` | 250 |
| `checkRuntimeCoversAgent` | Function | `scripts/bearing-verify.mjs` | 180 |
| `checkSkillsStore` | Function | `scripts/bearing-verify.mjs` | 272 |
| `checkZed` | Function | `scripts/bearing-verify.mjs` | 330 |
| `readRuntime` | Function | `scripts/bearing-verify.mjs` | 56 |
| `readStealth` | Function | `scripts/bearing-verify.mjs` | 43 |
| `blastRadius` | Function | `scripts/bearing-ci.mjs` | 100 |
| `collectDiff` | Function | `scripts/bearing-ci.mjs` | 69 |
| `detectChanges` | Function | `scripts/bearing-ci.mjs` | 83 |
| `num` | Function | `scripts/bearing-ci.mjs` | 86 |
| `git` | Function | `scripts/bearing-ci.mjs` | 40 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Run → DfMount` | cross_community | 5 |
| `Run → GetProjectTmpDir` | cross_community | 5 |
| `Run → ParseUsePct` | cross_community | 5 |
| `Run → IsEnospcError` | intra_community | 3 |
| `Main → Git` | intra_community | 3 |
| `Main → Num` | intra_community | 3 |
| `Main → Gn` | intra_community | 3 |
| `VerifyInstall → ReadStealth` | intra_community | 3 |

## How to Explore

1. `context({name: "verifyInstall"})` — see callers and callees
2. `query({search_query: "scripts"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
