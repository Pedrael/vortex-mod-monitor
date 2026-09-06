---
name: gitnexus-area-doctor
description: "Skill for the Doctor area of Event-Horizon. 21 symbols across 7 files."
---

# Doctor

21 symbols | 7 files | Cohesion: 84%

## When to Use

- Working with code in `src/`
- Understanding how describeHeal, rebuildPluginOrder, runHeal work
- Modifying doctor-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/doctor/gather.ts` | countModRules, gatherObservations, readEnabledModIds, readInstalledModIds, readProfileIds |
| `src/core/doctor/health.ts` | countCheck, detailList, evaluateHealth, orderMatches |
| `src/core/doctor/heal.ts` | describeHeal, rebuildPluginOrder, healNeedsManifest |
| `src/core/doctor/runHeal.ts` | healImpl, resolveModMaps, runHeal |
| `src/core/identity/compareKey.ts` | nexusModIdOfCompareKey, parseCompareKey |
| `src/ui/pages/doctor/DoctorPage.tsx` | heal, unavailableHeal |
| `src/core/doctor/health.test.ts` | drifted, healthy |

## Entry Points

Start here when exploring this area:

- **`describeHeal`** (Function) — `src/core/doctor/heal.ts:59`
- **`rebuildPluginOrder`** (Function) — `src/core/doctor/heal.ts:136`
- **`runHeal`** (Function) — `src/core/doctor/runHeal.ts:98`
- **`nexusModIdOfCompareKey`** (Function) — `src/core/identity/compareKey.ts:96`
- **`parseCompareKey`** (Function) — `src/core/identity/compareKey.ts:79`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `describeHeal` | Function | `src/core/doctor/heal.ts` | 59 |
| `rebuildPluginOrder` | Function | `src/core/doctor/heal.ts` | 136 |
| `runHeal` | Function | `src/core/doctor/runHeal.ts` | 98 |
| `nexusModIdOfCompareKey` | Function | `src/core/identity/compareKey.ts` | 96 |
| `parseCompareKey` | Function | `src/core/identity/compareKey.ts` | 79 |
| `heal` | Function | `src/ui/pages/doctor/DoctorPage.tsx` | 263 |
| `gatherObservations` | Function | `src/core/doctor/gather.ts` | 108 |
| `evaluateHealth` | Function | `src/core/doctor/health.ts` | 157 |
| `healNeedsManifest` | Function | `src/core/doctor/heal.ts` | 39 |
| `unavailableHeal` | Function | `src/ui/pages/doctor/DoctorPage.tsx` | 430 |
| `healImpl` | Function | `src/core/doctor/runHeal.ts` | 133 |
| `resolveModMaps` | Function | `src/core/doctor/runHeal.ts` | 60 |
| `countModRules` | Function | `src/core/doctor/gather.ts` | 70 |
| `readEnabledModIds` | Function | `src/core/doctor/gather.ts` | 53 |
| `readInstalledModIds` | Function | `src/core/doctor/gather.ts` | 37 |
| `readProfileIds` | Function | `src/core/doctor/gather.ts` | 25 |
| `countCheck` | Function | `src/core/doctor/health.ts` | 384 |
| `detailList` | Function | `src/core/doctor/health.ts` | 126 |
| `orderMatches` | Function | `src/core/doctor/health.ts` | 141 |
| `drifted` | Function | `src/core/doctor/health.test.ts` | 241 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `GatherObservations → GetVortexUserDataPath` | cross_community | 8 |
| `Heal → EHRuntime` | cross_community | 6 |
| `Heal → Notify` | cross_community | 6 |
| `Heal → GetSnapshot` | cross_community | 5 |
| `Heal → WizardReducer` | cross_community | 4 |
| `GatherObservations → Truncate` | cross_community | 4 |

## How to Explore

1. `context({name: "describeHeal"})` — see callers and callees
2. `query({search_query: "doctor"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
