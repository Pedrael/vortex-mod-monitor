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
7. Compute output dir: `<appData>/event-horizon/diffs/`.
8. Write the diff JSON via `exportDiffReport({ diff, outputDir, gameId })`:
   - `mkdir -p`.
   - Filename: `event-horizon-mod-diff-<gameId>-<unixMillis>.json`.
   - Pretty-printed UTF-8.
9. Log one line, show a `success` notification with "Open Diff" / "Open Folder" buttons.

**On any thrown error:** error notification with `"Compare failed: <message>"` plus `console.error`.

## The diff algorithm — `compareSnapshots`

`compareSnapshots` delegates matching to the universal, source-agnostic matcher `matchSnapshots` (`src/core/identity/modIdentity.ts`), then classifies each matched pair.

### 1. Match the two mod lists — `matchSnapshots`

Instead of one brittle key, mods are matched with a strongest-first tier ladder that works regardless of `source`. Matching is greedy: each mod is consumed at most once, strongest tiers first. Unmatched mods fall into `onlyInReference` / `onlyInCurrent` (input order preserved).

| Tier | Rule | Confidence |
|---|---|---|
| `nexus-file` | same Nexus `modId` + `fileId` | 1.0 |
| `archive-sha` | identical `archiveSha256` (byte-identical) | 1.0 |
| `staging-set` | identical `stagingSetHash` (deployed file set) | 1.0 |
| `nexus-mod` | same Nexus `modId`, different `fileId` (version drift) | 0.95 |
| `fuzzy-name-version` | normalized name + normalized version | 0.9 |
| `fuzzy-name` | normalized name, version differs | 0.75 |
| `fuzzy-similar` | token-set Dice >= threshold, mutual best | score |

**Auto-merge**: a match is accepted when its confidence is >= `fuzzyThreshold` (default 0.7). Callers can pass `{ fuzzyThreshold }` to tighten to "hash-only" (> 0.95) or `{ enableSimilarity: false }` to drop the last tier.

**SAFETY (1:1 guard)**: the fuzzy keyed tiers (`fuzzy-name-version`, `fuzzy-name`) only match when a normalized key maps to exactly one remaining mod on each side; colliding groups are left unmatched rather than guessed. The `fuzzy-similar` tier only commits MUTUAL-best pairs at or above the threshold. Together these make a spurious merge of two genuinely different mods effectively impossible.

This replaces the old `getModCompareKey` map-join, whose non-Nexus fallbacks (`archive:<archiveId>`, `id:<mod.id>`) were MACHINE-LOCAL and caused the same mod to appear in BOTH `onlyInReference` and `onlyInCurrent` across machines (a "false split"). `getModCompareKey` is retained but deprecated — used only to derive a stable `compareKey` label per report entry.

### 2. Classify each matched pair — `compareMods`

For every matched pair, `compareMods` walks a fixed field list and tags each inequality (`ModFieldDifference`) with a `category`:

- **content** (real drift): `version`, `enabled`, `nexusFileId`, `archiveSha256`, `hasDetailedInstallerChoices`, `fomodSelections`, `rules`, `modType`, `fileOverrides`, `enabledINITweaks`.
- **cosmetic** (display only): `name`.
- **metadata** (provenance / UI bookkeeping): `source`, `nexusModId`, `collectionIds`, `installerType`, `hasInstallerChoices`.

