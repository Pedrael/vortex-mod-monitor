# Compare Plugins With TXT — Spec

The plugin-load-order diff. Loads a reference `plugins.txt` and compares it against the live one in `%LOCALAPPDATA%`. Reports four categories of difference: only on one side, enabled-flag mismatches, and position changes.

This is **independent of mod state** — it operates purely on the Bethesda load-order file format. Two profiles can have identical `AuditorMod[]` arrays but different `plugins.txt` files (load order is not derivable from mod state alone, especially with `.esl` flag / merged-plugin shenanigans).

## Trigger

User clicks the global toolbar button **"Compare Plugins With TXT"**. Registered in `src/index.ts`.

## Preconditions

| Check | Failure |
|---|---|
| An active game is set | Error: `"Plugins compare failed: No active game found"` |
| The active game has a known `plugins.txt` location (Fallout 4 / Skyrim SE / Skyrim) | Error: `"Plugins compare failed: Unsupported gameId for plugins.txt: <gameId>"` |
| User selects a `.txt` file in the picker | If user cancels, action returns silently |

## Inputs

- Active game id (from Vortex state).
- A reference `plugins.txt` path chosen by the user via Electron's `dialog.showOpenDialog`.
- The current `plugins.txt` location, derived from `gameId`:
  - `fallout4` → `%LOCALAPPDATA%\Fallout4\plugins.txt`
  - `skyrimse` → `%LOCALAPPDATA%\Skyrim Special Edition\plugins.txt`
  - `skyrim` → `%LOCALAPPDATA%\Skyrim\plugins.txt`
- `LOCALAPPDATA` env var (with `os.homedir() + AppData\Local` fallback).
- `util.getVortexPath('appData')` for output dir.

**QUIRK**: `fallout3`, `falloutnv`, and `starfield` are **not** in the supported map yet. The action will throw `"Unsupported gameId for plugins.txt"` for these. The map needs to be extended before installer Phase 4 ships, since those are explicit target games.

## Behavior

1. Read state, resolve game id (no profile resolution needed — `plugins.txt` is per-game, not per-profile in our impl).
2. Open file picker (`pickTxtFile` — Electron native dialog, `.txt` filter, "All files" fallback).
   - User cancel → silent return.
3. Compute the current `plugins.txt` path via `getCurrentPluginsTxtPath(gameId)`. Throws if the game is unsupported.
4. Run `comparePluginsTxtFiles({ referenceFilePath, currentFilePath })`:
   1. Read both files in parallel as UTF-8.
   2. Parse each via `parsePluginsTxt` (next section).
   3. Run `comparePluginsEntries` against the parsed arrays.
5. Compute output dir: `<appData>/event-horizon/plugin-diffs/`.
6. Write the diff via `exportPluginsDiffReport({ diff, outputDir, gameId })`:
   - `mkdir -p`.
   - Filename: `event-horizon-plugins-diff-<gameId>-<unixMillis>.json`.
   - Pretty-printed UTF-8.
7. Log one line, show success notification with "Open Diff" / "Open Folder" buttons.

**On any thrown error:** error notification with `"Plugins compare failed: <message>"` plus `console.error`.

## Parsing — `parsePluginsTxt(content)`

For each line in the file:

1. Split on `\r?\n` (cross-platform line endings).
2. `.trim()` whitespace.
3. **Skip** empty lines.
4. **Skip** lines starting with `#` (comments).
5. For surviving lines:
   - If the line starts with `*`: `enabled = true`, name = the line minus the leading `*`, then trimmed.
   - Otherwise: `enabled = false`, name = the trimmed line as-is.
   - `index` = position among surviving (non-comment, non-empty) lines, **0-based**.
   - `normalizedName` = the name lowercased, with leading `*` stripped (defensive — already stripped above), trimmed.
6. Return `PluginEntry[]`.

**INVARIANT**: `index` is dense (0, 1, 2, …) — gaps from skipped comments/blank lines are not preserved. Two files with different comment positions but identical plugin order produce identical `index` values.

**INVARIANT**: Plugin name matching across the diff is done on `normalizedName` only. `Skyrim.esm`, `skyrim.esm`, and `SKYRIM.ESM` are the same plugin. The original `name` is preserved in the report for human readability.

**QUIRK**: We do not currently parse extended plugins.txt features (LOOT-style group markers, `# Comments` with metadata, etc.). Lines starting with `#` are simply dropped.

## Diffing — `comparePluginsEntries`

Build two `Map<normalizedName, PluginEntry>`s. Then:

### Walk the reference map

