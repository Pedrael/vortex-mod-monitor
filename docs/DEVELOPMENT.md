# Development

## Prerequisites

- **Node.js** ≥ 18 (for the `vortex-api` GitHub dep + native modules to install cleanly)
- **Vortex** installed locally (you'll be loading the extension into it)
- **Windows** — the extension and its tooling (`start "" "..."`, `%LOCALAPPDATA%`) assume Windows

## Setup

```powershell
git clone <repo-url>
cd vortex-mod-monitor
npm install
```

Note: `vortex-api` is pulled directly from `github:Nexus-Mods/vortex-api`, so the first install can be slow.

## Build

```powershell
npm run build         # tsc → dist/
npm run watch         # tsc -w (incremental)
```

`tsc` is configured with `noEmitOnError: true` — a type error fails the build cleanly.

There is also `npm run build:vortex` which currently calls `vortex-api build && npm run deploy:vortex`. The `vortex-api build` step depends on the `vortex-api` package providing a build script; if it fails, fall back to `npm run build` and deploy manually.

## Deploy to Vortex (manual)

Vortex loads extensions from `%APPDATA%\Vortex\plugins\<extension-name>\`. After `npm run build`, copy the following into that folder:

```
index.js
info.json
dist/
```

Restart Vortex. Use **View → Show developer tools** to see `console.log` / `console.error` output — the extension's lines are prefixed with `[Vortex Mod Monitor]`.

## Deploy to Vortex (script)

`src/scripts/deploy-to-vortex.js` automates the copy. As of Phase 0 it:

- resolves the Vortex plugin path via `%APPDATA%\Vortex\plugins\vortex-mod-monitor` — no hardcoding
- copies `dist/` plus the loader `index.js` and `info.json`

If `%APPDATA%` is unset, the script exits with code 1.

## Project layout

See [ARCHITECTURE.md](ARCHITECTURE.md) for module-by-module breakdown.

```
src/
├── index.ts              # Vortex entry
├── actions/              # UI handlers (3 toolbar buttons)
├── core/                 # State selectors, snapshot, plugin diff
├── utils/                # File pickers, mod diff engine, shell helpers
└── scripts/
    └── deploy-to-vortex.js
```

## Working on the code

### Adding a new toolbar action

1. Create `src/actions/<name>Action.ts` exporting `function create<Name>Action(context): () => Promise<void>`.
2. Import it from `src/index.ts` and register with `context.registerAction("global-icons", priority, "show", {}, "Label", () => void handler())`.
3. Pick a unique priority — currently `100`, `101`, `101` are used (the duplicate is a known quirk).

### Adding a new compared field for mods

1. Add the field to `AuditorMod` in [`src/core/getModsListForProfile.ts`](../src/core/getModsListForProfile.ts).
2. Populate it inside `getModsForProfile`'s `.map` callback.
3. Add it to the `compareFields` array in [`src/utils/utils.ts`](../src/utils/utils.ts).
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
npx gitnexus analyze
```

See `CLAUDE.md` / `AGENTS.md` and the skill files under `.claude/skills/gitnexus/` for the full workflow.

## Debugging tips

- **Extension didn't load**: open Vortex devtools and look for errors mentioning `vortex-mod-monitor` / `Mod Monitor`. The most likely culprit is the `default` export indirection — see ARCHITECTURE.md "Design notes & quirks."
- **No FOMOD selections in the snapshot**: Vortex only stores them when the FOMOD installer is run with "remember choices" semantics. `pickInstallerChoices` already tries 7 attribute keys; if a new key shows up in your state, add it there.
- **`Unsupported gameId for plugins.txt`**: add the game to the `LOCAL_APPDATA_GAME_FOLDER_BY_GAME_ID` map.
- **Inspect Vortex state**: in devtools console, run `getState()` (Vortex exposes this) and use the `findInObject` helper from `utils.ts` if you need to hunt for a specific attribute.

## Conventions

- **Strict TypeScript** — no implicit `any` in new code (existing `as any` casts on Vortex state are acceptable; their shapes are loosely typed upstream).
- **No comments that just narrate code.** Comment only non-obvious intent / trade-offs / Vortex-specific quirks.
- **Imports**: type-only imports with `import type { ... }` from `vortex-api`.
- **Errors** in actions: always caught and surfaced via `sendNotification` + `console.error`. Never let an unhandled rejection escape an action handler.
