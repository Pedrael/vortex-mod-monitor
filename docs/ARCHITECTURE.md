# Architecture

A small TypeScript extension organized as **entry → actions → core → utils**. No global state of its own; reads everything from Vortex's Redux state via `vortex-api`'s `selectors`.

## File layout

```
src/
├── index.ts                              # Vortex entry — registers 3 toolbar actions
├── actions/
│   ├── exportModsAction.ts               # Action handler: snapshot mods → JSON
│   ├── compareModsAction.ts              # Action handler: diff current vs reference JSON
│   └── comparePluginsAction.ts           # Action handler: diff plugins.txt vs reference
├── core/
│   ├── getModsListForProfile.ts          # Selectors + AuditorMod normalization (FOMOD, rules, fileOverrides, installOrder)
│   ├── archiveHashing.ts                 # Streaming SHA-256 + archive-path resolver + bulk enricher
│   ├── deploymentManifest.ts             # Per-modtype Vortex deployment manifest capture
│   ├── loadOrder.ts                      # Vortex LoadOrder API capture (per-game)
│   ├── exportMods.ts                     # exportModsToJsonFile — writes snapshot
│   ├── comparePlugins.ts                 # plugins.txt parser + diff + writer
│   └── manifest/
│       ├── buildManifest.ts              # Pure ExportedModsSnapshot → EhcollManifest converter (Phase 2)
│       ├── packageZip.ts                 # EhcollManifest + bundled archives → .ehcoll ZIP packager (Phase 2)
│       └── sevenZip.ts                   # Typed shim over vortex-api's util.SevenZip (node-7z)
├── types/
│   └── ehcoll.ts                         # .ehcoll manifest type schema (Phase 2 contract; type-only, no runtime)
├── utils/
│   └── utils.ts                          # File pickers, openFile/openFolder, mod diff engine
└── scripts/
    └── deploy-to-vortex.js               # Copies dist/ into Vortex plugins folder
```

The compiled output lives in `dist/`; `index.js` at the repo root is the loader Vortex sees, which simply re-exports `./dist`.

## Layer responsibilities

### Entry — `src/index.ts`
- Implements Vortex's `init(context: types.IExtensionContext): boolean`.
- Constructs three handler closures and binds them to toolbar actions via `context.registerAction("global-icons", priority, ...)`.
- All three actions are fire-and-forget (`void handler()`); errors are caught inside the handler and surfaced via `context.api.sendNotification`.

### Actions — `src/actions/*`
Each action follows the same shape:

1. Read state with `context.api.getState()`.
2. Resolve `gameId` (and for mod actions, `profileId`); throw if missing.
3. Read user input via an electron file picker (or skip — this is the export case).
4. Call into `core/` to do real work.
5. Compute output dir as `util.getVortexPath("appData") + "event-horizon/<subdir>"`.
6. `console.log` a one-line summary, then `sendNotification` with **Open Diff** / **Open Folder** actions wired through `openFile` / `openFolder`.
7. On error: notification + `console.error`.

This means the actions are **purely orchestration** — no business logic.

### Core — `src/core/*`

