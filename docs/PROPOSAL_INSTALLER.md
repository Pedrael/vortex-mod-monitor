# Proposal — Standalone Vortex Collection Installer

**Status**: DRAFT — pending review
**Owner**: TBD
**Last updated**: 2026-04-26

---

## 1. Motivation

Vortex's built-in collection installer is unreliable: rules drop randomly, FOMOD selections get lost, file overrides differ between machines, and external dependencies are barely supported. The result is the well-known "works on the curator's machine, breaks on every user's machine" tax that eats hours of every release.

This proposal describes a **standalone collection installer** that ships as part of this extension and runs **completely independently of Vortex's vanilla collection system**. We do not modify, replace, or hook into vanilla collections — we coexist.

The installer is built **on top of `vortex-api`'s low-level primitives** (FOMOD installer, hardlink deployment, Redux state actions). We do not reimplement deployment or installer logic. Anything Vortex already does well, we delegate to.

---

## 2. Goals & non-goals

### Goals

- **Bit-identical reproduction** of the curator's working profile on the user's machine, where "identical" means: same archive bytes (verified by SHA-256), same FOMOD choices, same mod rules, same file-override winners, same plugin order/state, same INI tweaks.
- **Single-file distribution**: a `.vmcoll` package the curator publishes anywhere (Nexus as a "mod", direct download, Discord, file share). No registry, no auth on our side.
- **Faithful Nexus integration**: every Nexus mod is auto-downloaded via Vortex's existing Nexus integration and the user's API key.
- **First-class external mods**: any mod *not* on Nexus (hidden, removed, off-Nexus, curator-private) is handled by prompting the user to supply a local archive, which we then run through the same Vortex install pipeline.
- **Post-install reconciliation**: after install, automatically diff against the curator's snapshot and surface drift in detail.
- **Reuse everything possible** from this extension's existing snapshot/diff code.

### Non-goals (v1)

- Replacing or modifying Vortex's built-in collection system.
- Building a hosting service, registry, or sync server.
- Cross-platform support — Windows-only, like Vortex itself.
- Non-Creation-Engine games. Supported list locked at: `skyrimse`, `fallout3`, `falloutnv`, `fallout4`, `starfield`.
- Custom mod sources beyond Nexus + local archive (no GitHub/LoversLab/Discord URL fetching in v1).
- Editing manifests in-place after install (a fresh install is the unit of work).

---

## 3. Supported games

| `gameId` | Display name | `%LOCALAPPDATA%` folder | Plugin file | Notes |
|---|---|---|---|---|
| `skyrimse` | Skyrim SE / AE | `Skyrim Special Edition` | `plugins.txt` | Already mapped in `comparePlugins.ts` |
| `fallout3` | Fallout 3 | `Fallout3` | `plugins.txt` | |
| `falloutnv` | Fallout: New Vegas | `FalloutNV` | `plugins.txt` | |
| `fallout4` | Fallout 4 | `Fallout4` | `plugins.txt` | Already mapped |
| `starfield` | Starfield | `Starfield` | `Plugins.txt` | **VERIFY**: Bethesda has changed Starfield's plugin handling several times; confirm path + casing + leading-`*` semantics on current build |

Game-version pinning is captured in the manifest (`game.version`) and the installer refuses to proceed if the user's installed version differs, unless the user passes a `--force` toggle.

---

## 4. Architecture

