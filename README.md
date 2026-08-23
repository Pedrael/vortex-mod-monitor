# Event Horizon

> *Vortex is a black hole. Collections, rules, FOMOD selections, conflict overrides — they all get pulled in and never come out the same on the other side. Event Horizon is the boundary that captures everything **before** it crosses over.*

A [Vortex](https://www.nexusmods.com/about/vortex/) extension that lets you **snapshot, diff, build, and reproduce** the exact mod state of a profile — rules, FOMOD choices, file overrides, install order, load order, archive hashes — so a curated setup actually arrives on a user's machine the way you built it.

> **Status: pre-release (v0.0.1).** Both halves now exist in the code — capture (export + diff), packaging (`.ehcoll`), and the user-side installer — reachable from a dedicated **Event Horizon** page in the Vortex sidebar. It has not been through a tagged release, and there is **no automated test suite yet**, so treat every determinism guarantee below as *intended behaviour that has not been mechanically verified*. Tested mainly with Bethesda games (Skyrim SE, Skyrim, Fallout 4).

**Requires Vortex 2.x.** The extension builds against `@nexusmods/vortex-api` 2.6.0-beta.2 (React 18). It will not run on Vortex 1.16.

---

## Why this exists

Vortex's built-in collection system is genius in concept and unreliable in practice — rules go missing, FOMOD selections get lost, file overrides reset, and "the same collection" produces different installs on different machines. Event Horizon tackles the problem from the other end: capture **every** load-bearing piece of state on the curator's side (in a portable, hash-verified package), then deterministically reproduce it on the user's side using Vortex's low-level installer/deploy primitives — without touching the vanilla collection mechanism at all.

---

## The Event Horizon page

The extension registers a custom React `mainPage` in Vortex's sidebar (global group, so it is visible regardless of which game profile is active). It has seven sections:

| Section | What it does |
|---|---|
| **Dashboard** | Overview, system status, and recent activity |
| **Install** | Install an Event Horizon collection from an `.ehcoll` package |
| **My Collections** | Installed collections and their receipts |
| **Build** | Package your current setup as a collection |
| **Plugin Diffs** | Review plugin comparison reports |
| **Mod Diffs** | Review mod snapshot comparison reports |
| **About** | Version and project info |

Alongside the page, five actions are registered on Vortex's own toolbars:

| Toolbar | Action |
|---|---|
| `mod-icons` | Export Mods To JSON |
| `mod-icons` | Compare Current Mods With JSON |
| `gamebryo-plugin-icons` | Compare Plugins With TXT |
| `global-icons` | Event Horizon: Build *(legacy dialog)* |
| `global-icons` | Event Horizon: Install *(legacy dialog)* |

The two `global-icons` entries are deliberate fallbacks — the same flows without the page, handy for scripted testing. **The page is the recommended UX.**

---

## Capabilities

### Export Mods To JSON

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

### Compare Current Mods With JSON

Pick a previously exported snapshot; the extension builds a fresh snapshot of your current profile and produces a diff report:

- `onlyInReference` — mods in the snapshot but missing locally
- `onlyInCurrent` — mods present locally but not in the snapshot
- `changed` — mods present in both with field-level differences (name, version, enabled, FOMOD selections, rules, overrides, install/load order, etc.)

Output: `.../event-horizon/diffs/event-horizon-mod-diff-{gameId}-{timestamp}.json` — browsable in the **Mod Diffs** section.

### Compare Plugins With TXT

Pick a reference `plugins.txt`; the extension reads the **current** `plugins.txt` from `%LOCALAPPDATA%\<GameFolder>\plugins.txt` and diffs them:

- `onlyInReference` / `onlyInCurrent` — plugins added/removed
- `enabledMismatch` — plugin present in both but `*`-prefix (enabled state) differs
- `positionChanged` — load order index differs

Output: `.../event-horizon/plugin-diffs/event-horizon-plugins-diff-{gameId}-{timestamp}.json` — browsable in the **Plugin Diffs** section.

Supported games for plugin diffs (mapped via `LOCAL_APPDATA_GAME_FOLDER_BY_GAME_ID`):

| `gameId` | Folder under `%LOCALAPPDATA%` |
|---|---|
| `skyrimse` | `Skyrim Special Edition` |
| `skyrim` | `Skyrim` |
| `fallout4` | `Fallout4` |

Other games will throw `Unsupported gameId for plugins.txt`. PRs welcome.

### Build

Packs the snapshot into a standalone `.ehcoll` package — a self-contained ZIP with a `manifest.json` the installer consumes. Asks for collection **name**, **version** (semver), **author**, and an optional **description**.

Supported games: `skyrimse`, `fallout3`, `falloutnv`, `fallout4`, `starfield`. Others are rejected with an error notification.

Output: `%APPDATA%/Vortex/event-horizon/collections/<slug>-<version>.ehcoll`

Manifest format is `schemaVersion: 1` — see [`docs/business/MANIFEST_SCHEMA.md`](docs/business/MANIFEST_SCHEMA.md). Inspect a package with `7z l file.ehcoll`. Full spec: [`docs/business/BUILD_PACKAGE.md`](docs/business/BUILD_PACKAGE.md).

### Install

Reads an `.ehcoll` package and reproduces the captured state — resolving archives, replaying install order, applying mod rules, file overrides, userlist and load order, then recording a receipt. See [`docs/business/INSTALL_ACTION.md`](docs/business/INSTALL_ACTION.md), [`INSTALL_DRIVER.md`](docs/business/INSTALL_DRIVER.md), and [`INSTALL_LEDGER.md`](docs/business/INSTALL_LEDGER.md).

> This is the newest and least-exercised part of the extension. Back up a profile before pointing it at one you care about.

---

## Install (end users)

1. Build the extension (see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)) or grab a release build.
2. Copy the contents of `dist/` plus `index.js`, `info.json`, and `assets/` into:

   ```
   %APPDATA%\Vortex\plugins\vortex-event-horizon\
   ```

