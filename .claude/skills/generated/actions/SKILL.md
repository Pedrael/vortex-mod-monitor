---
name: actions
description: "Skill for the Actions area of vortex-mod-monitor. 61 symbols across 10 files."
---

# Actions

61 symbols | 10 files | Cohesion: 71%

## When to Use

- Working with code in `src/`
- Understanding how ToastProvider, applyModRules, createBuildPackageAction work
- Modifying actions-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/actions/installCollectionAction.ts` | runInstallFlow, renderResultDialog, formatResultText, formatInstalledModsBreakdown, formatRemovedModsBreakdown (+24) |
| `src/actions/buildPackageAction.ts` | createBuildPackageAction, promptCuratorMetadata, validateCuratorInput, resolveVortexVersion, resolveGameVersion (+10) |
| `src/ui/components/Toast.tsx` | ToastProvider, toastDedupKey, nodeToText |
| `src/core/installer/applyModRules.ts` | applyModRules, resolveReferenceToModId, refMatchesModId |
| `src/core/manifest/buildManifest.ts` | buildRules, buildRule, synthesizeRuleReference |
| `src/core/manifest/parseManifest.ts` | crossReferenceValidate, isFullyPinnedReference |
| `src/ui/pages/install/steps.tsx` | SuccessBody, countByKey |
| `src/core/comparePlugins.ts` | getLocalAppDataPath, getCurrentPluginsTxtPath |
| `src/ui/pages/build/buildSessionRegistry.ts` | get |
| `src/ui/pages/build/engine.ts` | readPluginsTxtIfPresent |

## Entry Points

Start here when exploring this area:

- **`ToastProvider`** (Function) — `src/ui/components/Toast.tsx:74`
- **`applyModRules`** (Function) — `src/core/installer/applyModRules.ts:127`
- **`createBuildPackageAction`** (Function) — `src/actions/buildPackageAction.ts:107`
- **`getCurrentPluginsTxtPath`** (Function) — `src/core/comparePlugins.ts:157`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ToastProvider` | Function | `src/ui/components/Toast.tsx` | 74 |
| `applyModRules` | Function | `src/core/installer/applyModRules.ts` | 127 |
| `createBuildPackageAction` | Function | `src/actions/buildPackageAction.ts` | 107 |
| `getCurrentPluginsTxtPath` | Function | `src/core/comparePlugins.ts` | 157 |
| `BundleResolutionError` | Class | `src/actions/buildPackageAction.ts` | 563 |
| `runInstallFlow` | Function | `src/actions/installCollectionAction.ts` | 1072 |
| `renderResultDialog` | Function | `src/actions/installCollectionAction.ts` | 1131 |
| `formatResultText` | Function | `src/actions/installCollectionAction.ts` | 1150 |
| `formatInstalledModsBreakdown` | Function | `src/actions/installCollectionAction.ts` | 1244 |
| `formatRemovedModsBreakdown` | Function | `src/actions/installCollectionAction.ts` | 1263 |
| `formatCarriedModsBreakdown` | Function | `src/actions/installCollectionAction.ts` | 1291 |
| `toastDedupKey` | Function | `src/ui/components/Toast.tsx` | 174 |
| `nodeToText` | Function | `src/ui/components/Toast.tsx` | 182 |
| `resolveReferenceToModId` | Function | `src/core/installer/applyModRules.ts` | 250 |
| `refMatchesModId` | Function | `src/core/installer/applyModRules.ts` | 286 |
| `crossReferenceValidate` | Function | `src/core/manifest/parseManifest.ts` | 1410 |
| `isFullyPinnedReference` | Function | `src/core/manifest/parseManifest.ts` | 1572 |
| `buildRules` | Function | `src/core/manifest/buildManifest.ts` | 506 |
| `buildRule` | Function | `src/core/manifest/buildManifest.ts` | 527 |
| `synthesizeRuleReference` | Function | `src/core/manifest/buildManifest.ts` | 566 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Take → Get` | cross_community | 5 |
| `ExecuteDecision → Get` | cross_community | 4 |
| `InstallManifestEntry → Get` | cross_community | 4 |
| `CreateBuildPackageAction → ValidateCuratorInput` | intra_community | 3 |
| `HandleUpdatePublished → Get` | cross_community | 3 |
| `HandleNewDraft → Get` | cross_community | 3 |
| `CreateComparePluginsAction → GetLocalAppDataPath` | cross_community | 3 |
| `PackageEhcoll → Get` | cross_community | 3 |
| `ToastProvider → NodeToText` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Resolver | 7 calls |
| Manifest | 6 calls |
| Build | 4 calls |
| Install | 2 calls |
| Installer | 1 calls |
| Cluster_11 | 1 calls |
| Cluster_8 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "ToastProvider"})` — see callers and callees
2. `gitnexus_query({query: "actions"})` — find related execution flows
3. Read key files listed above for implementation details
