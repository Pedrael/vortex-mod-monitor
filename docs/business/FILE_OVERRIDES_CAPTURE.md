# File overrides & deployment manifest capture

> Module: [`src/core/deploymentManifest.ts`](../../src/core/deploymentManifest.ts) — manifest capture
> Module: [`src/core/getModsListForProfile.ts`](../../src/core/getModsListForProfile.ts) — per-mod fields
> Phase: 1, slice 3
> Status: implemented

This spec covers everything the extension records about **which files Vortex
actually deploys to the game folder, and which mod wins each one**. It
reflects the curator's day-of-export reality and is the foundation the
future installer (Phase 4+) uses to plan reconciliation on the user's
machine.

There are three independent captures, layered from cheapest to most
expensive:

| Capture                    | Where                              | Source                                           | Cost          | Diffed?           |
| -------------------------- | ---------------------------------- | ------------------------------------------------ | ------------- | ----------------- |
| `AuditorMod.fileOverrides` | per-mod                            | `mod.fileOverrides` (Vortex state)               | free          | yes               |
| `AuditorMod.enabledINITweaks` | per-mod                         | `mod.enabledINITweaks` (Vortex state)            | free          | yes               |
| `deploymentManifests`      | top-level snapshot, per-modtype    | `util.getManifest(api, modType, gameId)` (FS read) | one read each | not yet (Phase 4) |

---

## 1. Per-mod `fileOverrides`

### What it is

When a mod conflicts with another mod over the same file path, Vortex
shows a conflict-resolution UI. The curator can mark **specific files**
where THIS mod should win, regardless of install order or rules. The
result is stored as `mod.fileOverrides: string[]` in Vortex state.

This is the *strongest* curator signal we can capture: an explicit
"deploy this exact file from this exact mod, no exceptions".

### Field definition

```ts
fileOverrides: string[]; // always present; empty array when no overrides
```

- Each entry is a relative path Vortex was told to deploy from this mod.
- Path format is whatever Vortex stored — typically forward-slash relative
  to the deployment target. We do not normalize separators.

### Capture algorithm

1. Read `mod.fileOverrides` from state.
2. Drop entries that are not non-empty strings (defensive — Vortex state
   is occasionally corrupted by buggy extensions).
