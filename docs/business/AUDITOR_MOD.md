# `AuditorMod` — Mod Normalization Spec

The `AuditorMod` is the canonical, normalized representation of a single mod inside the active profile. It's the **only** shape every other operation in this codebase consumes. Everything that reads Vortex state ultimately produces `AuditorMod[]`; everything that writes (export, diff, future installer) ingests it.

If `AuditorMod` is wrong, every downstream operation is wrong.

## Field-by-field meaning

| Field | Type | Source in Vortex state | Notes |
|---|---|---|---|
| `id` | `string` (required) | the key under `state.persistent.mods[gameId]` | This is **Vortex's internal mod id**, not the Nexus mod id. Stable per machine, NOT portable across machines. |
| `name` | `string` (required) | `mod.attributes.name` → `mod.id` → `id` | Always populated, falling back to the id if no name attribute exists. |
| `version` | `string?` | `String(mod.attributes.version)` | Stringified even if Vortex stored a number. Undefined if the attribute is missing. |
| `enabled` | `boolean` (required) | `profile.modState[modId].enabled === true` | **Profile-aware.** A mod can exist (`state.persistent.mods`) but be disabled in the active profile — `enabled` reflects the profile, not the mod table. |
| `source` | `string?` | `String(mod.attributes.source)` | Typical values: `"nexus"`, `"manual"`, undefined. |
| `nexusModId` | `string \| number?` | `mod.attributes.modId` ?? `mod.attributes.nexusId` | Two key fallbacks because Vortex has used both names historically. We do **not** coerce to number — Vortex sometimes stores it as a string. |
| `nexusFileId` | `string \| number?` | `mod.attributes.fileId` | Same dual-type tolerance as `nexusModId`. |
| `archiveId` | `string?` | `mod.archiveId` | Used to look up the source archive in `state.persistent.downloads.files`. See [`ARCHIVE_HASHING.md`](ARCHIVE_HASHING.md). |
| `collectionIds` | `string[]` (required, may be empty) | `mod.attributes.collectionIds` ?? `mod.attributes.collections` ?? `mod.attributes.collection` | **Always an array.** See "collectionIds normalization" below. |
| `installerType` | `string?` | `String(installerChoices.type)` if `installerChoices.type` exists | Typical: `"fomod"`. Reflects which installer ran. |
| `hasInstallerChoices` | `boolean` (required) | `installerChoices !== undefined` | True iff *any* of the seven fallback keys produced a value. |
| `hasDetailedInstallerChoices` | `boolean` (required) | At least one step→group→choice exists in normalized `fomodSelections` | True iff the FOMOD tree contains at least one chosen option. False for non-FOMOD installs. |
| `archiveSha256` | `string?` | _not in Vortex state_ — computed from disk | Hex SHA-256 of the source archive. Populated by `enrichModsWithArchiveHashes` (export only). See [`ARCHIVE_HASHING.md`](ARCHIVE_HASHING.md). |
| `fomodSelections` | `FomodSelectionStep[]` (required, may be empty) | normalized from `installerChoices.options` | See "FOMOD selections normalization" below. |
| `rules` | `CapturedModRule[]` (required, may be empty) | normalized from `mod.rules` | Sorted canonically. Captures `before`/`after`/`requires`/`conflicts`/`recommends`/`provides`. See [`MOD_RULES_CAPTURE.md`](MOD_RULES_CAPTURE.md). |
| `modType` | `string` (required, may be empty) | `mod.type` | Vortex modtype. `""` is the default. Examples: `"collection"`, `"dinput"`, `"enb"`. Used to enumerate per-modtype deployment manifests during capture. See [`FILE_OVERRIDES_CAPTURE.md`](FILE_OVERRIDES_CAPTURE.md). |
| `fileOverrides` | `string[]` (required, may be empty) | `mod.fileOverrides` (deduped + sorted) | Curator's explicit "this mod wins file X" choices from Vortex's conflict-resolution UI. The single strongest signal we capture. See [`FILE_OVERRIDES_CAPTURE.md`](FILE_OVERRIDES_CAPTURE.md). |
| `enabledINITweaks` | `string[]` (required, may be empty) | `mod.enabledINITweaks` (deduped + sorted) | INI tweak filenames the curator turned on for this mod. |

## Building an `AuditorMod`