```
                ┌────────────────────────────────────────────┐
                │              CURATOR SIDE                  │
                │                                            │
                │   ┌──────────────────────────────────┐     │
                │   │ existing snapshot (mods,         │     │
                │   │ FOMOD choices, plugins.txt)      │     │
                │   └────────────────┬─────────────────┘     │
                │                    │                       │
                │                    ▼                       │
                │   ┌──────────────────────────────────┐     │
                │   │ extended capture: rules,         │     │
                │   │ file overrides, INI tweaks,      │     │
                │   │ archive hashes, external deps    │     │
                │   └────────────────┬─────────────────┘     │
                │                    │                       │
                │                    ▼                       │
                │   ┌──────────────────────────────────┐     │
                │   │  packager → manifest.json + zip  │     │
                │   │            → out.vmcoll          │     │
                │   └──────────────────────────────────┘     │
                └────────────────────────────────────────────┘
                                   │
                  user downloads   │   .vmcoll
                                   ▼
                ┌────────────────────────────────────────────┐
                │                USER SIDE                   │
                │                                            │
                │   ┌──────────────────────────────────┐     │
                │   │ preflight: game id + version,    │     │
                │   │ free disk, Vortex deploy method, │     │
                │   │ Nexus API key present, LOOT      │     │
                │   │ extension enabled                │     │
                │   └────────────────┬─────────────────┘     │
                │                    ▼                       │
                │   ┌──────────────────────────────────┐     │
                │   │ resolver:                        │     │
                │   │  - Nexus: download via vortex    │     │
                │   │    Nexus integration             │     │
                │   │  - external: prompt user for     │     │
                │   │    archive, hash-verify          │     │
                │   │  - hidden/removed Nexus: bundle  │     │
                │   │    fallback OR skip+warn         │     │
                │   └────────────────┬─────────────────┘     │
                │                    ▼                       │
                │   ┌──────────────────────────────────┐     │
                │   │ installer (driven via vortex-api │     │
                │   │ events/actions):                 │     │
                │   │  - install each archive WITH     │     │
                │   │    saved FOMOD choices           │     │
                │   │  - apply mod rules               │     │
                │   │  - apply file overrides          │     │
                │   │  - set enabled state             │     │
                │   │  - apply INI tweaks              │     │
                │   │  - write plugins.txt order       │     │
                │   │  - trigger deployment            │     │
                │   └────────────────┬─────────────────┘     │
                │                    ▼                       │
                │   ┌──────────────────────────────────┐     │
                │   │ reconciler: re-snapshot + diff   │     │
                │   │ vs. curator snapshot, surface    │     │
                │   │ drift report                     │     │
                │   └──────────────────────────────────┘     │
                └────────────────────────────────────────────┘
```

The pipeline is deliberately **linear with explicit checkpoints**. After each phase, state is persisted, so a crash or quit lets the user resume without re-downloading.

---

## 5. The `.vmcoll` package

### 5.1 Format

A standard ZIP archive with the extension `.vmcoll` (just a hint — content-sniffed by header anyway).

```
my-collection.vmcoll
├── manifest.json                # the source of truth (see §6)
├── README.md                    # optional, shown to user before install
├── CHANGELOG.md                 # optional
├── bundled/                     # optional — only when curator opted to bundle
│   ├── <sha256>.7z
│   └── <sha256>.7z
└── ini-tweaks/                  # optional — original INI fragments
    └── <key>.ini
```

The `bundled/` folder is keyed by archive SHA-256 (not filename) to deduplicate and to make integrity checks trivial.

### 5.2 Why ZIP and not 7z

ZIP is supported by Node's `node:zlib` + a pure-JS layer (`yauzl`/`adm-zip`) without native binaries. We avoid pulling in a native 7z dependency just to read our own format. Mod archives **inside** can still be 7z — Vortex already handles those.

---

## 5.5 Mod identity rules (LOAD-BEARING)

This is the single most-violated rule in Vortex's vanilla collections, and the
single most important reason ours will be reliable. **Read carefully.**

### The rule

The identity of every mod in a `.vmcoll` package is determined by the
`source.kind` field, in the following way:

| `source.kind` | Identity (cross-machine portable) | Verified by |
|---|---|---|
| `"nexus"` | `(gameDomain, modId, fileId)` | After download: `sha256` MUST match. Mismatch ⇒ Nexus served different bytes ⇒ HARD FAIL. |
| `"external"` | `sha256` of the archive itself | User-supplied archive: `sha256` MUST match. Mismatch ⇒ wrong file ⇒ re-prompt up to 3× then HARD FAIL or skip. |

