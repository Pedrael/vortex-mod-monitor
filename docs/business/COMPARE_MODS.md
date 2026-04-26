# Compare Current Mods With JSON — Spec

The diff engine. Loads a previously-exported snapshot, builds a fresh snapshot of the current profile, and produces a structured diff: which mods are only in one side, which exist on both but differ, and exactly which fields differ.

## Trigger

User clicks the global toolbar button **"Compare Current Mods With JSON"**. Registered in `src/index.ts`.

## Preconditions

| Check | Failure |
|---|---|
| An active game is set | Error: `"Compare failed: No active game found"` |
| A profile exists for the active game | Error: `"Compare failed: No profile found for game <gameId>"` |
| User selects a JSON file in the picker | If user cancels, action returns silently — no error, no notification |

## Inputs

- Vortex Redux state.
- A reference JSON file path chosen by the user via Electron's `dialog.showOpenDialog`.
- `util.getVortexPath('appData')`.

## Behavior

1. Read state, resolve game + profile.
2. Open file picker (`pickJsonFile` — Electron native dialog, `.json` filter).
   - If the user cancels: return immediately. No notification, no log line, no diff written.
3. Read the chosen file as UTF-8.
4. `JSON.parse` it as `ExportedModsSnapshot`. (Trusts shape; see "Failure modes".)
5. Build the **current** snapshot:
   - Call `getModsForProfile(state, gameId, profileId)` (see [`AUDITOR_MOD.md`](AUDITOR_MOD.md)).
   - Wrap in an `ExportedModsSnapshot` literal: `{ exportedAt, gameId, profileId, count, mods }`.
   - **No archive hashing** on the current side. See "Quirks" — this is a deliberate omission for now.
6. Run `compareSnapshots(reference, current)` (next section).
7. Compute output dir: `<appData>/mod-monitor/diffs/`.
8. Write the diff JSON via `exportDiffReport({ diff, outputDir, gameId })`:
   - `mkdir -p`.
   - Filename: `vortex-mod-diff-<gameId>-<unixMillis>.json`.
   - Pretty-printed UTF-8.
9. Log one line, show a `success` notification with "Open Diff" / "Open Folder" buttons.

**On any thrown error:** error notification with `"Compare failed: <message>"` plus `console.error`.

## The diff algorithm — `compareSnapshots`

### 1. Build two key→mod maps

