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

### User-facing operations (the three toolbar actions)

| Spec | Toolbar action |
|---|---|
| [`EXPORT_MODS.md`](EXPORT_MODS.md) | "Export Mods To JSON" — produce a snapshot of the active profile's mods |
| [`COMPARE_MODS.md`](COMPARE_MODS.md) | "Compare Current Mods With JSON" — diff a reference snapshot against the current profile |
| [`COMPARE_PLUGINS.md`](COMPARE_PLUGINS.md) | "Compare Plugins With TXT" — diff a reference `plugins.txt` against the live one |

### Capture extensions (Phase 1+)

| Spec | Topic |
|---|---|
| [`MOD_RULES_CAPTURE.md`](MOD_RULES_CAPTURE.md) | Capturing mod rules (`before`/`after`/`requires`/`conflicts`/`recommends`/`provides`) from Vortex state, including reference normalization and canonical sorting |
| [`FILE_OVERRIDES_CAPTURE.md`](FILE_OVERRIDES_CAPTURE.md) | Per-mod `fileOverrides` and `enabledINITweaks`, plus per-modtype deployment manifests captured via `util.getManifest` (file → winning mod ground truth) |
| _(slice 4 → forthcoming)_ `ORDERING.md` | Install order vs. deployment priority — what they mean and why we capture both |

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
