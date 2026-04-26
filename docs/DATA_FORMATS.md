# Data Formats

All files this extension reads and writes are JSON (or, for plugins, the standard Bethesda `plugins.txt` format). This document is the contract — keep it in sync with the TypeScript types in `src/`.

---

## 1. Mods snapshot — `vortex-mods-{gameId}-{profileId}-{ts}.json`

Produced by **Export Mods To JSON** (`exportModsToJsonFile`).
Consumed by **Compare Current Mods With JSON** as the reference.

### Top level

```jsonc
{
  "exportedAt": "2026-04-26T17:30:00.000Z",   // ISO 8601, UTC
  "gameId": "skyrimse",
  "profileId": "abcdef12",
  "count": 142,                                // mods.length
  "mods": [ /* AuditorMod[] */ ],
  "deploymentManifests": [ /* CapturedDeploymentManifest[] — optional, omitted from older snapshots */ ]
}
```

`deploymentManifests` is **omitted entirely** from snapshots produced before Phase 1 slice 3, and from snapshots built synchronously by the Compare Mods action (which has no access to Vortex's async `getManifest` API at construction time). Loaders MUST tolerate its absence.

### `AuditorMod`

Defined in [`src/core/getModsListForProfile.ts`](../src/core/getModsListForProfile.ts).

```jsonc
{
  "id": "MyMod-1234-5-0-0-1714000000",         // Vortex internal mod id
  "name": "My Mod",
  "version": "5.0.0",                          // optional, stringified
  "enabled": true,                             // resolved from profile.modState
  "source": "nexus",                           // optional ("nexus" | "manual" | ...)
  "nexusModId": 1234,                          // optional, number or string
  "nexusFileId": 56789,                        // optional, number or string
  "archiveId": "deadbeef-...",                 // optional
  "collectionIds": ["coll-abc", "coll-xyz"],   // always an array (may be empty)

  "installerType": "fomod",                    // optional
  "hasInstallerChoices": true,                 // any installer-choices object found
  "hasDetailedInstallerChoices": true,         // FOMOD tree has at least one chosen option

  "archiveSha256": "abc123…",                  // optional, hex SHA-256 of source archive
  "fomodSelections": [ /* FomodSelectionStep[] */ ],
  "rules": [ /* CapturedModRule[] — sorted canonically, may be empty */ ],

  "modType": "",                               // Vortex modtype, "" is default
  "fileOverrides": ["meshes/foo.nif"],         // sorted+deduped, may be empty
  "enabledINITweaks": ["my-tweak.ini"]         // sorted+deduped, may be empty
}
```

### `FomodSelectionStep`

Mirrors the Vortex installer's "step → group → choice" structure.

```jsonc
[
  {
    "name": "Animations Support",
    "groups": [
      {
        "name": "Select Your Anims",
        "choices": [
          { "name": "Atomic Lust", "idx": 1 },
          { "name": "BP70 Animation Pack", "idx": 2 }
        ]
      }
    ]
  }
]
```

`idx` is optional — only present when Vortex stored a numeric index for the choice.

### `CapturedModRule`

Captured from `mod.rules`. Sorted canonically per snapshot so set-equal rule lists produce equal arrays. Full semantics in [`business/MOD_RULES_CAPTURE.md`](business/MOD_RULES_CAPTURE.md).

```jsonc
{
  "type": "before",                       // "before"|"after"|"requires"|"recommends"|"conflicts"|"provides"
  "reference": {
    "nexusModId": "1234",                 // optional — Nexus repo.modId, stringified
    "nexusFileId": "56789",               // optional — Nexus repo.fileId, stringified
    "nexusGameId": "skyrimspecialedition",// optional — Nexus repo.gameId
    "fileMD5": "abc…",                    // optional — Vortex's stored archive MD5
    "md5Hint": "abc…",                    // optional — partial/heuristic MD5
    "archiveId": "deadbeef-…",            // optional — local archive id (per Vortex install)
    "logicalFileName": "MyMod-1.0.7z",    // optional — filename match
    "fileExpression": "MyMod*.7z",        // optional — glob/regex match
    "versionMatch": ">=1.0.0",            // optional — semver-ish constraint
    "tag": "patch-set-a",                 // optional — opaque grouping tag
    "id": "MyMod-1234-…"                  // optional — Vortex internal id (lowest priority)
  },
  "comment": "Patch must load after the master.",  // optional, non-empty string
  "ignored": true                                  // optional, omitted unless strictly true
}
```

All reference identifiers are optional. Strongest-to-weakest: Nexus repo pin → MD5 → archive id → filename match → version expression → tag → internal id. The future installer/reconciler picks the strongest available pin per machine.

### `CapturedDeploymentManifest`

One per Vortex modtype the curator has mods for. Captures Vortex's `vortex.deployment.json` in a portable shape (absolute paths and per-instance UUIDs are stripped). Full semantics in [`business/FILE_OVERRIDES_CAPTURE.md`](business/FILE_OVERRIDES_CAPTURE.md).

```jsonc
{
  "modType": "",                            // "" is default; "dinput", "enb", etc.
  "deploymentMethod": "hardlink",           // optional: "hardlink"|"symlink"|"move"
  "deploymentTime": 1714053000000,          // optional unix-millis
  "entryCount": 4823,                       // == files.length, for cheap summaries
  "files": [
    {
      "relPath": "meshes/foo.nif",          // path relative to deployment target
      "source": "MyMod-1234-5-0-0",         // Vortex mod folder name that won
      "merged": ["BaseMesh", "PatchMesh"],  // optional — present if merged
      "target": ""                          // optional — sub-target for multi-target games
    }
  ]
}
```

Files are sorted by `relPath`. Entries with neither `relPath` nor `source` are dropped during capture. Manifests with zero entries are included for the default modtype `""` and skipped for non-default modtypes.

The `deploymentManifests` array is **not currently consumed by the diff engine** — the compare action ignores it. It exists so the future installer (Phase 4+) can plan reconciliation against the curator's actual deployment winners.

### Identity for diffing

When two snapshots are compared, mods are matched by `getModCompareKey` (see [`src/utils/utils.ts`](../src/utils/utils.ts)):

| Priority | Key format | When |
|---|---|---|
| 1 | `nexus:{nexusModId}:{nexusFileId}` | Both Nexus IDs present |
| 2 | `archive:{archiveId}` | `archiveId` present |
| 3 | `id:{id}` | Fallback — Vortex's local mod id |

This means renaming a mod or upgrading its version won't break matching as long as Nexus IDs stay consistent.

---

## 2. Mods diff — `vortex-mod-diff-{gameId}-{ts}.json`

Produced by **Compare Current Mods With JSON** (`exportDiffReport`).

```jsonc
{
  "generatedAt": "2026-04-26T17:35:00.000Z",
  "reference": {
    "gameId": "skyrimse",
    "profileId": "abcdef12",
    "exportedAt": "2026-04-26T17:30:00.000Z",
    "count": 142
  },
  "current": {
    "gameId": "skyrimse",
    "profileId": "abcdef12",
    "exportedAt": "2026-04-26T17:35:00.000Z",
    "count": 144
  },
  "summary": {
    "onlyInReference": 1,    // missing locally now
    "onlyInCurrent": 3,      // added since the reference
    "changed": 5             // present in both, with field differences
  },
  "onlyInReference": [ /* AuditorMod[] */ ],
  "onlyInCurrent":  [ /* AuditorMod[] */ ],
  "changed":        [ /* ChangedModReport[] */ ]
}
```

### `ChangedModReport`

```jsonc
{
  "compareKey": "nexus:1234:56789",
  "reference":  { /* AuditorMod from reference */ },
  "current":    { /* AuditorMod from current */ },
  "differences": [
    {
      "field": "version",
      "referenceValue": "5.0.0",
      "currentValue":   "5.1.0"
    },
    {
      "field": "fomodSelections",
      "referenceValue": [ /* ... */ ],
      "currentValue":   [ /* ... */ ]
    }
  ]
}
```

### Compared fields

`compareMods` walks this fixed list (see `src/utils/utils.ts`):

```
name, version, enabled, source, nexusModId, nexusFileId, archiveId,
archiveSha256, collectionIds, installerType, hasInstallerChoices,
hasDetailedInstallerChoices, fomodSelections, rules,
modType, fileOverrides, enabledINITweaks
```

`archiveSha256` is the strongest drift signal: when two snapshots share Nexus
modId+fileId but differ on `archiveSha256`, Nexus served a different file —
a sign the curator's archive was silently re-uploaded or repackaged.

`rules` differences expose Vortex's "rules silently disappeared" failure mode
directly. Because rules are sorted canonically before capture, any non-empty
diff entry is a real change, not noise from add-order.

`fileOverrides` differences expose the second silently-lost feature: Vortex's
explicit "this mod wins file X" choices set via the conflict-resolution UI.
Sorted canonically. Any non-empty diff entry is a real intent change.

`modType` and `enabledINITweaks` are also diffed for completeness; in practice
they rarely change once a mod is installed.

Equality is **order-insensitive deep equality** (`deepEqualStable` → `sortDeep` + `JSON.stringify`), so re-ordered arrays of the same elements won't be flagged as changed.

---

## 3. `plugins.txt` (input)

Standard Bethesda load-order file. The parser ([`parsePluginsTxt`](../src/core/comparePlugins.ts)):

- splits on `\r?\n`, trims, drops blank lines and lines starting with `#`
- treats a leading `*` as **enabled**
- normalizes the name with `trim()` + strip leading `*` + `toLowerCase()` for matching

```
# Skyrim plugins.txt example
*Skyrim.esm
*Update.esm
SomeDisabledMod.esp
*MyMod.esp
```

---

## 4. Plugins diff — `vortex-plugins-diff-{gameId}-{ts}.json`

Produced by **Compare Plugins With TXT** (`exportPluginsDiffReport`).

```jsonc
{
  "generatedAt": "2026-04-26T17:40:00.000Z",
  "referenceFilePath": "C:\\Users\\me\\backup\\plugins.txt",
  "currentFilePath":   "C:\\Users\\me\\AppData\\Local\\Skyrim Special Edition\\plugins.txt",
  "summary": {
    "referenceTotal": 220,
    "currentTotal": 222,
    "onlyInReference": 1,     // counts of arrays below
    "onlyInCurrent": 3,
    "enabledMismatch": 2,
    "positionChanged": 7
  },
  "onlyInReference": [ /* PluginEntry[] */ ],
  "onlyInCurrent":   [ /* PluginEntry[] */ ],
  "enabledMismatch": [ /* PluginEnabledDiff[] */ ],
  "positionChanged": [ /* PluginPositionDiff[] */ ]
}
```

### `PluginEntry`

```jsonc
{
  "name": "MyMod.esp",                  // original casing, no leading *
  "normalizedName": "mymod.esp",        // used as map key
  "enabled": true,                      // had leading *
  "index": 17                           // 0-based order in plugins.txt
}
```

### `PluginEnabledDiff`

```jsonc
{
  "name": "MyMod.esp",
  "referenceEnabled": true,
  "currentEnabled":  false
}
```

### `PluginPositionDiff`

```jsonc
{
  "name": "MyMod.esp",
  "referenceIndex": 17,
  "currentIndex": 21
}
```

---

## File locations (Windows)

| Output | Path |
|---|---|
| Mod snapshots | `<Vortex appData>\mod-monitor\exports\` |
| Mod diffs | `<Vortex appData>\mod-monitor\diffs\` |
| Plugin diffs | `<Vortex appData>\mod-monitor\plugin-diffs\` |
| Current `plugins.txt` (read-only input) | `%LOCALAPPDATA%\<GameFolder>\plugins.txt` |

`<Vortex appData>` is whatever `util.getVortexPath("appData")` resolves to — typically `%APPDATA%\Vortex`.

---

## Versioning these formats

There is **no schema version field** today. If you change a structure in a breaking way:

1. Add `"schemaVersion": N` to the top-level object in the writer.
2. Have the comparer reject unknown versions with a clear error rather than silently misreading.
3. Bump the extension's `info.json` version.