3. Deduplicate (preserves curator-visible behavior; Vortex itself shouldn't
   produce dupes but we don't trust it).
4. **Sort alphabetically** so two snapshots representing the same set of
   overrides produce identical JSON regardless of add-order.

Empty array when the mod has no overrides set. Never `undefined`.

### Diff behavior

Listed in `compareMods.compareFields`. The compare engine uses
`deepEqualStable` which:

- Treats arrays as ordered. Our canonical sort makes this safe — two
  snapshots with the same set of overrides will compare equal.
- Reports a `fileOverrides` field difference with full before/after arrays
  when they diverge.

---

## 2. Per-mod `enabledINITweaks`

### What it is

Vortex ships an "INI Tweaks" feature: each mod can include named INI
patches the user toggles on/off. The list of currently-enabled tweak
filenames lives at `mod.enabledINITweaks: string[]`.

### Field definition

```ts
enabledINITweaks: string[]; // always present; empty array when none enabled
```

### Capture algorithm

Identical to `fileOverrides`: dedupe + canonical sort. Defensive against
non-array / non-string entries.

### Diff behavior

Listed in `compareMods.compareFields`. Diff is array-equal after canonical
sort, same as `fileOverrides`.

---

## 3. Top-level `deploymentManifests`

### What it is

The snapshot's `deploymentManifests` field captures, per Vortex modtype,
**every file Vortex actually deployed and which mod won deployment**. This
is the ground truth that conflict rules + install order + file overrides
collectively *produced*.

It is captured by reading `util.getManifest(api, modType, gameId)` once
per distinct modtype the curator has mods for. Each manifest is normalized
into our portable shape (absolute paths and Vortex instance UUIDs are
stripped).

### Why per-modtype

Bethesda games (and others) have multiple Vortex modtypes that deploy to
different target directories — for example:

- `""` (default) — deploys to `Data/`
- `"dinput"` — deploys to the game root for things like the 4GB patch
- `"enb"` — deploys to the game root for ENB binaries
- game-specific types defined by individual extensions

Each modtype has its **own** `vortex.deployment.json`, so we read each
separately. We always include the default modtype even when no mods
declare one, so the snapshot has a stable shape.

### Type shape

```ts
type CapturedDeploymentManifest = {
  modType: string;             // "" for default, otherwise e.g. "dinput", "enb"
  deploymentMethod?: string;   // "hardlink" / "symlink" / "move" — installer hint
  deploymentTime?: number;     // unix-millis; informational only
  entryCount: number;          // == files.length, for cheap diff summaries
  files: CapturedDeploymentEntry[];
};

type CapturedDeploymentEntry = {
  relPath: string;             // path relative to the deployment target
  source: string;              // Vortex mod folder name that won deployment
  merged?: string[];           // when set: file is the result of a merge
  target?: string;             // sub-target dir; absent for single-target games
};
```

### What we deliberately drop

- `manifest.instance` — Vortex's per-install UUID. Not portable.
- `manifest.stagingPath` — absolute path to the curator's staging folder.
- `manifest.targetPath` — absolute path to the curator's game data dir.
- `manifest.version` — internal manifest schema version. We don't need to
  surface it; we'll rev our own snapshot version when our schema changes.
- Per-file `time` — wall-clock last-modified-time on the curator's disk.
  Not portable, not useful for the installer's planning step.

### What we deliberately KEEP

- `deploymentMethod` — the user-side installer should re-deploy with the
  same method (hardlink/symlink/move) when possible, since some games
  break with the wrong method (e.g. CK won't load symlinked plugins).
- `deploymentTime` — informational, helps debug "is the manifest stale
  vs. the snapshot?".

### Capture algorithm

1. **Enumerate modtypes**: walk `state.persistent.mods[gameId]` and
   collect distinct values of `mod.type`. Always include `""`.
2. **Per modtype, read manifest** via `util.getManifest(api, modType, gameId)`:
   - On success: normalize entries, sort by `relPath`, drop absolute
     paths, retain method + time.
   - On failure: log a console warning, skip that modtype, continue.
     **Partial capture beats no capture.**
3. **Filter**: include the default modtype even when empty (stable shape).
   Skip non-default modtypes that have zero deployed files (no value).
4. Return the array of normalized manifests.

### Failure modes

- **Manifest missing on disk**: `util.getManifest` resolves with an empty
  manifest (Vortex's documented behavior). We capture it as a zero-entry
  manifest for the default modtype.
- **Manifest read throws**: caught per-modtype, console.warn logged, that
  modtype omitted from the snapshot. The export still succeeds.
- **All modtypes fail**: snapshot still emits with `deploymentManifests: []`
  and the export succeeds. Future installer will warn the user.

### INVARIANT: the function never throws

`captureDeploymentManifests` is wrapped in per-modtype try/catch and never
propagates exceptions. The export pipeline cannot be broken by a corrupt
manifest file.

### Diff behavior

**Not diffed yet.** `compareMods` does not look at `deploymentManifests`.
Captured for the future installer only. Diffing this field is a separate
slice (probably Phase 1 slice 5 or Phase 4 install-planner) because it
needs its own logic — the manifest is per-modtype, much larger than per-mod
data, and meaningful diffs require grouping by modtype + summarizing.

### Backwards compatibility

The field is **optional** on `ExportedModsSnapshot`:

- Pre-slice-3 snapshot files do not have it. Loading them works
  unchanged.
- The Compare Mods action builds a current-side snapshot synchronously
  without `api`, so it never sets the field. That's fine — it's not in
  the diff.

---

## Cross-references

- [`AUDITOR_MOD.md`](AUDITOR_MOD.md) — full per-mod field list including
  the new `fileOverrides`, `enabledINITweaks`, `modType`.
- [`EXPORT_MODS.md`](EXPORT_MODS.md) — how this capture is wired into the
  export action.
- [`COMPARE_MODS.md`](COMPARE_MODS.md) — how the per-mod fields participate
  in diffs.
- [`../DATA_FORMATS.md`](../DATA_FORMATS.md) — exact JSON shape of the
  deployment manifest entries.