For each `(normalizedName, referencePlugin)`:
- If the current map lacks the name → push to `onlyInReference`.
- Else, compare:
  - `referencePlugin.enabled !== currentPlugin.enabled` → push `PluginEnabledDiff` to `enabledMismatch`.
  - `referencePlugin.index !== currentPlugin.index` → push `PluginPositionDiff` to `positionChanged`.
  - **Both can be reported for the same plugin.** A plugin that's been re-enabled AND moved produces two entries.

### Walk the current map for additions

For each `(normalizedName, currentPlugin)`:
- If the reference map lacks the name → push to `onlyInCurrent`.

**INVARIANT**: A plugin appears in **at most one** of `onlyInReference` and `onlyInCurrent`. It can additionally appear in `enabledMismatch` and/or `positionChanged` only if it's on **both** sides.

## Outputs

### File on disk

- **Path**: `<appData>\event-horizon\plugin-diffs\event-horizon-plugins-diff-<gameId>-<unixMillis>.json`
- **Contents**: see [`DATA_FORMATS.md`](../DATA_FORMATS.md#4-plugins-diff--event-horizon-plugins-diff-gameid-tsjson). Top-level: `generatedAt`, both file paths, `summary` (six counts), and the four arrays (`onlyInReference`, `onlyInCurrent`, `enabledMismatch`, `positionChanged`).

### Notifications

| Type | Message |
|---|---|
| `success` | `Plugins diff | Ref only: A | Current only: B | Enabled: C | Order: D` |
| `error` | `Plugins compare failed: <message>` |

### Console

```
[Vortex Event Horizon] Plugins diff | game=<gameId> | referenceOnly=A | currentOnly=B | enabledMismatch=C | positionChanged=D
```

## Failure modes

| Failure | Behavior |
|---|---|
| User cancels file picker | Silent return. |
| Unsupported game (Fallout 3, NV, Starfield) | Error notification with the game id. |
| Current `plugins.txt` missing (game not yet launched) | `fs.readFile` throws → error notification. |
| Reference file unreadable | Error notification. |
| `LOCALAPPDATA` env var missing on Windows (very unusual) | Falls back to `os.homedir() + AppData\Local`. Should always resolve on a normal Windows install. |
| File contains binary garbage | `parsePluginsTxt` will produce arbitrary strings; the diff will be technically valid but meaningless. We don't validate plugin filename format. |

## Quirks & invariants

- **INVARIANT**: This action is the **only** part of the system that reads outside Vortex's appData — it directly opens `%LOCALAPPDATA%\<Game>\plugins.txt`, the file Bethesda's launcher writes. We don't use Vortex's plugin abstraction (`state.session.plugins` etc.) because the canonical truth at game launch is what Bethesda reads from disk.
- **INVARIANT**: Path resolution is OS-dependent on `LOCALAPPDATA`. The action is **Windows-only**. Linux/Mac Vortex installs (rare for Bethesda games) are not supported by this action.
- **QUIRK**: We don't surface "files identical" as a special success state. If everything matches, all four arrays are empty and the success notification reads `Ref only: 0 | Current only: 0 | Enabled: 0 | Order: 0`. Acceptable.
- **QUIRK**: The supported-game map lives as a const in `src/core/comparePlugins.ts`. Adding a game = adding one line. Easy follow-up.
- **INVARIANT**: Position changes are reported as **absolute index pairs** (`referenceIndex`, `currentIndex`), not as deltas. Consumers compute deltas if they want them. This avoids ambiguity — "moved by +3" can mean different things if the plugin set changed.

## Future direction (informational, not contract)

When the installer ships:
- The `.ehcoll` package will include a captured `plugins.txt` per the curator's machine, plus LOOT sortlists when available.
- The reconciler will read these in the same `parsePluginsTxt` format (so this code is reusable).
- A "compare with packaged plugins" UI will replace the manual file picker for installed collections — but the underlying diff function stays untouched.

## Code references

- Action factory: `src/actions/comparePluginsAction.ts:14-81`
- File picker: `src/utils/utils.ts:280-310`
- Type definitions: `src/core/comparePlugins.ts:5-40`
- `LOCAL_APPDATA_GAME_FOLDER_BY_GAME_ID`: `src/core/comparePlugins.ts:42-46`
- `normalizePluginName`: `src/core/comparePlugins.ts:48-50`
- `parsePluginsTxt`: `src/core/comparePlugins.ts:52-69`
- `comparePluginsEntries`: `src/core/comparePlugins.ts:81-150`
- `getCurrentPluginsTxtPath`: `src/core/comparePlugins.ts:158-166`
- `comparePluginsTxtFiles`: `src/core/comparePlugins.ts:168-185`
- `exportPluginsDiffReport`: `src/core/comparePlugins.ts:187-204`
- Plugins diff JSON schema: [`DATA_FORMATS.md`](../DATA_FORMATS.md#4-plugins-diff--event-horizon-plugins-diff-gameid-tsjson)