The function `getModsForProfile(state, gameId, profileId)` walks `state.persistent.mods[gameId]` and produces one `AuditorMod` per entry. It does **not** filter by enabled state — disabled mods are still in the array, with `enabled: false`. Callers that want only enabled mods filter themselves.

For each raw mod entry:

1. Read its attributes object (`mod.attributes`, defaulting to `{}` if missing).
2. Locate installer choices via the **fallback chain** (next section).
3. Normalize FOMOD selections from those choices.
4. Normalize collection IDs.
5. Compute `hasInstallerChoices` and `hasDetailedInstallerChoices`.
6. Resolve `enabled` from the profile's `modState`.
7. Assemble the `AuditorMod`.

**INVARIANT**: this function is **synchronous and pure** — no I/O. The `archiveSha256` field is populated by a separate async enricher specifically because we don't want this base function to do disk reads.

## Installer-choices fallback chain

Vortex/installers store FOMOD choice data inconsistently. We try seven attribute keys in order, returning the first non-nullish value:

```
1. attributes.installerChoices       (the canonical key in modern Vortex)
2. attributes.installerChoicesData
3. attributes.fomodChoices
4. attributes.fomod
5. attributes.choices
6. attributes.installChoices
7. attributes.installerOptions
```

If none of these are populated, `installerChoices` is `undefined`, `hasInstallerChoices` is `false`, and `fomodSelections` is `[]`.

**QUIRK**: When a new key shows up in real-world Vortex state (rare but possible — community installers occasionally invent their own), add it to this chain. The only consequence of missing a key is that we'll see "no FOMOD selections captured" for affected mods.

## FOMOD selections normalization

Whatever `installerChoices` returned from the fallback chain, we normalize it into a uniform tree of `FomodSelectionStep[]`. The shape:

```
FomodSelectionStep {
  name: string                  // page/step name shown in FOMOD UI
  groups: FomodSelectionGroup[]
}

FomodSelectionGroup {
  name: string                  // group name within a step
  choices: FomodSelectedChoice[]
}

FomodSelectedChoice {
  name: string
  idx?: number                  // optional — only when Vortex stored a numeric index
}
```

Normalization rules:

1. Top level: read `installerChoices.options`. If it's not an array, return `[]` and stop. Many installers produce `installerChoices` with `type: "fomod"` but no `options`; this is normal.
2. For each step, take its `name` (coerced to `String` with `?? ""` fallback) and its `groups` (defaulting to `[]` if missing).
3. For each group, take its `name` and `choices` (default `[]`).
4. For each choice, take its `name`. Include `idx` only when the source has it as a non-null/non-undefined value, coerced to `Number`.
5. Throw away every other field. We capture only what's needed to **replay the same selection** later.

**INVARIANT**: This output is what the future installer (Phase 4) will pass back to Vortex's `InstallFunc` as the `choices` argument. The shape must stay structurally compatible with what FOMOD installers expect on input.

**QUIRK**: A non-FOMOD mod has empty `fomodSelections` AND empty `installerChoices.options`. We don't distinguish "installer was not FOMOD" from "FOMOD ran with zero selections" — both are observable as empty selections. `installerType` is the way to tell, when present.

## `collectionIds` normalization

Three keys checked in order: `collectionIds`, `collections`, `collection`. Whatever's found is then coerced:

| Source value | Result |
|---|---|
| `undefined` / `null` / `""` / `0` (any falsy) | `[]` |
| `Array<X>` | `X.map(String)` |
| Single value `X` (string or number) | `[String(X)]` |

**INVARIANT**: `collectionIds` on an `AuditorMod` is **always a `string[]`**, never `undefined`. Diffs and the future installer rely on `Array.isArray` being safely true.

## Mod identity — `compareKey`

The `getModCompareKey(mod)` function (in `src/utils/utils.ts`) produces a stable string key used to match the same mod across two snapshots. **Three-tier priority**:

| Tier | Condition | Key format |
|---|---|---|
| 1 | `nexusModId !== undefined` AND `nexusFileId !== undefined` | `nexus:{nexusModId}:{nexusFileId}` |
| 2 | `archiveId` is truthy | `archive:{archiveId}` |
| 3 | (always) | `id:{id}` |

**Why this order:**