There is no third tier. There is no "name + version" fallback. There is no
"trust the user it's the right file" mode. **A mod whose archive bytes do
not produce the expected SHA-256 is, by definition, a different mod**, and
the installer treats it as missing.

### Why this matters more than anything else

Vortex's vanilla collections identify mods by Nexus IDs only. For mods not
on Nexus (off-Nexus, hidden, removed, curator-private, LoversLab-only,
patch packs distributed via Discord, etc.) Vortex effectively has no way
to know what archive the user actually supplied. Curators ship "external
dependency: download SKSE manually" instructions and **hope**. Users
download the wrong version, install it, the collection breaks in subtle
ways three hours later, and the curator gets blamed.

We replace "hope" with a hash check. Every external mod the curator ships
in the manifest carries the SHA-256 of the exact bytes the curator built
against. The user-side resolver picks the file the user supplies (or pulls
from `bundled/`), streams it through SHA-256, and refuses to install
anything that doesn't match.

### Implications across the pipeline

- **Curator-side capture**: the `archiveSha256` field on `AuditorMod`
  (already implemented in Phase 1 slice 1) is the source of truth for both
  the curator's drift detection AND the installer's identity. Same field,
  two consumers.
- **`bundled/` folder layout**: archives are keyed by SHA-256
  (`bundled/<sha256>.7z`), never by filename. Two mods whose archives are
  byte-identical are stored once and resolved twice.
- **Nexus `source.sha256` is mandatory, not optional**: even though Nexus
  IDs are sufficient to *download*, the SHA-256 is what we *verify* after.
  If it ever doesn't match, we surface that as a curator-must-republish
  problem, not as "ah well, close enough".
