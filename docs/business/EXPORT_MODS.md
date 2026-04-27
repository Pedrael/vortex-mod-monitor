# Export Mods To JSON — Spec

The first of the three toolbar actions. Snapshots the active profile's mods to a timestamped JSON file on disk. The output of this action is the **reference snapshot** consumed by the compare actions and (Phase 4+) by the future installer.

## Trigger

User clicks the global toolbar button **"Export Mods To JSON"**. Registered via `context.api.registerAction('global-icons', …)` in `src/index.ts`.

## Preconditions (checked at runtime)

| Check | Failure |
|---|---|
| An active game is set in Vortex | Error toast: `"Export failed: No active game found"` |
| A profile exists for that active game | Error toast: `"Export failed: No profile found for game <gameId>"` |

If either check fails, no file is written and the action exits cleanly via the catch block.

## Inputs

- Vortex Redux state via `context.api.getState()`.
- `util.getVortexPath('appData')` — used to resolve the output directory.

No file picker, no user prompts. The action runs end-to-end on click.

## Behavior

1. Read the current Redux state.
2. Resolve the active game id (see [`PROFILE_RESOLUTION.md`](PROFILE_RESOLUTION.md)). On failure, throw → error notification.
3. Resolve the active profile id for that game. On failure, throw → error notification.
4. Build the unenriched mod list via `getModsForProfile(state, gameId, profileId)` (see [`AUDITOR_MOD.md`](AUDITOR_MOD.md)).
5. Show an `"activity"` notification with id `"vortex-event-horizon:hashing"` and message `"Hashing N mod archives…"`.
6. Enrich the list with archive SHA-256 hashes via `enrichModsWithArchiveHashes(state, gameId, rawMods, { concurrency: 4 })` (see [`ARCHIVE_HASHING.md`](ARCHIVE_HASHING.md)).
7. Dismiss the activity notification by id.
8. Capture per-modtype deployment manifests via `captureDeploymentManifests(api, state, gameId)` (see [`FILE_OVERRIDES_CAPTURE.md`](FILE_OVERRIDES_CAPTURE.md)). This function never throws — per-modtype failures are logged and skipped.
9. Capture the per-game load order via `captureLoadOrder(state, gameId)` (see [`ORDERING.md`](ORDERING.md)). Synchronous, never throws, returns `[]` for games not using Vortex's LoadOrder API.
10. Compute five diagnostic counts:
    - `fomodDetectedCount` = mods where `installerType === "fomod"`.
    - `detailedFomodCount` = mods where `hasDetailedInstallerChoices === true`.
    - `hashedCount` = mods where `archiveSha256 !== undefined`.
    - `deployedFileCount` = sum of `entryCount` across all captured manifests.
    - `loadOrder.length` = number of entries in Vortex's LoadOrder for this game.
11. Compute the output directory: `<appData>/event-horizon/exports/`.
12. Call `exportModsToJsonFile({ mods, gameId, profileId, outputDir, deploymentManifests, loadOrder })`:
    1. `mkdir -p` the output directory.
    2. Construct filename `event-horizon-mods-<gameId>-<profileId>-<unixMillis>.json`.
    3. Write a JSON document containing `exportedAt` (ISO 8601), `gameId`, `profileId`, `count`, `mods`, and (when present) `deploymentManifests` and `loadOrder` — pretty-printed with 2-space indent. Both optional fields are omitted from the JSON entirely when undefined, preserving older-format compatibility.
13. Log a single line to console with the diagnostic counts.
14. Show a `"success"` notification with two action buttons: "Open Export" (opens the file via `start ""`) and "Open Folder" (opens the directory).

**On any thrown error during steps 1–11:** catch block fires:
- An `"error"` notification appears with `"Export failed: <message>"`.
- A line is logged to console with `console.error`.
- A `finally` block then dismisses the activity notification from step 5 if it was ever shown — guaranteed cleanup whether the error happened before, during, or after hashing.

## Outputs

### File on disk