For each side (reference, current), build a `Map<string, AuditorMod>` keyed by `getModCompareKey(mod)`. See [`AUDITOR_MOD.md`](AUDITOR_MOD.md#mod-identity--comparekey) for the three-tier priority (`nexus:` → `archive:` → `id:`).

**QUIRK**: If two mods in the same snapshot collide on `compareKey` (extremely rare; would require duplicate Nexus mod+file pairs in one profile), the second wins by `Map.set` semantics. Not currently detected.

### 2. Walk the reference map

For each `(key, referenceMod)`:
- If `currentMap` has no entry for `key` → push `referenceMod` to `onlyInReference`.
- Else, run `compareMods(referenceMod, currentMod)` to compute per-field differences.
  - If any differences exist, push `{ compareKey, reference, current, differences }` to `changed`.
  - If no differences, do nothing — the mod is on both sides and identical.

### 3. Walk the current map for additions

For each `(key, currentMod)`:
- If `referenceMap` lacks the key, push `currentMod` to `onlyInCurrent`.

### 4. Field-level comparison — `compareMods`

For each field in this fixed list, run `deepEqualStable(referenceMod[field], currentMod[field])`. Any inequality becomes a `ModFieldDifference` entry.

```
name
version
enabled
source
nexusModId
nexusFileId
archiveId
archiveSha256
collectionIds
installerType
hasInstallerChoices
hasDetailedInstallerChoices
fomodSelections
rules
modType
fileOverrides
enabledINITweaks
```

**INVARIANT**: This list is the **single source of truth** for "what counts as a meaningful change". Fields outside this list (notably `id` — the Vortex internal id — and the top-level `deploymentManifests` snapshot field) are not compared. Adding a field to `AuditorMod` requires deciding whether to add it here.

**Not (yet) diffed at the field level**: `deploymentManifests` is captured on the snapshot wrapper (see [`FILE_OVERRIDES_CAPTURE.md`](FILE_OVERRIDES_CAPTURE.md)) but the diff engine does not consume it. Diffing manifests requires its own machinery (per-modtype grouping, per-file winner change classification) and is deferred to a later slice / the future installer.

### 5. Stable deep-equality — `deepEqualStable`

Both sides are passed through `sortDeep` (recursively sorts object keys alphabetically; arrays preserve order), then `JSON.stringify`'d, then string-compared.

**Why**: native `JSON.stringify` is order-sensitive on objects. Two snapshots that differ only in JSON.stringify order (e.g., one wrote `{a:1, b:2}`, the other `{b:2, a:1}`) would be falsely "different" without canonicalization.

**INVARIANT**: Order of *array* contents is preserved (intentionally). For `fomodSelections`, the order of steps/groups/choices reflects the FOMOD installer flow and is meaningful — reordering would falsely match different install paths. For `rules`, `fileOverrides`, and `enabledINITweaks`, order is NOT meaningful in Vortex but is canonicalized **at capture time** (see the respective specs), so two snapshots with the same logical set produce identical arrays and compare equal.

**QUIRK**: Comparing `undefined` vs an absent property: both serialize as missing keys after sortDeep, so they compare equal. Comparing `undefined` vs `null`: differ (one becomes `null` in JSON, the other is omitted). Tolerable; rarely matters in practice.

## Outputs

### File on disk

- **Path**: `<appData>\mod-monitor\diffs\vortex-mod-diff-<gameId>-<unixMillis>.json`
- **Contents**: see [`DATA_FORMATS.md`](../DATA_FORMATS.md#2-mods-diff--vortex-mod-diff-gameid-tsjson). Top-level fields: `generatedAt`, `reference` (gameId/profileId/exportedAt/count from the loaded JSON), `current` (same from the live build), `summary` (counts), `onlyInReference`, `onlyInCurrent`, `changed`.

### Notifications

| Type | When | Message |
|---|---|---|
| `success` | On completion | `Diff ready | Reference only: A | Current only: B | Changed: C` |
| `error` | Thrown error | `Compare failed: <message>` |

**No** activity notification — the operation is fast (no hashing, no I/O beyond reading one file and writing one file).

### Console

```
[Vortex Mod Monitor] Diff generated | referenceOnly=A | currentOnly=B | changed=C
```

Or:
```
[Vortex Mod Monitor] Compare failed: <Error>
```

## Failure modes

| Failure | Behavior |
|---|---|
| User cancels file picker | Silent return, no notification. |
| Reference file unreadable (deleted between pick and read) | Error notification. |
| Reference file is invalid JSON | `JSON.parse` throws → error notification. |
| Reference file is valid JSON but wrong shape (e.g., wrong tool's export) | Treated as `ExportedModsSnapshot` via cast. `mods ?? []` defends against missing array. Result: most reference-side mods become `onlyInReference`. The summary numbers will look obviously wrong. |
| Current snapshot build fails | Error notification, no diff written. |
| `mkdir` / `writeFile` fail | Error notification, possibly partial file. |

**INVARIANT**: We do not validate the reference JSON's schema beyond the cast and the `?? []` fallback. The user is trusted to pick a snapshot from this tool. (Validation could be added later — Zod schema or similar — but it's not in scope for the diff path.)

## Quirks & invariants

- **QUIRK**: Current-side mods are **not hashed**. So a `archiveSha256` diff entry can only appear when the reference snapshot has a hash and the current side's `archiveSha256` is `undefined` (always, currently). To make hash-drift detection symmetric, the reconciler (Phase 5) will hash both sides; the casual diff stays cheap.
- **QUIRK**: Cross-machine comparisons are **lossy on Tier-3 compare keys**. Two machines with the same Nexus mod that happens to have lost its `nexusModId/nexusFileId` (e.g., manually installed from disk) will get different `id:` keys and be reported as separate mods. This is documented in [`AUDITOR_MOD.md`](AUDITOR_MOD.md#mod-identity--comparekey).
- **INVARIANT**: The diff is **deterministic** for two given snapshots — same inputs always produce the same `differences` array, same order. Order of items inside `onlyInReference` / `onlyInCurrent` / `changed` follows reference-then-current map iteration order (insertion order of `Map`).
- **INVARIANT**: The diff JSON is consumable by future tooling without round-tripping through the live extension. Phase 4's installer can ingest it directly to plan reconciliation.
- **QUIRK**: `compareSnapshots` does not surface profile-id or game-id mismatches between reference and current. If you compare a Skyrim SE snapshot against a Fallout 4 profile, you'll get a diff where every mod is `onlyInReference` and the user's mods are all `onlyInCurrent`. The summary fields make this obvious in practice. Strict validation could be added.

## Code references

- Action factory: `src/actions/compareModsAction.ts:20-101`
- File picker: `src/utils/utils.ts:40-66`
- Snapshot type: `src/utils/utils.ts:68-74`
- `getModCompareKey`: `src/utils/utils.ts:117-127`
- `sortDeep` / `deepEqualStable`: `src/utils/utils.ts:129-148`
- `compareMods` (per-field): `src/utils/utils.ts:150-183`
- `compareSnapshots` (orchestrator): `src/utils/utils.ts:195-259`
- `exportDiffReport` (writer): `src/utils/utils.ts:261-278`
- Diff JSON schema: [`DATA_FORMATS.md`](../DATA_FORMATS.md#2-mods-diff--vortex-mod-diff-gameid-tsjson)