- **Diff vs. install identity**: the snapshot-diff `compareKey` (see
  [`docs/business/AUDITOR_MOD.md`](business/AUDITOR_MOD.md#mod-identity--comparekey))
  uses Vortex internal id as a third-tier fallback because both sides of a
  diff exist in Vortex. The installer cannot use that fallback because the
  user's Vortex has nothing yet — there's no internal id to fall back to.
  `archiveSha256` is the bridge.
- **Naming is metadata only**: the `name`, `version`, `archiveName` fields
  on each mod entry are for UI display and curator-side debugging.
  Changing them does NOT change identity. The user-side installer reads
  them but never matches on them.

### Edge case: the curator updates an external mod's archive

If the curator replaces one of their external archives between v1.0 and
v1.1 of a `.vmcoll`, the SHA-256 changes. From the manifest's perspective
this is a different mod. The curator must:
- bump the package version,
- re-publish the new SHA in `manifest.json`,
- (optionally) re-bundle the new archive.

Users on v1.0 keep working; users installing v1.1 get the new archive.
There is no in-place upgrade path in v1 (see §14 out-of-scope).

---

## 6. Manifest schema (v1)

TypeScript source of truth lives in `src/types/vmcoll.ts` (to be created). JSON shape:

```jsonc
{
  "schemaVersion": 1,
  "package": {
    "id": "uuid-v4",                         // stable across re-exports of same collection
    "name": "My Collection",
    "version": "1.4.2",                      // semver
    "author": "BubuZefirka",
    "createdAt": "2026-04-26T18:00:00.000Z",
    "description": "...",
    "strictMissingMods": false               // §11.3 — skip+warn vs. hard fail
  },

  "game": {
    "id": "skyrimse",                        // one of §3
    "version": "1.6.640",                    // exact version curator built on
    "versionPolicy": "exact" | "minimum"     // strict pin vs. "≥ this"
  },

  "vortex": {
    "version": "1.13.0",                     // version curator used (warn-only on mismatch)
    "deploymentMethod": "hardlink",          // hardlink | symlink | copy — informational
    "requiredExtensions": [                  // refuse-to-install if missing/disabled
      { "id": "loot-functionality", "minVersion": "..." }
    ]
  },

  "mods": [
    {
      "compareKey": "nexus:1234:567890",     // same scheme as §6 of DATA_FORMATS.md
      "name": "SkyUI",
      "version": "5.2SE",
      "source": {
        "kind": "nexus",
        "gameDomain": "skyrimspecialedition",
        "modId": 1234,
        "fileId": 567890,
        "archiveName": "SkyUI_5_2_SE-12345-5-2SE-1234567890.7z",
        "sha256": "abc123…"                  // the curator's archive
      },
      "install": {
        "fomodSelections": [ /* §1 of DATA_FORMATS.md */ ],
        "installerType": "fomod"
      },
      "state": {
        "enabled": true,
        "installOrder": 14,                  // ordinal — used to sequence rule application
        "deploymentPriority": 14             // for override resolution
      },
      "attributes": {                        // optional — for UI display only
        "category": "Interface",
        "description": "..."
      }
    },
    {
      "compareKey": "external:my-private-fix-1.0",
      "name": "My Private Fix",
      "version": "1.0",
      "source": {
        "kind": "external",
        "expectedFilename": "MyPrivateFix-1.0.7z",
        "sha256": "def456…",
        "instructions": "Download from <internal share URL> or DM curator.",
        "bundled": false                     // true → archive is in /bundled/<sha256>.7z
      },
      "install": { "fomodSelections": [], "installerType": "raw" },
      "state": { "enabled": true, "installOrder": 27, "deploymentPriority": 27 }
    }
  ],

  "rules": [
    {
      "source": "nexus:1234:567890",         // refers to compareKey
      "type": "after",                       // before | after | conflicts | requires | recommends | provides
      "reference": "nexus:9999:111",         // either compareKey or nexus:modId for unspecified-file refs
      "comment": "skyui must come after the patch"
    }
  ],

  "fileOverrides": [
    {
      "filePath": "Data\\meshes\\example.nif",
      "winningMod": "nexus:1234:567890",     // compareKey of the mod that wins this file
      "losingMods": ["nexus:1111:222", "nexus:3333:444"]
    }
  ],

  "plugins": {
    "order": [                               // exact plugins.txt order
      { "name": "Skyrim.esm",   "enabled": true },
      { "name": "Update.esm",   "enabled": true },
      { "name": "MyMod.esp",    "enabled": true }
    ]
  },

  "iniTweaks": [
    {
      "ini": "Skyrim.ini",                   // logical id, mapped per-game
      "section": "Display",
      "key": "fGamma",
      "value": "1.0000"
    }
  ],

  "externalDependencies": [
    {
      "id": "skse64",
      "name": "Skyrim Script Extender",
      "category": "script-extender",
      "version": "2.2.6",
      "destination": "<gameDir>",            // tokenized — resolved on user side
      "files": [
        { "relPath": "skse64_loader.exe",  "sha256": "…" },
        { "relPath": "skse64_1_5_97.dll",  "sha256": "…" }
      ],
      "instructionsUrl": "https://skse.silverlock.org/",
      "instructions": "Download SKSE 2.2.6 'Current SE build', extract loader+dll+steam_loader.dll into the Skyrim install folder."
    }
  ]
}
```

### Notes on schema

- `compareKey` aligns with the existing `getModCompareKey` so all current diff/reconcile code works unchanged.
- `rules.reference` accepts both fully-pinned (`nexus:modId:fileId`) and partially-pinned (`nexus:modId`) references; the latter matches any version the user has of that Nexus mod.
- `installOrder` and `deploymentPriority` are separate because Vortex's rule engine and deployment engine consume them differently. Most of the time they'll be equal.
- `iniTweaks.ini` is a **logical** key; per-game mapping (e.g. `"Skyrim.ini"` → `Documents/My Games/Skyrim Special Edition/Skyrim.ini`) lives in the installer.

---

## 7. `vortex-api` surfaces we depend on

> Verified against `vortex-api@2.0.0-beta.1` (types-only package — runtime functions are provided by Vortex when our extension loads). License is GPL-3.0 on the types but, since they're stripped at compile time, **our extension can ship under any license** (MIT proposed).

All key symbols below have been **confirmed** in `node_modules/vortex-api/lib/api.d.ts` during the Phase 0.5 spike. Line numbers are for cross-reference.

### 7.1 Critical install primitives — all confirmed

| Capability | Symbol | API d.ts line |
|---|---|---|
| **FOMOD installer signature** accepts `choices` + `unattended` | `InstallFunc = (files, dest, gameId, progressDelegate, choices?: any, unattended?: boolean, archivePath?, options?) => PromiseLike<IInstallResult>` | 5486 |
| **Nexus download + auto-install in one call** | `api.nexusDownload(gameId, modId, fileId, fileName?, allowInstall?: boolean): PromiseLike<string>` | 5240 |
| **Generic URL download** (handles `file:///` for local archives) | `api.startDownload(urls: string[], modInfo, fileName, redownload?, options?: { allowInstall?: boolean \| 'force' }): Promise<IDownloadResult>` | 2956, 6065 |
| **Awaitable deployment** | `api.awaitModsDeployment(profileId?, progressCB?, deployOptions?): Promise<void>` | 5175 |
| **Mod rules carry installerChoices** | `IModRule.installerChoices?: any` | 5165 |
| **Set mod enabled** | `actions.setModEnabled(profileId, modId, enabled)` | 8178 |
| **Add mod rule** | `actions.addModRule(gameId, modId, rule)` | 383 |
| **Set file override** | `actions.setFileOverride(gameId, modId, files[])` | 8043 |
| **Show modal dialog** | `api.showDialog(type, title, content, actions, id?): Promise<IDialogResult>` | 3093 |

### 7.2 General context — confirmed

| Capability | Symbol | API d.ts line |
|---|---|---|
| Read state | `api.getState()` / `api.store.getState()` | 3148 |
| Active game id | `selectors.activeGameId(state)` | (selectors module) |
| Vortex paths | `util.getVortexPath('appData' \| 'userData' \| 'temp' \| 'download')` | (util module) |
| Send notification | `api.sendNotification(notification)` | 3081 |
| Show error notification | `api.showErrorNotification(message, detail, options?)` | 3089 |
| **Native file picker** (replaces our electron-direct pickers) | `api.selectFile(options): Promise<string>` | 3116 |
| Native folder picker | `api.selectDir(options): Promise<string>` | 3134 |
| Register toolbar action | `context.registerAction(...)` | (extension context) |
| Event emitter | `api.events: NodeJS.EventEmitter` | 3155 |
| Direct store access | `api.store: ThunkStore<any>` | 3148 |

### 7.3 Resolved risks

| Original risk | Resolution |
|---|---|
| Can we drive FOMOD with saved choices? | **Yes.** `InstallFunc` accepts `choices: any` and `unattended: boolean`. Vortex collections themselves use this same path: `IModRule.installerChoices` carries the choices, and `IMod.attributes.installerChoices` persists them on the installed mod. |
| Can we install an arbitrary archive on disk? | **Yes.** `startDownload(['file:///<path>'], modInfo, name, 'replace', { allowInstall: 'force' })` round-trips a local archive through the same install pipeline as a Nexus download. |
| Can we install a Nexus mod by id? | **Yes.** `nexusDownload(gameId, modId, fileId, fileName, true)` downloads + installs in one call using the user's API key. |
| Can we await deployment? | **Yes.** `awaitModsDeployment(profileId, progressCB, deployOptions)` returns a real Promise. |
| Can we manipulate file overrides programmatically? | **Yes.** `setFileOverride(gameId, modId, files[])` is a typed Redux action. |

### 7.4 Still to confirm at runtime

Smaller items that the d.ts does not pin down — they don't change the design but do need verification once Vortex is running our extension:

- **Exact event names** for the `EventEmitter` (e.g. `'start-install-download'`, `'mod-installed'`). The d.ts types `events` as `NodeJS.EventEmitter` so event names aren't documented as string literals. **We don't need them for the install path** (see 7.1 — `nexusDownload` and `startDownload` give us API-level installs without raw events) but we may use them for progress reporting.
- **`setFileOverride`'s exact `files` shape** — the action creator signature is generic (`reduxAct.ComplexActionCreator3<string, string, string[], …>`); the third arg is `string[]` so it's likely an array of relative paths. Confirm by inspection on a running instance.
- **INI tweak Redux key** — there's no obvious `iniTweaks` slice in the type definitions. May be embedded in mod attributes or in a separate persistor. **Demote INI tweaks to Phase 5 stretch goal** until we find them.

### 7.5 Net effect on the design

Two design simplifications now possible:

1. **Drop our custom electron-direct file pickers** in `src/utils/utils.ts` (`pickJsonFile`, `pickTxtFile`) — replace with `api.selectFile(...)`. This removes a brittle `electron.remote` reach-around and works in non-renderer contexts too.
2. **No need to manually emit `start-install-download` events.** The `nexusDownload(..., allowInstall=true)` and `startDownload(..., {allowInstall: 'force'})` paths are higher-level and don't require us to know internal event names.

---

## 8. Curator flow (packaging)

1. Curator clicks **Build Collection Package**.
2. Extension runs the existing exporter (`getModsForProfile`), then the **extended capture**:
   - Mod rules from `state.persistent.mods[gameId][modId].rules`.
   - File overrides from the latest `vortex.deployment.json` (read raw — gives us the *actual* deployed winners).
   - INI tweaks from `state.persistent['ini-tweaks']` (**VERIFY**) or whatever Vortex stores.
   - Archive SHA-256 of every mod's source archive in `<staging>/<modId>` or the download cache.
   - External-dep block — if the curator has any non-Nexus mods, prompt them to supply per-mod metadata (instructions URL, optional bundle-this-archive checkbox).
3. Build `manifest.json`.
4. ZIP into `<name>-<version>.vmcoll`. If curator opted to bundle archives, copy them into `bundled/` keyed by SHA-256.
5. Open the output folder, show "Done" notification.

Output goes to `<vortex appData>/mod-monitor/packages/`.

---

## 9. User flow (installation)

### 9.1 Preflight

User clicks **Install Collection from .vmcoll**, picks the file. We:

1. Validate ZIP + parse manifest, reject schema-version mismatches.
2. Verify game match (`game.id` vs. active game). Refuse mismatch.
3. Check game version against `game.versionPolicy`; warn or refuse.
4. Check `vortex.requiredExtensions` are installed *and enabled* (LOOT is the canonical example). Refuse if missing.
5. Show summary dialog: N mods (X from Nexus, Y external, Z bundled), D external deps, estimated download size, estimated disk usage. User confirms.

### 9.2 Resolution

For each mod, decide where its archive will come from:

| Source | Action |
|---|---|
| `nexus:*` and Vortex sees the file in download cache with matching SHA-256 | reuse — no download |
| `nexus:*` and not in cache | enqueue Nexus download via API |
| `nexus:*` but Nexus reports file gone | check `bundled/<sha256>.7z`; if present → use it; else → record as "missing" |
| `external:*` with `bundled: true` | use `bundled/<sha256>.7z` |
| `external:*` with `bundled: false` | prompt user to pick a local archive; verify SHA-256; on mismatch, retry/abort |

After resolution, we have a list of `{compareKey, archivePath}` plus a list of "missing" mods.

If `package.strictMissingMods === true` and the missing list is non-empty → abort with full report.
Else → show a "the following will be skipped" dialog, user confirms, continue.

### 9.3 Install (per mod, in `installOrder`)

For each resolvable mod, in order:

1. Pre-write the FOMOD selections into the about-to-be-installed mod's attributes (workaround until we confirm an API path). **VERIFY**.
2. Dispatch the install event for the archive.
3. Wait for completion (event-based; no polling).
4. Apply mod rules involving this mod.
5. Set enabled state on active profile.
6. Set deployment priority.
7. Persist progress to `<package-id>-progress.json` so we can resume if Vortex/PC crashes.

### 9.4 Post-install

1. Apply all `fileOverrides` (idempotent).
2. Apply all `iniTweaks`.
3. Write `plugins.txt` to the order specified in manifest (overwrite, with backup).
4. Trigger deploy.
5. After deploy completes, run §9.5.

### 9.5 External dependencies

Shown in a separate dialog *after* mods finish, since they require manual user action:

- For each entry: show name, instructions, link. User clicks **I've installed it**.
- We verify by hashing the listed `files` at their `destination`. Mismatch → re-prompt.

### 9.6 Reconciliation

- Re-snapshot using existing `getModsForProfile`.
- Diff against the curator's snapshot embedded in the manifest using existing `compareSnapshots`.
- Re-parse current `plugins.txt`, diff against `manifest.plugins.order`.
- Render a single drift report:
  - **Green**: 0 differences → "Install verified identical to curator."
  - **Yellow**: only differences in fields we know are noisy (e.g. `attributes.description`) → "Install successful, cosmetic differences only."
  - **Red**: structural differences → list them, with a per-row "fix" button where automatic fixes are safe.

---

## 10. Phased delivery

| Phase | Deliverable | Approx. effort | Gate |
|---|---|---|---|
| **0** | Repo cleanup: rename unification, license, this proposal accepted | ½ day | Owner sign-off |
| **0.5** | ~~Spike: confirm `vortex-api` symbols in §7.~~ **DONE 2026-04-26.** Type-level verification complete — see §7. Runtime smoke-test (install one Nexus mod with saved FOMOD choices) deferred into Phase 1 since the API surface is solid enough to start building on. | ~~2–4 days~~ ½ day | ✅ Passed |
| **1** | Extended capture: rules, file overrides, INI tweaks, archive hashes added to `AuditorMod` snapshot. Reconciler upgraded to handle them. **Useful as standalone feature on day 1.** | 1–2 weeks | Manual test on real Skyrim SE profile |
| **2** | `.vmcoll` packager: manifest writer + ZIP builder + bundled-archive support. CLI/GUI to build a package from active profile. | 3–5 days | Round-trip: build a package, parse it back, equality |
| **3** | Resolver: Nexus download integration, hash verification, external-archive picker, bundled-fallback logic. | 1–2 weeks | Resolves a 30-mod collection on a clean machine without manual intervention beyond external prompts |
| **4** | Installer driver: orchestrate install/rules/overrides/deploy via vortex-api events. Resume-from-crash support. | 3–6 weeks | End-to-end: clean Vortex → install `.vmcoll` → reconciler shows green on a real collection |
| **5** | Polish: drift report UI, external-dep dialogs, error recovery, telemetry-free logging. | 1 week | UAT with one real collection author + 3 testers |

**Phase 0.5 is the most important gate.** If we cannot drive the FOMOD installer with saved choices through `vortex-api`, the entire scope changes — we'd need to either fork bits of the FOMOD installer extension or accept manual FOMOD replay. Don't skip the spike.

---

## 11. Failure-mode matrix

| Scenario | Behaviour |
|---|---|
| Manifest schema version newer than installer | Refuse. Tell user to update extension. |
| Game id mismatch | Refuse. |
| Game version mismatch with `versionPolicy: "exact"` | Refuse with clear message. |
| Nexus API key missing | Refuse with link to settings. |
| Required Vortex extension missing/disabled (e.g. LOOT) | Refuse with link to install page. |
| Free disk < estimated × 1.5 | Refuse. |
| Mod hidden/removed on Nexus, not bundled, `strictMissingMods: false` | Skip + accumulate in drift report. |
| Mod hidden/removed on Nexus, not bundled, `strictMissingMods: true` | Refuse with full list. |
| External archive picked by user has wrong SHA-256 | Re-prompt, max 3 retries, then offer "skip this mod" or "abort all". |
| FOMOD installer presents a step not in saved choices (e.g. installer changed between curator and user pulling same fileId — should be impossible if SHA matches, but defend anyway) | Pause install, show dialog, let user choose, log as drift. |
| Vortex/PC crash mid-install | On next launch, detect `<package-id>-progress.json`, resume from last completed step. |
| Deploy fails | Don't blow up; collect errors, show report, leave staging intact for manual recovery. |
| External dependency hash mismatch | Re-prompt user; do not auto-overwrite their game-dir files. |
| Reconciler shows red | Surface in dialog, do not auto-revert. User decides. |

---

## 12. Reuse from existing repo

| Existing | New use |
|---|---|
| `src/core/getModsListForProfile.ts` → `getModsForProfile`, `AuditorMod` | Base of curator-side capture; superset added |
| `src/core/comparePlugins.ts` → `parsePluginsTxt`, `comparePluginsEntries` | Plugin-order diff in reconciler |
| `src/utils/utils.ts` → `compareSnapshots`, `deepEqualStable`, `getModCompareKey` | Reconciler core |
| `src/utils/utils.ts` → `pickJsonFile`, `pickTxtFile` | Used as base for `pickVmcollFile`, `pickArchiveFile` |
| `src/utils/utils.ts` → `openFile`, `openFolder` | Drift report and external-deps dialogs |
| `src/core/exportMods.ts` → `exportModsToJsonFile` | Generalized into manifest writer |

The diff engine is the load-bearing pillar. The installer is meaningless without a reliable reconciler, and we already have the reconciler.

---

## 13. Open questions

1. **FOMOD replay path** — settle in Phase 0.5 spike. Drives whether Phase 4 is 3 weeks or 6.
2. **Starfield specifics** — verify `Plugins.txt` location/format, ESM-list semantics, and Vortex's deployment method for it. Bethesda has changed this multiple times.
3. **INI tweaks storage** — confirm Vortex Redux key. If non-trivial to extract, drop INI tweaks to a stretch goal.
4. **LOOT integration** — do we just *require* it, or do we also persist `userlist.yaml` rules into the manifest? Probably yes, but defer to Phase 2.
5. **Signing** — should `.vmcoll` support an optional Ed25519 signature so users can verify "this is really BubuZefirka's package"? Cheap to add, defer to Phase 5.
6. **Update flow** — when a curator releases v1.4.3, can users upgrade in place, or only re-install fresh? v1 = re-install fresh.
7. **License** — which OSI license? MIT proposed. Add `LICENSE` in Phase 0.

---

## 14. Out of scope (explicit)

- Multi-profile collections — one manifest = one profile.
- Partial installs — manifest is all-or-nothing per mod (you don't "install just the patches").
- In-place edits to a deployed collection (a fresh install is the unit).
- Telemetry / analytics — we never phone home.
- Cloud sync of `.vmcoll` files — this is a file format, not a service.
- Linux / SteamDeck — Vortex itself is Windows-only.

---

## 15. Decision log

| Date | Decision |
|---|---|
| 2026-04-26 | Proposal drafted. Games locked to skyrimse, fallout3, falloutnv, fallout4, starfield. External mods supported via local-archive picker. Missing-Nexus-mods policy = skip+warn (default) with optional bundling per package. Reuse Vortex hardlinking + FOMOD via `vortex-api`. Coexist with vanilla collections, do not modify them. Open source. |
| 2026-04-26 | Phase 0.5 spike PASSED. `vortex-api@2.0.0-beta.1` types confirm: `InstallFunc` accepts `choices` + `unattended`; `nexusDownload(..., allowInstall=true)` and `startDownload(..., {allowInstall:'force'})` are the install primitives we'll use; `awaitModsDeployment` gives us awaitable deploys; `setFileOverride`, `addModRule`, `setModEnabled` are all typed actions. License unblocked: `vortex-api` is types-only, GPL on types is irrelevant — we ship our extension under MIT. |
| 2026-04-26 | **Mod identity rule (load-bearing)**. External-dependency mods (any `source.kind: "external"`) are identified solely by `archiveSha256` of the source archive. Nexus mods are identified by `(gameDomain, modId, fileId)` for retrieval but the SHA-256 is mandatory and verified post-download. There is no name/version/filename fallback on the install side. This is the explicit divergence from Vortex's vanilla collections, which trust the user to supply the correct external archive — that "trust" is the root cause of most reproducibility failures. See §5.5. |
