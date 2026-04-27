# Business logic: install driver (`runInstall`)

> Spec for `src/core/installer/runInstall.ts` and the `src/core/installer/`
> support modules (`profile.ts`, `modInstall.ts`, `pluginsTxt.ts`).

The install driver is the **only** part of Event Horizon that mutates Vortex
state or the filesystem. Every other module — auditor, manifest builder,
packager, reader, resolver — is a pure transform that produces or reads
files. The driver consumes a pure {@link InstallPlan} and writes the
result of that plan to disk.

This file is the authoritative spec for what `runInstall` does. The
companion type-level contract lives in `src/types/installDriver.ts`.

---

## Slicing

The install driver lands in three slices. Each slice is independently
testable end-to-end in a real Vortex environment:

| Slice  | Scope                                                                                    | Status |
|--------|------------------------------------------------------------------------------------------|--------|
| **6a** | Fresh-profile happy path. Refuses anything that needs user input.                         | shipped |
| **6b** | Current-profile mode. Manual-review pickers (conflict + orphan). Mod uninstall primitive. | **shipped** |
| 6c     | Apply mod rules. Apply Vortex `setLoadOrder`. Drift report.                               | future |

This document describes **slices 6a + 6b's behavior**. Where slice 6c
will extend the driver, the section is marked _(future)_.

---

## Why a driver is its own thing

The line between "preview" and "install" is the line between "pure" and
"mutating." Drawing that line as a hard module boundary buys two things:

1. **Idempotent previews are cheap.** The action handler can call
   `resolveInstallPlan` repeatedly with no side effects — useful for
   "refresh preview" buttons later.
2. **The mutating code is small.** Every function that *writes* anything
   lives under `src/core/installer/`. Bugs that touch user state can
   only be in one place.

The driver is also the place where Vortex events live. The pure layers
never call `api.events.emit` or `api.store.dispatch`.

---

## Scope (slices 6a + 6b)

The driver, when given a plan and a `UserConfirmedDecisions` bundle, will:

