# Archive Hashing Spec

How we compute and attach a SHA-256 fingerprint to every mod's source archive. The whole point: detect "same Nexus IDs, different bytes" — Nexus silently re-uploading a file under the same modId/fileId. Without this signal, the diff engine would say "no change" when in reality the curator's archive was repackaged.

Lives in `src/core/archiveHashing.ts`. Three responsibilities:

1. **Locate** a mod's source archive on disk.
2. **Hash** a single file efficiently.
3. **Enrich** an array of `AuditorMod`s with hashes, with bounded concurrency and tolerance for individual failures.

## When does hashing run?

| Operation | Hashes? | Why |
|---|---|---|
| Export Mods To JSON | **Yes** | Curator-side capture; we want the strongest possible drift signal in every snapshot. |
| Compare Current Mods With JSON | **No** (currently) | Hashing hundreds of archives on every diff would be slow. The user-side reconciler (Phase 5) will hash *after install* to verify, not on every casual compare. |
| Future installer (Phase 4) | **Yes**, on resolved Nexus + external archives **before** install — to verify they match the manifest. |

This split is intentional. Don't hash on the diff path until we add an explicit opt-in.

## `hashFileSha256(filePath)` — single file

### Behavior

1. Open `filePath` as a Node `ReadStream`.
2. Pipe each chunk into a `crypto.createHash('sha256')` updater.
3. On `end`, resolve with the hex digest.
4. On `error`, reject with the underlying error.

### Why streaming

Mod archives can be hundreds of megabytes. Reading them into a single `Buffer` would balloon memory. The streaming hash holds only one chunk at a time (~64 KB by default).

### Inputs

- Absolute path to a regular file.

### Outputs

- `Promise<string>` — lowercase hex SHA-256 (64 chars).

### Failure modes

- **File missing**: stream error, rejects.
- **File unreadable (permissions)**: stream error, rejects.
- **File is a directory**: stream error, rejects (never silently treated as empty).

### Quirks & invariants

- **INVARIANT**: SHA-256 only. Never MD5, even though Vortex has `IDownload.fileMD5` available. We don't trust Vortex's hash for our integrity story; we compute our own and use the standard collision-resistant function.
- **INVARIANT**: Lowercase hex output. The diff engine compares hashes as strings; case-sensitivity matters.

## `getModArchivePath(state, archiveId, gameId)` — locate the file

### Behavior

1. If `archiveId` is undefined, return `undefined` (mod has no archive — e.g., manually-built directory mod).
2. Read `state.persistent.downloads.files[archiveId]`. If missing, return `undefined`.
3. Read `download.localPath` (the per-game-relative filename Vortex assigned). If missing, return `undefined`.
4. Resolve the per-game download base directory via `selectors.downloadPathForGame(state, gameId)`. If empty, return `undefined`.
5. Return `path.join(baseDir, localPath)`.

### Why this many fallbacks

Each step can legitimately produce nothing in normal use:

- A mod created from a directory drop has no `archiveId`.
- A download record may have been GC'd (Vortex prunes `downloads.files` on archive deletion).
- `localPath` may be unset for downloads that never finished.
- `downloadPathForGame` returns `""` if no game discovery has happened yet.

Returning `undefined` at each step lets the caller (`enrichModsWithArchiveHashes`) decide policy: skip silently or error loudly. Currently we skip.

### Inputs

- `state` — current Vortex state.
- `archiveId` — the `mod.archiveId` field; may be `undefined`.
- `gameId` — needed because Vortex partitions downloads per-game.

### Outputs

- Absolute path string when fully resolvable.
- `undefined` otherwise.

### Quirks & invariants