`getModsListForProfile.ts`
- `getActiveGameId(state)` — wraps `selectors.activeGameId`, returns `undefined` for empty.
- `getActiveProfileIdFromState(state, gameId)` — finds the active profile for a game; falls back to any profile for that game.
- `getModsForProfile(state, gameId, profileId)` — the workhorse. Walks `state.persistent.mods[gameId]`, joins with `state.persistent.profiles[profileId].modState`, and produces an array of `AuditorMod`.
- Internal normalizers worth knowing:
  - `pickInstallerChoices(attributes)` — tries a long list of attribute keys (`installerChoices`, `installerChoicesData`, `fomodChoices`, `fomod`, `choices`, `installChoices`, `installerOptions`) because Vortex/installers store this inconsistently.
  - `normalizeFomodSelections(installerChoices)` — converts whatever shape `pickInstallerChoices` returned into the canonical `FomodSelectionStep[]` (step → groups → choices).
  - `normalizeCollectionIds(value)` — coerces scalar/array/missing into `string[]`.
  - `hasAnySelectedFomodChoices(steps)` — boolean for whether the FOMOD tree actually contains anything.
  - `normalizeRuleReference(reference)` / `normalizeModRules(rules)` — flatten Vortex's `IModRule[]` into `CapturedModRule[]` and sort canonically. See [`docs/business/MOD_RULES_CAPTURE.md`](business/MOD_RULES_CAPTURE.md).
  - `normalizeStringArray(value)` — defensive dedupe + alphabetical sort, used for `fileOverrides` and `enabledINITweaks`. See [`docs/business/FILE_OVERRIDES_CAPTURE.md`](business/FILE_OVERRIDES_CAPTURE.md).
  - `normalizeInstallTime(raw)` — coerces `Date | string | number` to a canonical ISO-8601 UTC string, returns `undefined` for unparseable input. See [`docs/business/ORDERING.md`](business/ORDERING.md).
  - `assignInstallOrder(mods)` — second pass that mutates each mod's `installOrder` to a deterministic 0-indexed ordinal sorted by `installTime` then `id`.

`deploymentManifest.ts`
- `collectDistinctModTypes(state, gameId)` — walks `state.persistent.mods[gameId]` and returns the set of distinct `mod.type` strings (always includes `""` for the default modtype).
- `captureDeploymentManifests(api, state, gameId)` — for each modtype, calls `util.getManifest(api, modType, gameId)` and normalizes the result into a `CapturedDeploymentManifest` (absolute paths and Vortex instance UUIDs stripped). Per-modtype failures are swallowed with a `console.warn` so partial capture beats no capture. **INVARIANT**: never throws.

`loadOrder.ts`
- `captureLoadOrder(state, gameId)` — flattens `state.persistent.loadOrder[gameId]` into a sorted `CapturedLoadOrderEntry[]` (drops `prefix` and `data`, keeps `modId`/`pos`/`enabled`/`locked`/`external`). Synchronous, defensive, never throws. Returns `[]` for games that don't use Vortex's LoadOrder API.

`exportMods.ts`
- Pure I/O. `exportModsToJsonFile` ensures the output dir exists, builds a wrapper object (`exportedAt`, `gameId`, `profileId`, `count`, `mods`, optionally `deploymentManifests`, optionally `loadOrder`), and writes pretty-printed JSON. Both optional fields are omitted from the JSON entirely when `undefined`, preserving older-format compatibility.

`archiveHashing.ts`
- `hashFileSha256(path)` — streaming SHA-256 (low memory; archives can be hundreds of MB).
- `getModArchivePath(state, archiveId, gameId)` — resolves a mod's source archive on disk via `selectors.downloadPathForGame` + the `IDownload.localPath` field on `state.persistent.downloads.files[archiveId]`.
- `enrichModsWithArchiveHashes(state, gameId, mods, options)` — bulk-hashes archives with bounded concurrency (default 4). Mods without a resolvable archive pass through unchanged; per-mod failures don't abort the batch. Called by `exportModsAction` after `getModsForProfile`.

`comparePlugins.ts`
- `parsePluginsTxt(content)` — splits lines, drops comments/blanks, peels the `*` enabled-prefix, normalizes name (trim + lowercase) for matching.
- `comparePluginsEntries({...})` — builds two maps keyed by `normalizedName`, walks both to fill `onlyInReference`, `onlyInCurrent`, `enabledMismatch`, `positionChanged`.
- `getCurrentPluginsTxtPath(gameId)` — joins `%LOCALAPPDATA%` + the per-game folder name.
- `comparePluginsTxtFiles({...})` — async wrapper that reads both files and calls the diff.
- `exportPluginsDiffReport({...})` — writes the diff JSON.