A pair with >= 1 difference (any category) → `changed` (carries `matchTier` + `confidence`). A pair with zero differences → `unchanged` (a compact `MatchedModSummary`, surfaced under the viewer's "Matched (no meaningful change)" section).

**INVARIANT — identity vs drift**: machine-LOCAL fields are NOT compared: `id`, `archiveId`, `installOrder`, `installTime`. They differ on every machine and are not drift; including them previously flagged ~100% of matched mods as "changed" and buried the real signal (byte / version changes). `deploymentManifests` and `loadOrder` are still not field-diffed (see below).

**Not (yet) diffed at the field level**: `deploymentManifests` (see [`FILE_OVERRIDES_CAPTURE.md`](FILE_OVERRIDES_CAPTURE.md)) and `loadOrder` (see [`ORDERING.md`](ORDERING.md)) are captured on the snapshot wrapper but the diff engine does not consume them. Diffing both requires its own machinery (per-modtype grouping for manifests; position/enabled-state classification for load order) and is deferred to a later slice / the future installer.

### 3. Stable deep-equality — `deepEqualStable`

Both sides are passed through `sortDeep` (recursively sorts object keys alphabetically; arrays preserve order), then `JSON.stringify`'d, then string-compared.

**Why**: native `JSON.stringify` is order-sensitive on objects. Two snapshots that differ only in JSON.stringify order (e.g., one wrote `{a:1, b:2}`, the other `{b:2, a:1}`) would be falsely "different" without canonicalization.

**INVARIANT**: Order of *array* contents is preserved (intentionally). For `fomodSelections`, the order of steps/groups/choices reflects the FOMOD installer flow and is meaningful — reordering would falsely match different install paths. For `rules`, `fileOverrides`, and `enabledINITweaks`, order is NOT meaningful in Vortex but is canonicalized **at capture time** (see the respective specs), so two snapshots with the same logical set produce identical arrays and compare equal.

**QUIRK**: Comparing `undefined` vs an absent property: both serialize as missing keys after sortDeep, so they compare equal. Comparing `undefined` vs `null`: differ (one becomes `null` in JSON, the other is omitted). Tolerable; rarely matters in practice.

## Outputs

### File on disk

- **Path**: `<appData>\event-horizon\diffs\event-horizon-mod-diff-<gameId>-<unixMillis>.json`
- **Contents**: see [`DATA_FORMATS.md`](../DATA_FORMATS.md#2-mods-diff--event-horizon-mod-diff-gameid-tsjson). Top-level fields: `generatedAt`, `reference` (gameId/profileId/exportedAt/count from the loaded JSON), `current` (same from the live build), `summary` (counts: `onlyInReference`, `onlyInCurrent`, `changed`, `unchanged`, `matched`, plus `matchedByTier`), `onlyInReference`, `onlyInCurrent`, `changed` (each entry carries `matchTier` + `confidence` and per-field `category`), and `unchanged` (compact matched-but-identical summaries).

### Notifications

| Type | When | Message |
|---|---|---|
| `success` | On completion | `Diff ready | Reference only: A | Current only: B | Changed: C` |
| `error` | Thrown error | `Compare failed: <message>` |

**No** activity notification — the operation is fast (no hashing, no I/O beyond reading one file and writing one file).

### Console

```
[Vortex Event Horizon] Diff generated | referenceOnly=A | currentOnly=B | changed=C
```

Or:
```
[Vortex Event Horizon] Compare failed: <Error>
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
- **RESOLVED**: Cross-machine comparisons used to be **lossy** for non-Nexus mods — two machines with the same manually-installed / LoversLab mod got different machine-local `archive:`/`id:` keys and were reported as separate mods (a "false split"). The tiered `matchSnapshots` now recovers these via `archive-sha`, `staging-set`, and the fuzzy name/version tiers. See [`AUDITOR_MOD.md`](AUDITOR_MOD.md#mod-identity--comparekey).
- **INVARIANT**: The diff is **deterministic** for two given snapshots — same inputs always produce the same `differences` array, same order. Order of items inside `onlyInReference` / `onlyInCurrent` / `changed` follows reference-then-current map iteration order (insertion order of `Map`).
- **INVARIANT**: The diff JSON is consumable by future tooling without round-tripping through the live extension. Phase 4's installer can ingest it directly to plan reconciliation.
- **QUIRK**: `compareSnapshots` does not surface profile-id or game-id mismatches between reference and current. If you compare a Skyrim SE snapshot against a Fallout 4 profile, you'll get a diff where every mod is `onlyInReference` and the user's mods are all `onlyInCurrent`. The summary fields make this obvious in practice. Strict validation could be added.

## Code references

- Action factory: `src/actions/compareModsAction.ts`
- Universal matcher (tiers, normalization, `matchSnapshots`): `src/core/identity/modIdentity.ts`
- Matcher unit tests: `src/core/identity/modIdentity.test.ts`
- File picker / snapshot type: `src/utils/utils.ts` (`pickJsonFile`, `ExportedModsSnapshot`)
- `getModCompareKey` (deprecated label helper): `src/utils/utils.ts`
- `sortDeep` / `deepEqualStable`: `src/utils/utils.ts`
- `compareMods` (per-field, categorized): `src/utils/utils.ts`
- `compareSnapshots` (orchestrator): `src/utils/utils.ts`
- `exportDiffReport` (writer): `src/utils/utils.ts`
- Diff JSON schema: [`DATA_FORMATS.md`](../DATA_FORMATS.md#2-mods-diff--event-horizon-mod-diff-gameid-tsjson)