- **Path**: `<appData>\event-horizon\exports\event-horizon-mods-<gameId>-<profileId>-<unixMillis>.json`
- **Contents**: see [`DATA_FORMATS.md`](../DATA_FORMATS.md#1-mods-snapshot--event-horizon-mods-gameid-profileid-tsjson).
- **Encoding**: UTF-8.
- **Indent**: 2 spaces (pretty-printed).

### Notifications

| Type | When | Message |
|---|---|---|
| `activity` | During hashing | `Hashing N mod archives...` |
| `success` | On completion | `Exported N mods | FOMOD: X | Hashed: Y/N | Deployed files: D | LO: L` |
| `error` | On any thrown error | `Export failed: <message>` |

### Console

One success line:
```
[Vortex Event Horizon] Exported N mods | game=<gameId> | profile=<profileId> | fomod=X | detailed=Y | hashed=Z/N | deployedFiles=D across M modtype(s) | loadOrder=L
```

Or one error line:
```
[Vortex Event Horizon] Export failed: <Error stack>
```

## Failure modes

| Failure | Behavior |
|---|---|
| No active game | Error notification, no file written. |
| No profile for active game | Error notification, no file written. |
| `getModsForProfile` throws (defensive type issues) | Error notification, no file written. |
| Hashing batch hits per-mod errors | Each mod silently degrades to no-hash; whole batch succeeds. See [`ARCHIVE_HASHING.md`](ARCHIVE_HASHING.md). |
| Deployment manifest read fails for one or more modtypes | That modtype is skipped, console.warn logged, export still succeeds. See [`FILE_OVERRIDES_CAPTURE.md`](FILE_OVERRIDES_CAPTURE.md). |
| `mkdir` fails (e.g., disk full, permissions) | Error notification, no file written. |
| `writeFile` fails | Error notification, file may be partially written or absent. |

The catch block is broad on purpose: any unhandled error from any step surfaces as a single user-visible notification rather than crashing the extension.

## Quirks & invariants

- **INVARIANT**: One file per click. Subsequent clicks produce new files (timestamped); we **never overwrite** an existing snapshot. The user manages cleanup.
- **INVARIANT**: The output JSON shape is stable; once shipped, fields are added but never renamed. See [`DATA_FORMATS.md`](../DATA_FORMATS.md).
- **INVARIANT**: The hashing activity notification is dismissed via a `finally` block, so it never leaks regardless of which step throws. The `hashingNotificationShown` boolean tracks whether we ever called `sendNotification` so the dismissal is a no-op when the failure happened before hashing started.
- **QUIRK**: We currently use Electron's `dialog` indirectly only for compare actions — export does not prompt. If a user wanted "save as", they don't get it. This is intentional: snapshots are timestamped and live in a known location; "save as" would clutter the flow. The future installer (Phase 4) may export `.ehcoll` packages with a save-as dialog instead.
- **INVARIANT**: `hashedCount <= mods.length`. A mod can have no resolvable archive (manual mods, deleted downloads); these are still in the snapshot, just without `archiveSha256`. The notification shows the ratio so the curator notices when archives are missing.
- **INVARIANT**: The file name format `event-horizon-mods-<gameId>-<profileId>-<unixMillis>.json` is parsed by no current code — but expect future versions of the compare action to glob this pattern for "recent snapshots" pickers.

## Code references

- Action factory: `src/actions/exportModsAction.ts`
- Profile resolution: see [`PROFILE_RESOLUTION.md`](PROFILE_RESOLUTION.md)
- Mod normalization: see [`AUDITOR_MOD.md`](AUDITOR_MOD.md)
- Archive hashing: see [`ARCHIVE_HASHING.md`](ARCHIVE_HASHING.md)
- Deployment manifest capture: see [`FILE_OVERRIDES_CAPTURE.md`](FILE_OVERRIDES_CAPTURE.md)
- Load order capture: see [`ORDERING.md`](ORDERING.md)
- File writer: `src/core/exportMods.ts`
- Output schema: [`DATA_FORMATS.md`](../DATA_FORMATS.md#1-mods-snapshot--event-horizon-mods-gameid-profileid-tsjson)
- Toolbar registration: `src/index.ts`