`manifest/buildManifest.ts`
- `buildManifest(input)` — pure transform from `ExportedModsSnapshot` (+ curator-supplied package/game/vortex metadata, optional `plugins.txt` content, optional per-mod external-mod overrides) into a fully-typed `EhcollManifest`. No I/O, no state access — testable with hand-rolled fixtures.
- Identity: emits `compareKey="nexus:<modId>:<fileId>"` for Nexus-sourced mods, `compareKey="external:<sha256>"` for everything else. Refuses to build when any mod lacks `archiveSha256` (fail-fast at packaging time, not at install time on a user's machine).
- Validation: collects fatal problems (unsupported gameId, missing hashes, duplicate compareKeys) and throws a single `BuildManifestError` carrying the full list. Non-fatal issues (rules referencing unknown mods, deployment entries whose source mod isn't in the snapshot) come back as `result.warnings`.
- Hardcoded `NEXUS_GAME_DOMAIN_BY_GAME_ID` table maps Vortex gameIds to Nexus URL domains (e.g. `skyrimse → skyrimspecialedition`, `falloutnv → newvegas`) because `AuditorMod` doesn't currently capture the per-mod domain.
- v1 simplifications: `losingMods: []` on every file override (Vortex's deployment manifest doesn't record losers), `iniTweaks: []` (Phase 5), `archiveName` falls back to `mod.name` when no real filename is supplied (slice 4 will pass real filenames in).
- Full prose contract: [`docs/business/BUILD_MANIFEST.md`](business/BUILD_MANIFEST.md).

`manifest/packageZip.ts`
- `packageEhcoll(input)` — takes one `EhcollManifest` plus a list of bundled archive specs (`{ sourcePath, sha256 }`), stages everything in a temp directory, and runs 7z to produce one `.ehcoll` file. Returns `{ outputPath, outputBytes, bundledCount, warnings }`.
- ZIP format (forced via `-tzip`), not 7z native — bundled archives are already compressed, ZIP wins on tooling compatibility for debugging.
- Bundled archives are hardlinked into staging where possible (free, instant) with `fs.copyFile` fallback on EXDEV/EPERM. 7z reads them off disk directly; Node never holds bundled bytes in memory.
- Validation is fail-fast and exhaustive — every detectable problem (sha256 format violations, manifest/archives mismatch, non-absolute paths, etc.) goes into one `PackageEhcollError`.
- **Identity is `(package.id, package.version)`, not byte-equal builds.** The only stable-bytes concession kept is `manifest.json` key sorting via `sortDeep`, purely for `unzip + diff` debuggability.
- Optional `verifyHashes` re-streams every bundled archive through SHA-256 before staging — slow on big archives but catches "curator's archive cache changed since snapshot export."
- Staging directory is `rm -rf`'d in `finally`, so partial output never leaks into the temp dir.
- Full prose contract: [`docs/business/PACKAGE_ZIP.md`](business/PACKAGE_ZIP.md).

`manifest/sevenZip.ts`
- Narrow typed wrapper around `vortex-api`'s `util.SevenZip` (re-export of `node-7z`'s default). Defines `SevenZipApi`, `SevenZipStream`, `SevenZipAddOptions` for our exact callsites — the messy `as unknown as` cast is contained here so the rest of the codebase consumes a clean typed surface and tests can inject a fake.
- `node-7z` ships no usable types and `@types/node-7z` is not in our deps; this file is the workaround. If `vortex-api` ever exposes proper types it collapses to a re-export.

### Types — `src/types/*`

Pure TypeScript type declarations. No runtime code lives here — adding any would change the dependency graph for files that should only depend on contracts.

`ehcoll.ts`
- The `.ehcoll` package manifest schema (v1). Defines `EhcollManifest` and every nested shape: `PackageMetadata`, `GameMetadata`, `VortexMetadata`, the `EhcollMod` discriminated union (`NexusEhcollMod` / `ExternalEhcollMod`), `EhcollRule`, `EhcollFileOverride` (curator-deployment outcome side), `EhcollPlugins`, `EhcollIniTweak` (Phase 5 placeholder), `EhcollExternalDependency`.
- Imports `FomodSelectionStep` from `core/getModsListForProfile` so the manifest's installer spec is byte-compatible with what `AuditorMod` already captures.
- Full prose contract: [`docs/business/MANIFEST_SCHEMA.md`](business/MANIFEST_SCHEMA.md).

### Utils — `src/utils/utils.ts`
A grab-bag, but mostly stable surfaces:

- **Shell**: `openFolder(path)`, `openFile(path)` — both shell out to `start "" "<path>"` (Windows-only).
- **Pickers**: `pickJsonFile()`, `pickTxtFile()` — wrap `electron.dialog.showOpenDialog`.
- **Mod diff engine**:
  - `getModCompareKey(mod)` — identity priority: `nexus:{modId}:{fileId}` → `archive:{archiveId}` → `id:{id}`. Stable across reinstalls when Nexus IDs are present.
  - `sortDeep(value)` / `deepEqualStable(a, b)` — order-insensitive deep equality via canonicalized JSON.
  - `compareMods(ref, cur)` — produces `ModFieldDifference[]` for a fixed list of fields.
  - `compareSnapshots(ref, cur)` — full report: `onlyInReference`, `onlyInCurrent`, `changed`.
  - `exportDiffReport({...})` — writes the diff JSON.
- **Misc**: `findInObject(obj, predicate)` — debugging helper, not currently called from production paths.

## Execution flows (top-level)

GitNexus identifies 18 flows; the three user-facing entry points map to:

**Export Mods**
```
init → exportModsAction()
   → getActiveGameId, getActiveProfileIdFromState
   → getModsForProfile
        → pickInstallerChoices, normalizeFomodSelections,
          normalizeCollectionIds, hasAnySelectedFomodChoices,
          normalizeModRules → normalizeRuleReference,
          normalizeStringArray (×2 — fileOverrides, enabledINITweaks),
          normalizeInstallTime (per mod)
        → assignInstallOrder (single pass after walk)
   → enrichModsWithArchiveHashes (concurrency-bounded SHA-256)
   → captureDeploymentManifests
        → collectDistinctModTypes → util.getManifest (per modtype)
   → captureLoadOrder
   → exportModsToJsonFile
   → sendNotification(Open Diff/Folder)
```

**Compare Mods**
```
init → compareModsAction()
   → pickJsonFile → fs.readFile + JSON.parse  (referenceSnapshot)
   → getModsForProfile                         (currentSnapshot)
   → compareSnapshots
        → buildModsMap (uses getModCompareKey)
        → compareMods → deepEqualStable → sortDeep
   → exportDiffReport
   → sendNotification
```

**Compare Plugins**
```
init → comparePluginsAction()
   → pickTxtFile
   → getCurrentPluginsTxtPath (uses getLocalAppDataPath)
   → comparePluginsTxtFiles
        → parsePluginsTxt (uses normalizePluginName)
        → comparePluginsEntries (uses toPluginMap)
   → exportPluginsDiffReport
   → sendNotification
```

## Design notes & quirks

- **Two actions register at priority `101`** (`Compare Current Mods With JSON` and `Compare Plugins With TXT`). Vortex tolerates this but the relative order isn't guaranteed; consider giving them distinct priorities (e.g., `101`, `102`).
- **Project rebranded to Event Horizon** (2026-04-26): the npm package is `vortex-event-horizon`, the Vortex extension name is `Event Horizon`, the AppData folder is `event-horizon/`, log prefixes are `[Vortex Event Horizon]`, and the upcoming standalone collection package format uses the `.ehcoll` extension. The previous `mod-monitor` / `mod-auditor` / `[Vortex Mod Monitor]` identifiers are gone. See [`docs/PROPOSAL_INSTALLER.md`](PROPOSAL_INSTALLER.md) for the metaphor (Vortex is the black hole; we capture state at the boundary).
- **`index.ts` exports `default init`**. After tsc, `index.js` (`module.exports = require('./dist')`) yields `{ default: init, __esModule: true }`. Vortex's loader is generally lenient, but if you ever see "extension didn't load," that's the first thing to check — flip to `module.exports = init` or `export = init`.
- **Windows-only assumptions**: `openFolder` / `openFile` use `start`, and `getCurrentPluginsTxtPath` reads `%LOCALAPPDATA%`. Vortex itself runs on Windows primarily, so this is acceptable for now.
- **No tests** and no linter config. Adding a small Jest setup around `core/comparePlugins.ts` and the diff engine in `utils.ts` would catch regressions cheaply — those modules are pure.
