# Event Horizon

> *Vortex is a black hole. Collections, rules, FOMOD selections, conflict overrides — they all get pulled in and never come out the same on the other side. Event Horizon is the boundary that captures everything **before** it crosses over.*

A [Vortex](https://www.nexusmods.com/about/vortex/) extension that captures a curator's exact mod state into a portable, hash-verified `.ehcoll` package — and reproduces it on someone else's machine.

**Requires Vortex 2.x.** Built against `@nexusmods/vortex-api` 2.6.0-beta.2 (React 18); it will not run on Vortex 1.16. Windows and Linux/Proton are both supported targets.

---

## Status — alpha, v0.1.0-alpha.2

Everything described below is built and running. It has been exercised end to
end against a real 954-mod Fallout 4 profile, on Windows and on Linux under
umu/Proton. 848 tests across 83 files cover it.

What that does **not** mean:

- It has not been through a tagged public release.
- Reproduction is verified by hashing, not by launching the game. "The files
  match" is what we prove; "the game plays identically" is what you hope
  follows.
- Two captured things are still recorded and never applied — see
  [Known gaps](#known-gaps). Read that section before you rely on the word
  "deterministic".

Tested on Bethesda titles (Fallout 4 primarily, Skyrim SE, Skyrim).

---

## Why this exists

Vortex's collection system is a good idea that loses state. Rules go missing,
FOMOD selections get dropped, file overrides reset, and "the same collection"
produces different installs on different machines — silently, which is the part
that costs you a weekend.

Event Horizon attacks it from the other end. Capture **every** load-bearing
piece of state on the curator's side into a package that carries its own
hashes, then rebuild it on the user's side through Vortex's low-level
installer and deploy primitives. It never enters the vanilla collection
codepath.

Two design positions do most of the work:

**The curator's disk is not the source of truth.** A curator's staging folder
can be quietly corrupt, and hashing it would make that corruption the
reference every user is measured against. Identity comes from the archives, and
drift is measured against *our own previous install*, never against the
curator's machine.

**Sequential, not concurrent.** Vortex loses files when mods install in
parallel. Installing one at a time is slower and is a correctness property, not
a performance oversight.

---

## What it does

### Capture (curator side)

Snapshots the active profile: mod identity and archive SHA-256, enabled state,
collection membership, FOMOD selections, mod rules, file overrides, enabled INI
tweaks, install order, load order, per-modtype deployment manifests, and the
ESL/light flag on every plugin.

Packs it into a `.ehcoll` — a self-contained ZIP with a `schemaVersion: 1`
`manifest.json`. External mods that cannot be linked can be bundled into the
package itself.

### Reproduce (user side)

Reads the package, resolves every mod against what the user already has,
downloads or extracts the rest, and installs them **one at a time**. Then:

- **Verifies** each installed archive by SHA-256, reporting `matches`,
  `differs`, `damaged`, or `unknown`. The `differs`/`damaged` split matters:
  only a damaged archive is fixed by downloading again, and only that one is
  not the curator's problem.
- **Replaces** the user's mod rules and LOOT userlist with the collection's —
  it does not merge. Everything is backed up first, and the backup landing on
  disk is an interlock, not a courtesy. Merging produces a rule set that exists
  on nobody's machine but theirs, and it fails invisibly: every file verifies,
  and the game still loads something else.
- **Pins** the curator's plugin order and restores ESL flags. Plugins the user
  has that the collection does not know about are integrated LOOT-style, not
  appended last.
- **Replays the curator's FOMOD answers.** `installerChoices.ts` hands them to
  Vortex's installer as `IChoiceType` on `start-install-download`, so a mod with
  an installer arrives pre-filled with the curator's selections for the user to
  confirm rather than re-derive.
- **Writes a receipt**, which is the only record of cross-release lineage.

An aborted install writes no receipt.

### Audit

Export a snapshot to JSON and diff it later; diff a reference `plugins.txt`
against the live one. Reports are browsable in-app.

---

## Known gaps

Stated here rather than buried, because they bound the word "deterministic":

| Gap | Consequence |
| --- | --- |
| **`fileOverrides` are recorded, not applied.** | A real collection carries 4,382 entries. Nobody has measured whether they change the outcome. |
| **INI tweaks are recorded, not applied.** | The build warns the curator, so it is disclosed rather than silent. |

The driver also does not roll back. A failed run leaves what it installed in
place and re-running picks up from there — deliberate, because a half-rolled-back
install is harder to reason about than a half-finished one.

---

## Install (users)

```
npm install
npm run build:vortex     # builds, then copies into %APPDATA%\Vortex\plugins\
```

Restart Vortex. **Event Horizon** appears in the sidebar.

To install by hand instead, copy `index.js`, `info.json`, `dist/` and `assets/`
into `%APPDATA%\Vortex\plugins\vortex-event-horizon\`.

For a distributable archive, `npm run package:extension` writes
`release/event-horizon-<version>.zip` with `info.json` at the archive root —
which is where Vortex looks, and the thing that zipping the project folder gets
wrong. See [`docs/PUBLISHING.md`](docs/PUBLISHING.md).

---

## The Event Horizon page

A React `mainPage` in the sidebar (global group — visible whatever game is
active), with seven sections: **Dashboard**, **Install**, **My Collections**,
**Build**, **Plugin Diffs**, **Mod Diffs**, **About**.

Five actions are also registered on Vortex's own toolbars: Export Mods To JSON
and Compare Current Mods With JSON on `mod-icons`, Compare Plugins With TXT on
`gamebryo-plugin-icons`, and legacy Build/Install dialogs on `global-icons`.
The `global-icons` pair are deliberate fallbacks for scripted testing — **the
page is the supported UX.**

### Game support

Building a collection: `skyrimse`, `fallout3`, `falloutnv`, `fallout4`,
`starfield`. Plugin diffs additionally need a `%LOCALAPPDATA%` folder mapping
and currently cover `skyrimse`, `skyrim`, `fallout4`; anything else raises
`Unsupported gameId for plugins.txt`. Both lists are small tables — PRs welcome.

---

## Documentation

| Doc | Read it for |
| --- | --- |
| [`docs/business/`](docs/business/) | **Per-operation behaviour in plain English** — failure modes, edge cases, invariants. The contract; start here. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Code layout and execution flow |
| [`docs/DATA_FORMATS.md`](docs/DATA_FORMATS.md) | Exact shape of every JSON file read or written |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Build, deploy, debug |
| [`docs/PUBLISHING.md`](docs/PUBLISHING.md) | Getting the **extension** to Vortex users |
| [`docs/DISTRIBUTING_COLLECTIONS.md`](docs/DISTRIBUTING_COLLECTIONS.md) | Getting a **collection** to its users — research, unbuilt |
| [`docs/PROPOSAL_INSTALLER.md`](docs/PROPOSAL_INSTALLER.md) | The original design doc. History: it is built, and its load-order reasoning has since been reversed. |

When a doc and the code disagree, the doc is the spec and the code is the bug —
until someone proves otherwise. A change in behaviour ships with its spec
update in the same commit.

---

## Development

```
npm test                 # vitest
npm run typecheck        # tsc --noEmit, src
npm run typecheck:test   # tests are typechecked separately, and must be
npm run build            # tsc
npm run package:extension
```

`typecheck:test` exists because the test files were not typechecked for most of
this project's life, which hid five shape drifts in tests that were passing.

### Tech

- TypeScript, strict, ES2019, CommonJS output
- **No bundler** — plain `tsc`; Vortex-provided modules stay external and are
  injected by the host
- **No runtime dependencies.** Everything in `devDependencies` is types or
  tooling.

**Reading a `.ehcoll` uses a hand-written zero-dependency ZIP reader**
(`src/core/manifest/readZip.ts`), not Vortex's 7-Zip. Shelling out to `7z.exe`
fails under a Wine/Proton prefix for reasons that have nothing to do with the
archive — a missing vcrun runtime in the prefix — and surfaces to the user as
`7z failed to list`, which reads as "your collection is broken" and is not.

The split is deliberate and asymmetric:

| | Uses |
| --- | --- |
| Reading our own `.ehcoll` | native `readZip.ts` |
| Listing an archive | native-ZIP-first, 7z fallback (`listArchive.ts`) |
| **Writing** a `.ehcoll` | still Vortex's 7-Zip (`packageZip.ts`) |
| Unpacking third-party mod archives (`.7z`, `.rar`) | Vortex's 7-Zip — the right tool, and ours cannot do it |

Writing stayed on 7-Zip because packaging is a curator-side operation and the
Proton failure is user-side. If curators start hitting it, that is the next
piece to move.

> `.npmrc` sets `legacy-peer-deps`. `@nexusmods/vortex-api` 2.6.0-beta.2 pins
> React 18 while also pinning `react-select@1.3.0`, whose peer range stops at
> React 16 — unsatisfiable under npm's strict resolution. Upstream builds with
> pnpm, which only warns. Nothing here is bundled, so the conflict is
> type-time only.

---

## License

[MIT](LICENSE).
