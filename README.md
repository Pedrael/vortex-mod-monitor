# Event Horizon

> *Vortex is a black hole. Collections, rules, FOMOD selections, conflict overrides — they all get pulled in and never come out the same on the other side. Event Horizon is the boundary that captures everything **before** it crosses over.*

A [Vortex](https://www.nexusmods.com/about/vortex/) extension that lets you **snapshot, diff, and (eventually) reproduce** the exact mod state of a profile — rules, FOMOD choices, file overrides, install order, load order, archive hashes — so a curated setup actually arrives on a user's machine the way you built it.

> Status: **early / experimental** (v0.0.1). Tested mainly with Bethesda games (Skyrim SE, Skyrim, Fallout 4). Standalone collection installer (`.ehcoll` format) is in design — see [`docs/PROPOSAL_INSTALLER.md`](docs/PROPOSAL_INSTALLER.md).

---

## Why this exists

Vortex's built-in collection system is genius in concept and unreliable in practice — rules go missing, FOMOD selections get lost, file overrides reset, and "the same collection" produces different installs on different machines. Event Horizon tackles the problem from the other end: capture **every** load-bearing piece of state on the curator's side (in a portable, hash-verified package), then deterministically reproduce it on the user's side using Vortex's low-level installer/deploy primitives — without touching the vanilla collection mechanism at all.

Today, the extension delivers the **capture half** (export + diff). The deterministic installer half is being built incrementally on top.

---

## Features (today)

The extension adds three buttons to the Vortex global toolbar (`global-icons`):

### 1. Export Mods To JSON
Writes a full snapshot of the **active profile's mods** to a JSON file, including:

- Mod identity (`id`, `name`, `version`, `source`, `nexusModId`, `nexusFileId`, `archiveId`)
- **Archive SHA-256** — the load-bearing identity for external (non-Nexus) mods
- Enabled/disabled state (resolved from the profile's `modState`)
- Collection membership (`collectionIds`)
- Installer info (`installerType`, `hasInstallerChoices`, `hasDetailedInstallerChoices`)
- **FOMOD selections** — every step → group → choice the user picked during installation (when Vortex captured them)
- **Mod rules** — captured from Vortex state and canonically sorted
- **File overrides** + **enabled INI tweaks** — the curator's explicit conflict-resolution choices
- **Install order** — derived ordinal so a packager can reproduce timing-sensitive installs
- **Load order** — for games using Vortex's LoadOrder API (distinct from `plugins.txt`)
- **Deployment manifests** — per mod-type, capturing which mod won deployment for each file

Output: `%APPDATA%/Vortex/.../event-horizon/exports/event-horizon-mods-{gameId}-{profileId}-{timestamp}.json`

### 2. Compare Current Mods With JSON
Pick a previously exported snapshot; the extension builds a fresh snapshot of your current profile and produces a diff report:

- `onlyInReference` — mods in the snapshot but missing locally
- `onlyInCurrent` — mods present locally but not in the snapshot
- `changed` — mods present in both with field-level differences (name, version, enabled, FOMOD selections, rules, overrides, install/load order, etc.)

Output: `.../event-horizon/diffs/event-horizon-mod-diff-{gameId}-{timestamp}.json`

### 3. Compare Plugins With TXT
Pick a reference `plugins.txt`; the extension reads the **current** `plugins.txt` from `%LOCALAPPDATA%\<GameFolder>\plugins.txt` and diffs them. Reports:

- `onlyInReference` / `onlyInCurrent` — plugins added/removed
- `enabledMismatch` — plugin present in both but `*`-prefix (enabled state) differs
- `positionChanged` — load order index differs

Output: `.../event-horizon/plugin-diffs/event-horizon-plugins-diff-{gameId}-{timestamp}.json`

Supported games for plugin diffs (mapped via `LOCAL_APPDATA_GAME_FOLDER_BY_GAME_ID`):

| `gameId` | Folder under `%LOCALAPPDATA%` |
|---|---|
| `skyrimse` | `Skyrim Special Edition` |
| `skyrim` | `Skyrim` |
| `fallout4` | `Fallout4` |

Other games will throw `Unsupported gameId for plugins.txt`. PRs welcome.

---

## Install (end users)

1. Build the extension (see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)) or grab a release build.
2. Copy the contents of `dist/` plus `index.js` and `info.json` into:

   ```
   %APPDATA%\Vortex\plugins\vortex-event-horizon\
   ```

3. Restart Vortex. You should see three new icons in the global toolbar.

> The bundled `src/scripts/deploy-to-vortex.js` automates this — see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

---

## Usage

1. Pick a profile you care about and click **Export Mods To JSON**. Stash that file somewhere safe (Git, Dropbox, etc.).
2. Later — after installing/updating mods, switching collections, or anything that might shift state — click **Compare Current Mods With JSON** and pick the saved file.
3. For load-order auditing on Bethesda games, copy your `plugins.txt` somewhere as a baseline, then use **Compare Plugins With TXT** later.

Each action shows a Vortex notification with **Open Diff** and **Open Folder** buttons.

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — code layout, modules, and execution flow
- [docs/DATA_FORMATS.md](docs/DATA_FORMATS.md) — exact shape of every JSON file the extension reads/writes
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — build, deploy, debug, and contribute
- [docs/business/](docs/business/) — **business-logic specs**: per-operation behavior in plain English. Read here when onboarding or when you need to know exactly how a feature behaves in any case (failure modes, edge cases, invariants).
- [docs/PROPOSAL_INSTALLER.md](docs/PROPOSAL_INSTALLER.md) — design doc for the upcoming standalone collection installer (`.ehcoll` format)

---

## Tech

- **Language**: TypeScript 5.7 (strict, ES2019, CommonJS)
- **Runtime**: Vortex (Electron); the extension uses `vortex-api` (`selectors`, `util`, `types`) and `electron`'s file-pick dialog
- **No runtime deps** — only `vortex-api` and `@types/node` at dev time

---

## License

[MIT](LICENSE).