1. **Validate** the plan + decisions in `preflight` (see "Preflight
   validation" below).
2. **Set up the install target**:
   - `fresh-profile` ⇒ create a brand-new Vortex profile for the active
     game and switch into it.
   - `current-profile` ⇒ stay on the active profile; Vortex deployment
     is left in place.
3. **Remove** mods marked for removal by the user's choices:
   - any `replace-existing` conflict choice ⇒ uninstall the
     existing mod first, then install the manifest's version,
   - any `orphan-uninstall` orphan choice ⇒ uninstall the orphaned mod.
4. **Sequentially install** every mod the plan references, branching
   on the `decision.kind` (and the user's choice when relevant):
   - `nexusDownload` (with `allowInstall: true`) for `nexus-download`,
   - `start-install-download` for `*-use-local-download`,
   - bundled-archive extract + `start-install` for `external-use-bundled`,
   - profile-enable only (no install) for `*-already-installed`,
   - `start-install` from the user's local file for
     `external-prompt-user` + `use-local-file` choice,
   - re-derived install (Nexus / bundled / local-download) for any
     `*-diverged` + `replace-existing` choice.
5. **Enable** each newly-installed mod in the active profile (current
   or fresh).
6. **Write** `plugins.txt` (with backup) when the manifest declares a
   plugin order — for the active game's local-AppData folder.
7. **Deploy** by emitting `deploy-mods` and waiting for `did-deploy`.
8. **Write** the install ledger receipt for cross-release lineage.

**Refused** in `preflight` (returns `{kind: "failed", phase: "preflight"}`):
- `plan.summary.canProceed === false`,
- `plan.compatibility.gameMatches !== true`,
- any `nexus-unreachable` or `external-missing` decision (hard
  blockers — no user choice fixes them),
- any `*-diverged` or `external-prompt-user` decision **without** a
  matching entry in `decisions.conflictChoices`,
- any `decisions.conflictChoices` entry whose `ConflictChoice.kind` is
  invalid for the corresponding decision (e.g. `use-local-file` on a
  diverged decision),
- any `decisions.orphanChoices` entry whose `existingModId` doesn't
  match an actual `OrphanedModDecision` in `plan.orphanedMods`.

**Deferred** to slice 6c (NOT applied in 6a/6b but the receipt still
records the install):
- `plan.rulePlan` (mod rules — load-after, conflict-resolution, etc.)
- Vortex `setLoadOrder` (non-plugin load-order; mostly cosmetic for
  Bethesda games where `plugins.txt` is the truth).

---

## Phases

The driver is a linear state machine:

```
preflight
  │
  ▼
creating-profile  ── only when installTarget.kind === "fresh-profile"
  │                  (dispatch setProfile)
  ▼
switching-profile ── only when installTarget.kind === "fresh-profile"
  │                  (dispatch setNextProfile, await profile-did-change)
  ▼
removing-mods    ── per mod in the removal plan, sequentially:
  │                  ┌── replace-existing  (diverged + user "Replace")
  │                  └── orphan-uninstall  (orphan + user "Uninstall")
  ▼
installing-mods   ── per mod, sequentially:
  │                  ┌── nexus-download                 │
  │                  ├── nexus-use-local-download       │   any throw →
  │                  ├── nexus-already-installed        │   { kind: "failed",
  │                  ├── external-use-bundled           │     phase, error,
  │                  ├── external-use-local-download    │     partialProfileId,
  │                  ├── external-already-installed     │     installedSoFar }
  │                  ├── *-diverged + replace-existing  │
  │                  └── external-prompt-user + use-local-file
  ▼
writing-plugins-txt ── (when pluginOrder.kind ===
  │                     "replace" and entries > 0)
  ▼
deploying ── (emit deploy-mods, await did-deploy)
  │
  ▼
writing-receipt ── (writeReceipt)
  │
  ▼
complete ──────────────────────────────────────────────────►
```

Each phase emits at least one `DriverProgress` beat. The
`installing-mods` and `removing-mods` phases emit one per mod.
`currentStep`/`totalSteps` are scoped to the phase, not the run as a
whole — there's no useful global step count.

For `current-profile` mode the `creating-profile` and
`switching-profile` phases are skipped entirely.

---

## Why `fresh-profile` is the safest path

When a user installs a `.ehcoll` and there's no install receipt for it,
the driver **forces** the install into a brand-new profile. This is a
load-bearing safety choice; full justification is in
[INSTALL_LEDGER.md](INSTALL_LEDGER.md) and
[USER_STATE.md](USER_STATE.md). Summary:

- Mods are added to Vortex's **global pool** (not "the profile"). Every
  installed mod is visible in every profile of the same game; whether
  it deploys depends on `setModEnabled(profileId, modId, true)`.
- A fresh profile starts with **zero** mods enabled. Enabling only the
  collection's mods produces a clean isolated install.
- The user's previous profile is **never** touched. Switching back in
  Vortex's UI restores the previous deployed state.
- This makes the install effectively reversible without rollback logic.

---

## Per-decision behavior

Each `ModDecision.kind` maps to exactly one install primitive:

| Decision                       | Choice required             | Primitive                          | Notes |
|--------------------------------|-----------------------------|------------------------------------|-------|
| `nexus-download`               | _none_                      | `installNexusViaApi`               | `api.ext.nexusDownload(gameId, modId, fileId, fileName, true)`. Returns archiveId; we wait for `did-install-mod`. |
| `nexus-use-local-download`     | _none_                      | `installFromExistingDownload`      | Emits `start-install-download` with the archiveId. |
| `nexus-already-installed`      | _none_                      | _(no install)_                     | Re-uses `existingModId`. Driver enables it in the active profile. |
| `external-use-bundled`         | _none_                      | `installFromBundledArchive`        | Cherry-picks the bundled entry from the `.ehcoll` ZIP into a temp dir, then `start-install` with the absolute path. |
| `external-use-local-download`  | _none_                      | `installFromExistingDownload`      | Same as Nexus local. |
| `external-already-installed`   | _none_                      | _(no install)_                     | Same re-use path as Nexus already-installed. |
| `nexus-version-diverged`       | `keep-existing` / `replace-existing` / `skip` | `installManifestEntry` (replace) | `keep-existing` ⇒ enable the existing mod in the active profile **and** carry-forward its lineage tag into the new receipt (see "Carry-forward semantics"). `replace-existing` ⇒ uninstall in `removing-mods`, then install the manifest's version. `skip` ⇒ record in `skippedMods` and do nothing else. |
| `nexus-bytes-diverged`         | same                        | same                               | same |
| `external-bytes-diverged`      | same                        | same                               | same |
| `external-prompt-user`         | `use-local-file` / `skip`   | `installFromLocalArchive`          | `use-local-file` ⇒ `start-install` with the user's local path. `skip` ⇒ no-op. SHA-256 is **not** verified post-install in v1. |
| `external-missing`             | _refused in preflight_      | _N/A_                              | Hard block — strict manifest declares no user-side recovery. |
| `nexus-unreachable`            | _refused in preflight_      | _N/A_                              | Hard block — manifest is structurally bad for the user's environment. |

`skip` choices on `*-diverged` and `external-prompt-user` decisions
are recorded in `result.skippedMods` for the result dialog. Receipt
write skips them too — only mods actually installed (or carried
forward; see below) are recorded.

### Carry-forward semantics

Two user choices in current-profile mode produce a mod that ends up
in the new receipt **without being re-installed**:

1. **`*-diverged` + `keep-existing`** — the user chose to stick with
   their version. The driver:
   - calls `enableModInProfile(api, profileId, decision.existingModId)`
     so the collection actually receives the mod (a globally-installed
     mod might be disabled in the active profile),
   - records a `CarriedModReportEntry` with
     `reason: "diverged-keep-existing"` and
     `enabledInProfile: true`,
   - includes the mod in `receipt.mods` so future releases that drop
     this `compareKey` will see it as an orphan.

2. **Orphaned mod + `keep` choice** — the user wants the orphan to
   stay. The driver:
   - does NOT touch the mod's enabled state ("keep" means "leave
     alone"),
   - records a `CarriedModReportEntry` with `reason: "orphan-keep"`
     and `enabledInProfile: false`,
   - includes the mod in `receipt.mods` so the lineage tag survives
     into the next release.

Without carry-forward, kept mods would silently lose their lineage
on the next install of the same collection: orphan detection would
miss them, and a future "we no longer reference this mod" decision
would never be made. The receipt is the only authoritative source for
"this collection currently controls these mods on this machine."

Carry-forward only occurs in current-profile mode. The resolver
collapses `*-diverged` decisions and produces no orphans in
fresh-profile mode, so `result.carriedMods` is always empty there.

---

## User-confirmed decisions (`UserConfirmedDecisions`)

The driver itself never prompts the user. The action handler collects
all decisions up-front (via the picker chain) and passes them in
`DriverContext.decisions`:

```ts
type UserConfirmedDecisions = {
  conflictChoices?: Record<string /* compareKey */, ConflictChoice>;
  orphanChoices?:   Record<string /* existingModId */, OrphanChoice>;
};

type ConflictChoice =
  | { kind: "keep-existing" }
  | { kind: "replace-existing" }
  | { kind: "use-local-file"; localPath: string }
  | { kind: "skip" };

type OrphanChoice =
  | { kind: "keep" }
  | { kind: "uninstall" };
```

### Preflight validation

`preflight` runs four checks:

1. **Compatibility gate** — `plan.summary.canProceed === true` and
   `plan.compatibility.gameMatches === true`.
2. **Hard blockers** — no `nexus-unreachable` or `external-missing`
   decision is present.
3. **Required choices present** — every `ModResolution` whose
   decision needs user input (any `*-diverged` or `external-prompt-user`)
   has a matching `conflictChoices[compareKey]` entry.
4. **Choice validity** — every supplied choice is logically valid for
   its decision:
   - `*-diverged` decisions accept `keep-existing` / `replace-existing` / `skip`,
   - `external-prompt-user` accepts `use-local-file` / `skip`,
   - `use-local-file` requires a non-empty `localPath`,
   - `orphanChoices` keys match an actual `OrphanedModDecision`.

Failing any check ⇒ `{kind: "failed", phase: "preflight"}` with a
descriptive error string. The action handler's gate runs the same
hard-blocker check, so this branch is unreachable in practice but
serves as a defensive backstop.

### Removal plan

A separate pre-pass over `(plan, decisions)` builds the removal plan:

- one entry per `replace-existing` conflict choice (uninstall before
  install),
- one entry per `orphan-uninstall` orphan choice (uninstall the
  orphaned mod).

The removal plan runs in the `removing-mods` phase, **before**
`installing-mods`, so any mod being replaced is gone before its new
version is installed. This avoids Vortex flagging the install as a
duplicate when both the existing and new versions briefly coexist.

The removal primitive is `uninstallMod(api, gameId, modId)`, which
wraps Vortex's `util.removeMods`. This removes the mod from disk,
clears its entries in `state.persistent.mods`, and unselects it in
every profile. It does **not** trigger a deploy — that happens once
at the end of the install.

Removed mods are tracked in `result.removedMods` (a
`RemovedModReportEntry[]`) for the result dialog.

---

## `plugins.txt` write

When `plan.pluginOrder.kind === "replace"` and the manifest declares any
plugin entries, the driver writes `%LOCALAPPDATA%/<game>/plugins.txt` to
match `manifest.plugins.order` exactly.

**Two formats** depending on game:

- **Asterisk format** (Skyrim LE/SE, Fallout 4, Starfield):
  - `*Plugin.esm` for enabled.
  - `Plugin.esm` for present-but-disabled.
  - **Encoding: UTF-16 LE with BOM**, `CRLF` line endings.
- **Legacy format** (Fallout 3, Fallout NV):
  - Enabled-only list, no prefix.
  - Disabled entries are omitted from the file.
  - Encoding: UTF-8.

**Backup**: before overwriting, the existing file (if any) is copied to
`plugins.txt.eh-backup-<unix-ms>`. Per-run unique suffix avoids
trampling earlier backups. The user can restore manually.

The parent directory is created if missing — possible when the user has
never launched the game on this machine.

The write is atomic: temp file + `rename`. If the process dies
mid-write, the original (or its absence) is preserved.

---

## Deployment

The driver triggers Vortex's deployment pipeline by emitting:

```ts
api.events.emit("deploy-mods", profileId, callback);
```

It then waits for the canonical `did-deploy` event for the same
profileId. Both the callback's error path and the `did-deploy` event
are listened to; the timeout is 5 minutes (deployments of 100s of mods
on slow disks can take minutes).

The driver does NOT call `purge-mods` first — switching profiles
already triggers an automatic purge of the previous profile's
deployment. Doing it twice would just slow things down.

---

## Receipt write

After successful deploy, the driver builds an `InstallReceipt` from:

- `plan.manifest.package.{id, version, name}` — collection identity.
- `plan.manifest.game.id` — game id.
- `installedAt` — current ISO-8601 timestamp.
- `vortexProfileId` / `vortexProfileName` — the active profile (new or
  current).
- `installTargetMode` — `"fresh-profile"` or `"current-profile"`,
  taken from `plan.installTarget.kind`.
- `mods` — one `InstallReceiptMod` per:
  - successfully-installed mod, plus
  - mod carried forward into the new release (diverged-keep-existing
    or orphan-keep; see "Carry-forward semantics").

  `*-already-installed` decisions are also recorded — they're part of
  the collection's install state too. `skip` choices are NOT recorded.

The receipt is written via `writeReceipt(appDataPath, receipt)` which
uses an atomic tmp+rename and self-validates by parse-on-write. The
driver wraps it in a one-retry-after-250ms loop to absorb transient
filesystem stutters (antivirus locking the temp file, parallel I/O
contention) — failures that clear in <100ms in practice.

If both attempts fail the driver returns
`{kind: "failed", phase: "writing-receipt"}`. The install is otherwise
complete on disk (mods installed, `plugins.txt` written, deploy ran).
The user can re-run the install; the resolver will detect the existing
mods and the next attempt will short-circuit most decisions to
`*-already-installed`, then write the receipt. **Caveat:** without a
receipt, the second run will fall through `pickInstallTarget` to
fresh-profile mode and create a new empty profile rather than
re-using the one we just populated. The action handler surfaces the
receipt path on success precisely so the user can detect this case
(missing receipt) and either retry promptly or escalate.

---

## Failure semantics

The driver **does not roll back**. Three reasons:

1. **Rollback is unsound at this scope.** Vortex's mod pool is shared
   across profiles; deleting a mod that the user happens to have
   independently selected in another profile would silently break
   that profile. We refuse to play that game.
2. **Partial state is observable and useful.** A failure during the
   12th of 47 mods leaves 11 mods properly installed, deployable,
   and visible in the new profile. The user can fix the underlying
   issue (network, disk, Nexus auth) and re-run; the resolver's
   already-installed detection picks up where the failure left off.
3. **Idempotence-on-retry is more useful than rollback.** The receipt
   isn't written until after deploy succeeds, so a re-run starts from
   the same lineage state as the first run (no receipt → fresh
   profile mode again). The new profile is created from scratch each
   time; the user can delete the previous failed profile from
   Vortex's UI when they're confident the retry succeeded.

The `InstallFailed` result carries:
- `phase` — which phase broke,
- `partialProfileId` — the new profile (if it was created); for
  `current-profile` mode this is the active profile id (the profile
  itself wasn't created by the driver),
- `error` — one-line summary,
- `installedSoFar` — Vortex mod ids of mods that DID install.

The action handler renders all of this in the post-install dialog.

For `current-profile` mode, partial-state also includes mods that
were uninstalled in the `removing-mods` phase before the failure.
Those mods are gone from Vortex and must be reinstalled if the user
wants to revert.

---

## Cancellation

`DriverContext.abortSignal` is cooperative. The driver checks it at
phase boundaries — it does **not** interrupt in-flight Vortex
operations (you can't safely kill a download mid-stream without
risking corrupted archives in the cache).

When the signal aborts, the driver returns
`{kind: "aborted", phase, partialProfileId, reason}`. Same partial-state
guarantees as a failure.

The action handler in slice 6a does not pass an `abortSignal`. Slice
6b's UI may add a Cancel button that wires one up.

---

## Concurrency

Mod installs run **sequentially**. Vortex's install pipeline serializes
internally — FOMOD UI is modal, the global download queue serializes
above a configurable limit, and the `start-install-download` event
chains into the same queue. Parallel calls would just contend for the
same lock.

Sequential is also the simplest mental model for the user-visible
progress notification. A bar that says "installing mod 7 of 23" is
something the user understands; a bar that says "47% installed across
6 concurrent operations" is not.

---

## What the driver does NOT do (slices 6a + 6b)

- ❌ Apply `manifest.rules`. Slice 6c.
- ❌ Apply Vortex `setLoadOrder`. Slice 6c.
- ❌ Verify SHA-256 of `use-local-file` archives. The user is trusted
  to provide the right file; Phase 5 UI may add a verification step.
- ❌ Verify SHA-256 of downloaded archives post-install. The resolver
  matches what the user already has; downloads are trusted to be
  byte-correct because they come from Nexus's CDN. (Slice 6c may add
  a defensive check.)
- ❌ Verify external dependencies (`plan.externalDependencies`). The
  external-deps verification flow is its own project (Phase 4); the
  driver records what was installed and the user-side verifier is a
  separate action.
- ❌ Write README/CHANGELOG into the per-collection state file. The
  packager produces them; future Phase 5 UI surfaces them. The
  driver doesn't need to copy them anywhere.
- ❌ Re-prompt the user mid-run. All decisions are collected up-front
  by the action handler. Phase 5 React UI may add mid-run recovery
  flows.
- ❌ Roll back removed mods on failure. `removing-mods` runs before
  `installing-mods`; if the install fails after a removal, the
  removed mod stays gone.

---

## Per-module breakdown

### `src/core/installer/profile.ts`

Three exported functions, all narrowly scoped:

- `createFreshProfile(api, gameId, suggestedName)` — dispatches a new
  `IProfile` into Vortex's store with a UUIDv4 id. Picks a non-colliding
  display name by appending `" (2)"`, `" (3)"`, ... if needed.
- `switchToProfile(api, profileId)` — dispatches `setNextProfile` and
  awaits the `profile-did-change` event for that profileId. 30 s
  timeout; usually completes in seconds.
- `enableModInProfile(api, profileId, modId)` — dispatches
  `setModEnabled`. The driver batches enables; deploy at end of
  install.

`pickNonCollidingName` is exported for future tests; the driver only
needs the three above.

### `src/core/installer/modInstall.ts`

Five primitives + helpers:

- `installNexusViaApi` — calls `api.ext.nexusDownload(...)` with
  `allowInstall=true`, then waits for `did-install-mod` for the
  resulting archiveId. Returns `{archiveId, vortexModId}`.
- `installFromExistingDownload` — emits `start-install-download` with
  the archiveId, waits for `did-install-mod`. Returns
  `{vortexModId}`.
- `installFromBundledArchive` — cherry-picks one bundled entry out of
  the `.ehcoll` ZIP into a fresh temp dir, then races a
  `start-install` callback against `did-install-mod`. Returns
  `{vortexModId, extractedPath}` so the caller can clean up the temp
  dir at end of run.
- `installFromLocalArchive` — `start-install` against an arbitrary
  user-supplied disk path (used for `external-prompt-user` +
  `use-local-file`). Returns `{vortexModId}`.
- `uninstallMod` — wraps Vortex's `util.removeMods(api, gameId,
  [modId])`. Removes the mod from disk, clears its entries in
  `state.persistent.mods`, and unselects it in every profile. Used
  by `removing-mods` for `replace-existing` and `orphan-uninstall`.
- `extractBundledFromEhcoll` — exposed helper; uses
  `sevenZip.extract(zipPath, tempDir, {$cherryPick: [bundledZipEntry]})`.
- `safeRmTempDir` — best-effort temp cleanup (errors swallowed; OS
  GCs `os.tmpdir()` eventually).

The 10-minute install timeout is generous on purpose: real FOMOD
installs of large mods (textures, ENB packages) routinely take 30–60s
on slow disks. The user is far more annoyed by a false-positive
timeout than by waiting a minute longer.

### `src/core/installer/pluginsTxt.ts`

Two exported functions:

- `resolvePluginsTxtPath(gameId)` — returns
  `%LOCALAPPDATA%/<game-folder>/plugins.txt`. Throws on unsupported
  game.
- `writePluginsTxtWithBackup({gameId, entries})` — backs up the
  existing file (if any) to a unique suffix, then atomically writes
  the manifest's order in the right format/encoding for the game.

`serializePluginsTxt(gameId, entries)` is exposed for tests / future
in-process diff previews.

### `src/core/installer/runInstall.ts`

The orchestrator. Public surface is one function, `runInstall(ctx)`.
Internally:

- `preflight(plan, decisions)` — synchronous validation. Refuses
  non-canProceed plans, hard-blocker decisions, missing/invalid user
  choices.
- `collectRemovalPlan(plan, decisions)` — pure pre-pass that produces
  a `RemovalItem[]` from `replace-existing` conflict choices and
  `orphan-uninstall` orphan choices.
- `executeDecision(...)` — `switch`-on-`decision.kind`. Each arm
  delegates to a primitive in `modInstall.ts`, short-circuits
  (already-installed cases), or branches into:
  - `executeDivergedChoice(...)` for `*-diverged` decisions —
    consults `decisions.conflictChoices[compareKey]` to pick
    `keep-existing` (re-use existing modId) / `replace-existing`
    (delegate to `installManifestEntry`) / `skip` (no-op).
  - `executePromptUserChoice(...)` for `external-prompt-user` —
    `use-local-file` ⇒ `installFromLocalArchive` / `skip` ⇒ no-op.
  - `installManifestEntry(...)` — re-derives the install path for a
    `replace-existing` choice from the manifest entry (Nexus or
    External). Reuses `installNexusViaApi` /
    `installFromBundledArchive` / `installFromExistingDownload` as
    appropriate.
- `deployAndWait(api)` — emits `deploy-mods`, waits for `did-deploy`.
- `buildReceipt(...)` — pure transform from driver state into the
  ledger schema; uses `plan.installTarget.kind` for
  `installTargetMode`.

---

## Failure modes (cataloged)

| Phase                  | Likely failure                                                | Result kind | Surfaced as |
|------------------------|---------------------------------------------------------------|-------------|-------------|
| `preflight`            | hard-blocker decisions / missing or invalid user choices       | `failed`    | "Plan contains 1 hard-blocker..." / "Missing conflict choice..." |
| `creating-profile`     | (none in practice — pure dispatch)                             | _N/A_       | _N/A_ |
| `switching-profile`    | Vortex deployment lock; another switch in flight              | `failed`    | "Profile switch did not complete within 30s." |
| `removing-mods`        | `util.removeMods` rejects (race; mod already deleted manually) | `failed`    | "Failed uninstalling X: Y." |
| `installing-mods`      | network failure on Nexus download; FOMOD UI cancellation       | `failed`    | "Failed installing X (decision=Y): Z." |
| `installing-mods`      | bundled archive cherry-pick fails (corrupt `.ehcoll`)          | `failed`    | "7z failed to extract..." |
| `installing-mods`      | `did-install-mod` timeout (10 min)                             | `failed`    | "Mod install did not complete within 600s." |
| `installing-mods`      | user-supplied local file missing / unreadable                  | `failed`    | "Failed installing X from <path>: ENOENT." |
| `writing-plugins-txt`  | OS-level write failure (rare; permissions, disk full)          | `failed`    | "Failed writing plugins.txt: <errno>." |
| `deploying`            | deployment timeout (5 min); `deploy-mods` callback error       | `failed`    | "Deployment failed: <reason>." |
| `writing-receipt`      | `InstallLedgerError` (atomic write race); disk full            | `failed`    | "Failed writing install receipt: <reason>." |

In all `failed` cases the partial profile is preserved. The user can
switch back to it later or delete it from Vortex's UI.

---

## Action-handler integration

The action (`src/actions/installCollectionAction.ts`) wraps the driver:

1. After `resolveInstallPlan` returns, the action runs
   `isPlanInstallable(plan)` — checks `canProceed` and the absence of
   hard blockers (`nexus-unreachable`, `external-missing`).
2. If installable, the dialog shows `[Cancel, Install]`; otherwise
   `[Close]` only.
3. On Install click, the action runs `collectUserDecisions(plan)` —
   one `showDialog` per `*-diverged` / `external-prompt-user` mod
   plus one per orphan. The user picks `keep` / `replace` / `skip`
   for conflicts and `keep` / `uninstall` for orphans. Cancellation
   at any prompt aborts the install.
4. The action builds a `DriverContext` with the collected decisions,
   supplies an `onProgress` callback that updates an activity
   notification, and invokes `runInstall`.
5. The result (`success` / `aborted` / `failed`) is rendered in a
   second dialog plus a final notification.

The action does **not** retry, prompt for user input mid-install, or
inspect intermediate driver state. All that policy lives in the
driver. Decisions flow exclusively through `UserConfirmedDecisions`.

The action **does** validate one thing the driver cannot: stale
install receipts. If `readReceipt` returns a receipt but its
`vortexProfileId` no longer exists in Vortex state (the user deleted
the profile), the action prompts the user to choose between:

- **Treat as fresh install** — delete the receipt; the install lands
  in a brand-new empty profile (the safe default; matches first-time
  install semantics).
- **Use current profile anyway** — keep the receipt; the install
  merges into the user's currently active profile. Only correct when
  the user intentionally wants lineage to carry across the deleted
  profile.
- **Cancel** — abort without modifying anything.

Without this check, `pickInstallTarget` would default to
`current-profile` mode based on the receipt's mere presence and
silently merge an unrelated collection into whatever profile happened
to be active.

---

## Acknowledged gaps

These are known limitations that v1 explicitly does not address.
They are not bugs — each has a documented rationale for being
deferred. Phase 5 (React UI) is the natural place to revisit any of
them.

- **D1 — No SHA-256 verification post-install.** The driver trusts
  Vortex's install pipeline. For `use-local-file` choices the user
  could pick a wrong file and we'd happily install it; for bundled
  archives we trust the curator-side `archiveSha256` matches the
  bytes in the `.ehcoll` ZIP (verified by `readEhcoll` on read, but
  not re-verified per-mod at install time). A Phase 5 enhancement
  could rehash post-install and surface mismatches in the drift
  report.

- **D2 — Manifest entries are looked up by `compareKey`.** The driver
  no longer relies on the resolver's positional invariant
  (`manifest.mods[i] ↔ plan.modResolutions[i]`). Lookup is via
  `Map<compareKey, EhcollMod>`. A resolver that produced a resolution
  with no matching manifest entry is rejected with an internal-error
  failure rather than indexed-into-undefined.

- **D3 — Removed mods are NOT restored on later-phase failure.** If
  the `removing-mods` phase succeeds (uninstalling A, B, C) but the
  next phase fails, A/B/C are gone and the user is left with a
  half-applied state. Reinstall by re-running the install (the
  resolver will plan their re-installation as `*-already-installed`
  for the new manifest version, or as a fresh install for orphans).
  This is consistent with the "no rollback, idempotent retry"
  philosophy.

- **D4 — Deploy timeout = 5 minutes.** If Vortex actually completes
  the deployment after the timeout fires, the driver still reports
  `{kind: "failed", phase: "deploying"}` and the receipt is never
  written. The deploy itself is fine on disk, but the missing
  receipt forces the next attempt into fresh-profile mode again.
  Surface area: very large collections (500+ mods) on slow disks.

- **H3 (mitigated, not eliminated) — `did-install-mod` listener
  fallback.** The bundled-archive and local-archive primitives now
  fire `start-install` AND attach a `did-install-mod` listener that
  accepts the first event for our gameId after registration
  (`acceptAny: true`). If the user starts a second unrelated install
  in the same Vortex session within the timeout window (10 minutes),
  the listener could grab the wrong event. Acceptable trade-off: the
  synchronous callback path wins in the common case, and the
  alternative (no fallback) had a real failure mode of timing out
  for 10 minutes on Vortex builds where the callback didn't fire.

- **H5 (mitigated) — Receipt-write retry.** The driver retries the
  receipt write once after a 250ms delay before reporting failure.
  This handles transient AV scans and filesystem stutters but does
  not protect against permanent issues (disk full, permissions). On
  hard failure the install is on disk but unreceiped; users must
  re-run.

---

## Open questions for slice 6c / Phase 5

- **Mod rule application timing**: rules can be applied either
  before or after deploy. Vortex's vanilla collections apply
  before. We'll match. Slice 6c.
- **Conflict picker UI**: per-mod `showDialog` is fine for collections
  with a handful of conflicts but tedious at 50+. Phase 5's React
  panel batches everything into a single table.
- **Drift report on success**: compare what was installed against
  the manifest's curator-side hashes; surface deltas. Slice 6c.
- **Nexus auth fallback**: if `api.ext.nexusDownload` is missing
  (Nexus extension disabled / not logged in), today we fail
  installing-mods with a hard error. Phase 5 may add a
  "Log in to Nexus" recovery action.
- **SHA-256 verification of `use-local-file`**: v1 trusts the user's
  picked file. Phase 5 may verify on install and re-prompt on
  mismatch.

---

## Related documents

- [INSTALL_PLAN_SCHEMA.md](INSTALL_PLAN_SCHEMA.md) — the input contract.
- [RESOLVE_INSTALL_PLAN.md](RESOLVE_INSTALL_PLAN.md) — how the plan is built.
- [USER_STATE.md](USER_STATE.md) — `UserSideState` builder + `pickInstallTarget`.
- [INSTALL_ACTION.md](INSTALL_ACTION.md) — toolbar action that wraps the driver.
- [INSTALL_LEDGER.md](INSTALL_LEDGER.md) — receipt schema + lifecycle.
- [../PROPOSAL_INSTALLER.md](../PROPOSAL_INSTALLER.md) — overall design doc.
- [../ARCHITECTURE.md](../ARCHITECTURE.md) — file-by-file index.