- Tier 1 (Nexus pin) is portable across machines, since Nexus mod/file IDs are global. Best for collections — same modId+fileId on curator and user means same mod, same file.
- Tier 2 (archive id) is local to one Vortex instance but stable across reinstalls of the same archive. Useful for mods downloaded once and reinstalled.
- Tier 3 (Vortex internal id) is the lowest-trust fallback. Stable per-machine, but two machines installing the same mod will have different ids.

**Implication for diff matching**: when comparing snapshots between two machines (e.g., curator → user), Tier-1 matches are the only ones that meaningfully line up. A mod that landed in Tier 3 on the curator's snapshot will likely be reported as "only in reference" on the user's machine even if they have the same mod, because their internal ids differ.

This is why **`archiveSha256` matters even when Nexus IDs match**: same `compareKey` means we _think_ it's the same mod; same `archiveSha256` means it _is_ the same bytes.

### Diff identity vs. installer identity

The three-tier `compareKey` rule above is for **diffing two snapshots** —
both sides of the comparison already exist in Vortex, so the Vortex
internal id is a usable lowest-tier fallback.

The future installer (Phase 4+) cannot use that fallback. Before install,
the user's Vortex has no mods, no internal ids, nothing. So the installer
collapses identity to **two tiers**:

| `source.kind` in `.vmcoll` | Identity used by installer | Why |
|---|---|---|
| `"nexus"` | `(gameDomain, modId, fileId)` for download, then `archiveSha256` for verification | Nexus IDs locate the file; the hash proves it's the same bytes the curator had. |
| `"external"` | `archiveSha256` only | No Nexus IDs exist. The hash IS the identity. |

There is no third tier on the install side — a mod whose archive bytes
don't produce the expected hash is treated as missing, never as "close
enough". See [`../PROPOSAL_INSTALLER.md`](../PROPOSAL_INSTALLER.md#55-mod-identity-rules-load-bearing)
for the full rule.

**Practical consequence for current capture**: `archiveSha256` is not
optional luxury data. It's a load-bearing field for the future installer
and we should keep its capture path (in `archiveHashing.ts`) on the happy
path of every export — which it currently is.

## Edge cases

- **Mod with no name attribute**: `name` falls back to `mod.id`, then to the dictionary key. Always populated.
- **Mod with no enabled state in the profile**: `enabled` is `false` (since `modState[id]?.enabled === true` is the test).
- **Mod present in `state.persistent.mods[gameId]` but not in any profile**: still appears in `AuditorMod[]`, `enabled: false`. The active profile determines enablement, not membership.
- **Mod entry exists but `attributes` is missing entirely**: defaults to `{}`. The mod still produces an `AuditorMod` with `name: id`, no version, no Nexus IDs, etc.
- **`installerChoices` exists but is a primitive (not object)**: `pickInstallerChoices` returns it as-is; `installerType` and `fomodSelections` will be undefined/empty. Defensive but harmless.
- **A choice's `idx` is `0`**: included (we check `!== undefined && !== null`, not truthiness). Important for FOMOD groups where the first option has index 0.

## Code references

- Type definitions: `src/core/getModsListForProfile.ts:4-65`
- Profile resolution: `src/core/getModsListForProfile.ts:71-94` — see [`PROFILE_RESOLUTION.md`](PROFILE_RESOLUTION.md)
- `pickInstallerChoices` (fallback chain): `src/core/getModsListForProfile.ts:96-107`
- `normalizeCollectionIds`: `src/core/getModsListForProfile.ts:109-119`
- `normalizeFomodSelections`: `src/core/getModsListForProfile.ts:121-153`
- `hasAnySelectedFomodChoices`: `src/core/getModsListForProfile.ts:155-159`
- `getModsForProfile`: `src/core/getModsListForProfile.ts:161-209`
- `getModCompareKey`: `src/utils/utils.ts:117-127`
- `archiveSha256` field: `src/core/getModsListForProfile.ts`; populated by `src/core/archiveHashing.ts`
- `rules` field + capture types: `src/core/getModsListForProfile.ts` — see [`MOD_RULES_CAPTURE.md`](MOD_RULES_CAPTURE.md)
- `modType` / `fileOverrides` / `enabledINITweaks` fields: `src/core/getModsListForProfile.ts` — see [`FILE_OVERRIDES_CAPTURE.md`](FILE_OVERRIDES_CAPTURE.md)
- `normalizeStringArray` (shared dedupe + sort helper): `src/core/getModsListForProfile.ts`
