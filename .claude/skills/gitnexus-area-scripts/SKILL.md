---
name: gitnexus-area-scripts
description: "Skill for the Scripts area of vortex-mod-monitor. 53 symbols across 6 files."
---

# Scripts

53 symbols | 6 files | Cohesion: 91%

## When to Use

- Working with code in `scripts/`
- Understanding how verifyInstall, answered, isEnospcError work
- Modifying scripts-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `scripts/bearing-verify.mjs` | checkFile, checkHookExecutable, checkHooksJson, checkManifest, checkModuleDelivery (+16) |
| `scripts/bearing-ci.mjs` | blastRadius, collectDiff, detectChanges, num, git (+7) |
| `scripts/bearing-token-benchmark.mjs` | answered, classicalCost, cypher, gn, graphCost (+2) |
| `scripts/bearing-agent.mjs` | loadStaleness, markRefreshOutcome, run, runAllowFail, currentBranch (+2) |
| `scripts/package-extension.js` | buildZip, crc32, collect, walk |
| `scripts/lib/project-tmp.mjs` | isEnospcError, withProjectTmpEnv |

## Entry Points

Start here when exploring this area:

- **`verifyInstall`** (Function) — `scripts/bearing-verify.mjs:395`
- **`answered`** (Function) — `scripts/bearing-token-benchmark.mjs:163`
- **`isEnospcError`** (Function) — `scripts/lib/project-tmp.mjs:95`
- **`withProjectTmpEnv`** (Function) — `scripts/lib/project-tmp.mjs:25`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `verifyInstall` | Function | `scripts/bearing-verify.mjs` | 395 |
| `answered` | Function | `scripts/bearing-token-benchmark.mjs` | 163 |
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
| `blastRadius` | Function | `scripts/bearing-ci.mjs` | 105 |
| `collectDiff` | Function | `scripts/bearing-ci.mjs` | 74 |
| `detectChanges` | Function | `scripts/bearing-ci.mjs` | 88 |
| `num` | Function | `scripts/bearing-ci.mjs` | 91 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Main → Git` | intra_community | 3 |
| `Main → Num` | intra_community | 3 |
| `Main → Gn` | intra_community | 3 |
| `VerifyInstall → ReadStealth` | intra_community | 3 |

## How to Explore

1. `context({name: "verifyInstall"})` — see callers and callees
2. `query({search_query: "scripts"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