3. Restart Vortex. **Event Horizon** appears in the sidebar, and the toolbar actions appear on the mods and plugins screens.

> `scripts/deploy-to-vortex.js` automates this — `npm run build:vortex`. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

---

## Usage

1. Open **Event Horizon → Build** to package your current profile as an `.ehcoll`, or use **Export Mods To JSON** on the mods toolbar for a plain snapshot.
2. To audit drift: export a snapshot, then later use **Compare Current Mods With JSON** and read the report under **Mod Diffs**.
3. For load-order auditing on Bethesda games, keep a baseline `plugins.txt`, then use **Compare Plugins With TXT** and read the report under **Plugin Diffs**.
4. To reproduce a setup elsewhere, open **Event Horizon → Install** and point it at an `.ehcoll`.

Toolbar actions show a Vortex notification with **Open Diff** and **Open Folder** buttons.

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — code layout, modules, and execution flow
- [docs/DATA_FORMATS.md](docs/DATA_FORMATS.md) — exact shape of every JSON file the extension reads/writes
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — build, deploy, debug, and contribute
- [docs/business/](docs/business/) — **business-logic specs**: per-operation behaviour in plain English. Read here when onboarding or when you need to know exactly how a feature behaves in any case (failure modes, edge cases, invariants).
- [docs/PROPOSAL_INSTALLER.md](docs/PROPOSAL_INSTALLER.md) — original design doc for the standalone collection installer

---

## Tech

- **Language**: TypeScript (strict, ES2019, CommonJS output)
- **Runtime**: Vortex 2.x (Electron), React 18
- **API**: [`@nexusmods/vortex-api`](https://www.npmjs.com/package/@nexusmods/vortex-api) — `util`, `selectors`, `actions`, `types`
- **No bundler** — plain `tsc`; every Vortex-provided module stays external and is injected by the host
- **No runtime dependencies** — everything in `devDependencies` is types or tooling

> `.npmrc` sets `legacy-peer-deps`. `@nexusmods/vortex-api` 2.6.0-beta.2 pins React 18 while also pinning `react-select@1.3.0`, whose peer range stops at React 16 — unsatisfiable under npm's strict resolution. Upstream builds with pnpm, which only warns. Since nothing here is bundled, the conflict is type-time only.

---

## License

[MIT](LICENSE).
