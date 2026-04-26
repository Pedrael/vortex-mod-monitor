# Business Logic — Index

Plain-language behavioral specifications for everything this extension does. Kept current with the code; if something diverges, **the code is wrong** until proven otherwise — these docs are the contract.

Aimed at:

- **Teammates** onboarding without grepping the TypeScript.
- **Us**, when we need to remember "what does the export action do when there's no active profile?" without re-reading the file.
- **Future-us** writing the installer (Phase 4+) — the reconciler is just these specs run in reverse.

## How these docs are structured

Every spec follows the same shape:

| Section | What it says |
|---|---|
| **Trigger** | What kicks the operation off (UI action, file picker, automatic, etc.) |
| **Preconditions** | What must be true before the operation runs (and what we check explicitly) |
| **Inputs** | Every piece of state, file, or user choice the operation reads |
| **Behavior** | Numbered steps, **including all branches and edge cases**, in plain English |
| **Outputs** | Every file written, notification shown, or state change made |
| **Failure modes** | What can go wrong and how the system reacts |
| **Quirks & invariants** | Non-obvious things you'd otherwise have to discover by surprise |
| **Code references** | `path/to/file.ts` line ranges, for jump-to-source |

When prose disagrees with code, the prose is the spec — open an issue or fix the code.

## Contents

### Foundations (read these first)

| Spec | Topic |
|---|---|
| [`AUDITOR_MOD.md`](AUDITOR_MOD.md) | The `AuditorMod` shape — the canonical normalized representation of a mod, including FOMOD selections, installer-choice key fallback chain, mod identity rules, and `compareKey` precedence |
| [`PROFILE_RESOLUTION.md`](PROFILE_RESOLUTION.md) | Resolving "the active game" and "the active profile for the active game" from Vortex Redux state, including the two-pass fallback |
| [`ARCHIVE_HASHING.md`](ARCHIVE_HASHING.md) | SHA-256 hashing of mod source archives — locating the archive on disk, streaming hash, bulk enrichment with bounded concurrency, why we use SHA-256 instead of the MD5 Vortex stores |

### User-facing operations (toolbar actions)

| Spec | Toolbar action |
|---|---|
| [`EXPORT_MODS.md`](EXPORT_MODS.md) | "Export Mods To JSON" — produce a snapshot of the active profile's mods |
| [`COMPARE_MODS.md`](COMPARE_MODS.md) | "Compare Current Mods With JSON" — diff a reference snapshot against the current profile |
| [`COMPARE_PLUGINS.md`](COMPARE_PLUGINS.md) | "Compare Plugins With TXT" — diff a reference `plugins.txt` against the live one |
| [`BUILD_PACKAGE.md`](BUILD_PACKAGE.md) | "Build Event Horizon Collection" — wire the snapshot pipeline into `buildManifest` + `packageEhcoll` and produce a `.ehcoll` (Phase 2 slice 4a: minimal end-to-end; per-mod UI + ID persistence are slice 4b/4c) |

### Capture extensions (Phase 1+)

| Spec | Topic |
|---|---|
| [`MOD_RULES_CAPTURE.md`](MOD_RULES_CAPTURE.md) | Capturing mod rules (`before`/`after`/`requires`/`conflicts`/`recommends`/`provides`) from Vortex state, including reference normalization and canonical sorting |
| [`FILE_OVERRIDES_CAPTURE.md`](FILE_OVERRIDES_CAPTURE.md) | Per-mod `fileOverrides` and `enabledINITweaks`, plus per-modtype deployment manifests captured via `util.getManifest` (file → winning mod ground truth) |
| [`ORDERING.md`](ORDERING.md) | Per-mod `installTime` + derived `installOrder`, and top-level `loadOrder` capture from Vortex's LoadOrder API. Why we don't store a single `deploymentPriority` number. |

### Packager (Phase 2+)

