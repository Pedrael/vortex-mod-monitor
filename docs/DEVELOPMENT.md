# Development

## Prerequisites

- **Node.js** ≥ 22.9.0 (enforced by `engines` in `package.json`; developed on Node 24 LTS)
- **Vortex** installed locally (you'll be loading the extension into it)
- **Windows** — the extension and its tooling (`start "" "..."`, `%LOCALAPPDATA%`) assume Windows

## Setup

```powershell
git clone https://github.com/ReidenXerx/Event-Horizon.git
cd Event-Horizon
npm install
```

Note: the API types come from the scoped npm package **`@nexusmods/vortex-api`**, pinned to an
exact version. The old `github:Nexus-Mods/vortex-api` repo is archived and must not be used.

`.npmrc` sets `legacy-peer-deps=true`. That is deliberate: the pinned release declares both
`react@18.3.1` and `react-select@1.3.0`, whose peer range stops at React 16, so npm cannot resolve
the tree strictly. Upstream builds Vortex with pnpm, which only warns. Nothing here is bundled, so
the conflict is type-time only — see the `.npmrc` comment for the full reasoning.

## Build

```powershell
npm run build         # tsc → dist/
npm run watch         # tsc -w (incremental)
```

`tsc` is configured with `noEmitOnError: true` — a type error fails the build cleanly.

`npm run build:vortex` runs `npm run build && npm run deploy:vortex` — compile, then copy into Vortex.

## Test

```powershell
npm test              # vitest run
```

Tests live beside the code as `*.test.ts` and are excluded from the compiled output by the
`exclude` block in `tsconfig.json`, so nothing test-related reaches `dist/`.

Coverage is early — currently mod-identity matching only (`src/core/identity/modIdentity.test.ts`).
The determinism-critical paths (archive hashing, conflict priority, load-order and plugins.txt
rendering, manifest parsing) are **not** covered yet. Treat a green run as "the identity matcher
still behaves", not as a guarantee that a captured setup reproduces.

## Deploy to Vortex (manual)

Vortex loads extensions from `%APPDATA%\Vortex\plugins\<extension-name>\`. After `npm run build`, copy the following into that folder:

```
index.js
info.json
dist/
assets/
```

`assets/` is required, not optional — `installEventHorizonIconSet()` loads the sidebar SVG sprite
from there. Omit it and the extension still loads, but the Event Horizon sidebar tab falls back to
a generic glyph.

Restart Vortex. Use **View → Show developer tools** to see `console.log` / `console.error` output — the extension's lines are prefixed with `[Vortex Event Horizon]`.

## Deploy to Vortex (script)

`scripts/deploy-to-vortex.js` automates the copy. It:

- resolves the Vortex plugin path via `%APPDATA%\Vortex\plugins\vortex-event-horizon` — no hardcoding
- copies `dist/` and `assets/` plus the loader `index.js` and `info.json`

If `%APPDATA%` is unset, the script exits with code 1.

## Project layout

See [ARCHITECTURE.md](ARCHITECTURE.md) for module-by-module breakdown.

```
src/
├── index.ts              # Vortex entry
├── actions/              # UI handlers (5 registered toolbar actions)
├── core/                 # State selectors, snapshot, plugin diff
├── utils/                # File pickers, mod diff engine, shell helpers
└── scripts/
    └── deploy-to-vortex.js
```

## Working on the code

### Adding a new toolbar action

1. Create `src/actions/<name>Action.ts` exporting `function create<Name>Action(context): () => Promise<void>`.
2. Import it from `src/index.ts` and register with
   `context.registerAction("<toolbar>", priority, "show", {}, "Label", () => void handler())`.
3. Pick the toolbar that matches the action, and a priority unused on it. Currently:

   | Toolbar | Priorities in use |
   |---|---|
   | `mod-icons` | `100`, `101` |
   | `gamebryo-plugin-icons` | `150` |
   | `global-icons` | `102`, `103` |

   The two `global-icons` entries are the legacy build/install dialogs, kept as scriptable
   fallbacks alongside the Event Horizon main page.

### Adding a new compared field for mods

1. Add the field to `AuditorMod` in [`src/core/getModsListForProfile.ts`](../src/core/getModsListForProfile.ts).
2. Populate it inside `getModsForProfile`'s `.map` callback.
3. Add it to the `COMPARE_FIELDS` array in [`src/utils/utils.ts`](../src/utils/utils.ts), with its `DiffCategory`.
4. Update [`docs/DATA_FORMATS.md`](DATA_FORMATS.md).

### Adding a game for plugin diffs

In [`src/core/comparePlugins.ts`](../src/core/comparePlugins.ts), extend the map:

```ts
const LOCAL_APPDATA_GAME_FOLDER_BY_GAME_ID: Record<string, string> = {
  fallout4: "Fallout4",
  skyrimse: "Skyrim Special Edition",
  skyrim:   "Skyrim",
  // add new entries here, e.g.:
  // starfield: "Starfield",
};
```

Verify the game actually writes a `plugins.txt` in that location before shipping.

## Code intelligence (GitNexus)

This repo is indexed by [GitNexus](https://github.com/) for impact analysis and refactoring. Before editing a function/class:

```
gitnexus_impact({ target: "<symbolName>", direction: "upstream" })
```

Before committing:

```
gitnexus_detect_changes()
```

If a tool warns the index is stale:

```powershell
npm run bearing:refresh      # incremental
npm run bearing:full         # forced rebuild - needed after changing .gitnexusignore
```

`bearing:refresh` does **not** re-evaluate `.gitnexusignore`; only `bearing:full` does.

See `CLAUDE.md` / `AGENTS.md` and the skills under `.claude/skills/` — `bearing-*` for the
workflow playbooks, `gitnexus-area-*` for per-area maps regenerated from the index.

## Debugging tips

- **Extension didn't load**: open Vortex devtools and look for errors mentioning `vortex-event-horizon` / `Event Horizon`. The most likely culprit is the `default` export indirection — see ARCHITECTURE.md "Design notes & quirks."
- **No FOMOD selections in the snapshot**: Vortex only stores them when the FOMOD installer is run with "remember choices" semantics. `pickInstallerChoices` already tries 7 attribute keys; if a new key shows up in your state, add it there.
- **`Unsupported gameId for plugins.txt`**: add the game to the `LOCAL_APPDATA_GAME_FOLDER_BY_GAME_ID` map.
- **Inspect Vortex state**: in devtools console, run `getState()` (Vortex exposes this) and use the `findInObject` helper from `utils.ts` if you need to hunt for a specific attribute.

## Conventions

- **Strict TypeScript** — no implicit `any` in new code (existing `as any` casts on Vortex state are acceptable; their shapes are loosely typed upstream).
- **No comments that just narrate code.** Comment only non-obvious intent / trade-offs / Vortex-specific quirks.
- **Imports**: type-only imports with `import type { ... }` from `@nexusmods/vortex-api` (always the scoped name).
- **Errors** in actions: always caught and surfaced via `sendNotification` + `console.error`. Never let an unhandled rejection escape an action handler.