- **INVARIANT**: We never construct paths from `mod.attributes.fileName` even though Vortex sometimes stores it. The download-record `localPath` is the source of truth.
- **QUIRK**: The same archive can theoretically appear under two `archiveId` keys (Vortex's history). We trust the one currently associated with the mod.
- **QUIRK**: A relative `localPath` containing path separators is concatenated as-is. In practice Vortex uses flat per-game folders so this is just the filename, but we don't enforce it.

## `enrichModsWithArchiveHashes(state, gameId, mods, options)` — bulk

### Behavior

1. For each mod in `mods`, in parallel up to `options.concurrency` (default `4`):
   1. Compute `archivePath` via `getModArchivePath`.
   2. If `archivePath` is `undefined`, return the mod unchanged. (Mod has no resolvable archive — manually built, deleted download, etc.)
   3. `fs.promises.stat(archivePath)`. If it fails or the path is not a regular file, return the mod unchanged. (File deleted between Vortex state read and hash time, or some other races.)
   4. Hash the file via `hashFileSha256`. If hashing throws, return the mod unchanged.
   5. Otherwise return a new `AuditorMod` object with `archiveSha256` set.
2. Optionally call `options.onProgress(done, total, mod)` after each mod completes. Use this to update a notification or progress bar.
3. Resolve with the enriched array. Length is identical to input length; order is preserved.

### Concurrency model

- A small worker pool (default 4) consumes items from a shared cursor.
- No external `p-limit` dependency — implemented inline as a 30-line `pMap`.
- Concurrency is **bounded** to be friendly to spinning rust and to avoid spiking I/O during normal Vortex use. Bumping to 8 on SSDs is safe; we expose the option.

### Failure tolerance

**INVARIANT**: per-mod failures never abort the batch. The whole point of capturing hashes is to fingerprint as many mods as possible; missing one is preferable to producing zero hashes because of one corrupted archive.

| Failure | Result |
|---|---|
| `archiveId` is undefined | Mod returned unchanged, no hash. |
| Download record missing | Mod returned unchanged, no hash. |
| File missing on disk | Mod returned unchanged, no hash. |
| File present but unreadable | Mod returned unchanged, no hash. (Stream-error caught locally.) |
| File present but corrupted mid-stream | The error rejects from `hashFileSha256`. We catch it and return the mod unchanged. |
| State malformed (unexpected types) | TypeScript guards make this safe; defensive `?.` handles the rest. |

### Inputs

- `state` — current Vortex state.
- `gameId` — the game whose download cache to consult.
- `mods` — the unenriched `AuditorMod[]`.
- `options.concurrency` — default `4`.
- `options.onProgress` — optional `(done, total, mod) => void` callback.

### Outputs

- `Promise<AuditorMod[]>` — same length, same order, possibly with `archiveSha256` populated.

## How `archiveSha256` is consumed downstream

- **Snapshot JSON**: present in every exported mod (when resolvable). See [`DATA_FORMATS.md`](../DATA_FORMATS.md#1-mods-snapshot--event-horizon-mods-gameid-profileid-tsjson).
- **Diff engine**: included in `compareFields`, so two snapshots with the same `compareKey` but different `archiveSha256` produce a `ModFieldDifference` entry. See [`COMPARE_MODS.md`](COMPARE_MODS.md).
- **Future installer (Phase 4)**: will verify resolved archives against the manifest's recorded hash before invoking Vortex's installer.

## Performance notes (informational, not contract)

- A 100-mod profile with average archive size 50 MB and SHA-256 throughput ~500 MB/s reads = ~10 seconds at concurrency 4. Acceptable for an explicit user-triggered export, not for an automatic on-every-state-change capture.
- We show a Vortex `"activity"` notification during the batch (`Hashing N mod archives…`) which is dismissed when the batch finishes. If batches grew much beyond ~30 seconds we'd want a real progress bar — for now the notification is enough.

## Code references

- `hashFileSha256`: `src/core/archiveHashing.ts:13-22`
- `getModArchivePath`: `src/core/archiveHashing.ts:30-59`
- `pMap` (internal worker pool): `src/core/archiveHashing.ts:64-87`
- `enrichModsWithArchiveHashes`: `src/core/archiveHashing.ts:96-130`
- Wire-up in export action: `src/actions/exportModsAction.ts:30-44`
- Diff engine inclusion: `src/utils/utils.ts:154-167`