| Spec | Topic |
|---|---|
| [`MANIFEST_SCHEMA.md`](MANIFEST_SCHEMA.md) | The `.ehcoll` package manifest schema (v1) — type-by-type contract for every section, the load-bearing mod-identity rule (Nexus IDs + SHA-256 / external SHA-256-only), what's in v1 vs deferred, and the additive evolution policy |
| [`BUILD_MANIFEST.md`](BUILD_MANIFEST.md) | The pure converter from `ExportedModsSnapshot` (+ environmental inputs) to `EhcollManifest` — fatal vs non-fatal validation, identity synthesis, rule reference resolution, and v1 simplifications (empty `losingMods`, hardcoded Nexus game-domain table) |
| [`PACKAGE_ZIP.md`](PACKAGE_ZIP.md) | The `EhcollManifest` + bundled-archives → `.ehcoll` ZIP packager — staging strategy (hardlink + copy fallback), the `7z` invocation, why ZIP (not 7z) format, why identity is `(package.id, package.version)` rather than byte-equal builds, and the validation matrix |
| [`COLLECTION_CONFIG.md`](COLLECTION_CONFIG.md) | The per-collection state file (`<configDir>/<slug>.json`) — persists `package.id` across rebuilds, holds curator-edited per-mod overrides (`bundled` / `instructions`), README/CHANGELOG markdown bodies. Loaded/saved by the build action; consumed unchanged by the eventual Phase 5 React UI. |

### Resolver / installer (Phase 3+)

| Spec | Topic |
|---|---|
| [`PARSE_MANIFEST.md`](PARSE_MANIFEST.md) | The pure validator that turns a `.ehcoll` package's `manifest.json` text into a typed `EhcollManifest` — error vs warning tiers, cross-reference checks, and the round-trip property with `buildManifest` |
| [`READ_EHCOLL.md`](READ_EHCOLL.md) | The I/O wrapper around `parseManifest` — opens a `.ehcoll` ZIP via `util.SevenZip`, lists the central directory, surgically extracts `manifest.json` to a temp dir, cross-checks `bundled/` entries against `manifest.mods`, and returns a typed package layout. Closes the round-trip with `packageEhcoll`. |
| [`INSTALL_PLAN_SCHEMA.md`](INSTALL_PLAN_SCHEMA.md) | The `UserSideState` (resolver input) and `InstallPlan` (resolver output) contract — discriminated per-mod decisions (Nexus/external × already-installed/download/bundled/local-download/diverged/missing/prompt), aggregate compatibility, plugin order plan, rule plan, install-target (current-profile vs forced fresh-profile), and the `canProceed` derivation. Read by the Phase 3 resolver, action handler, eventual UI, and install driver. |
| [`RESOLVE_INSTALL_PLAN.md`](RESOLVE_INSTALL_PLAN.md) | The pure resolver — `(manifest, userState, installTarget) → InstallPlan`. Per-mod ladder for Nexus and external mods (with the mode-dependent collapse of diverged decisions in fresh-profile mode), compatibility checks, orphan detection, external-dep checks, plugin/rule plans, summary derivation, and the v1 conservative-policy invariant ("always manual-review"). Mirrors the contract in [`INSTALL_PLAN_SCHEMA.md`](INSTALL_PLAN_SCHEMA.md). |
| [`INSTALL_LEDGER.md`](INSTALL_LEDGER.md) | The on-disk receipt store at `<appData>/Vortex/event-horizon/installs/<package.id>.json` — schema, lifecycle (first install, upgrade, missing receipt, re-install, uninstall), why receipts and not Vortex mod attributes, atomic-write contract, validation rules, and the load-bearing "receipts are the only source of truth for cross-release lineage" invariant. |

## Conventions in these docs

- File paths are **always relative to the repo root** unless otherwise noted.
- "Vortex appData" means whatever `util.getVortexPath('appData')` resolves to — typically `%APPDATA%\Vortex` on Windows.
- "the user" usually means the human running our extension. When we mean "Vortex" or "the system", we say so.
- Steps that branch use indented sub-bullets; failure paths are called out explicitly with **"On failure:"**.
- Anything marked **INVARIANT** is something the rest of the system relies on; breaking it requires updating dependent specs.
- Anything marked **QUIRK** is observable behavior that's not ideal but is intentional given current constraints.

## Keeping these docs current

The rule: **a code slice that changes business behavior ships with its spec update in the same change.** Adding a new operation = adding a new spec file. Changing an existing operation = updating its spec. PRs that change behavior without updating these docs should be rejected.

Mechanical follow-ons (refactors that don't change observable behavior) don't need spec changes — but if you're not sure, write the change in prose first and see if anything in the spec needs to flip.
