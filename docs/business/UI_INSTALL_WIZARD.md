# UI Install Wizard — Phase 5.1

The React replacement for the install toolbar action's `showDialog` chain. A multi-step wizard that takes the user from "I have a `.ehcoll` file" through to "the collection is installed" without the modal-stacking that plagued the legacy flow.

> **Status:** shipped — the `install` route renders the wizard. The legacy toolbar entry (`Event Horizon: Install (legacy dialog)`) remains as a known-good fallback while testers exercise the UI.

---

## Trigger

| Source | What happens |
|---|---|
| User clicks the **Install** tab in the EH nav | `EventHorizonMainPage` switches the route to `install`, mounts `<InstallPage>`. |
| User clicks the **Install** CTA on the dashboard | Same as above — dashboard calls `props.onNavigate("install")`. |
| User clicks the **Install another** button on the wizard's done step | Same as the dashboard CTA — keeps the user inside the wizard. |
| User runs the legacy toolbar action | Falls through to `installCollectionAction.ts`, **not** this wizard. |

The wizard mounts in the `pick` state every time. There is no deep-linking to a specific step; resuming a half-finished install is not modeled — testers either complete or "Start over".

## Preconditions

- Vortex has an active game and an active profile for that game (the wizard surfaces a clear error if not, instead of crashing).
- The active game id is one of the supported set: `skyrimse`, `fallout3`, `falloutnv`, `fallout4`, `starfield` — otherwise the loading pipeline rejects with an actionable message.
- The user has a `.ehcoll` package on disk somewhere reachable.
- The provider stack is in place: the page lives inside `ApiProvider → ErrorProvider → ToastProvider → AppErrorBoundary` (set up by `EventHorizonMainPage`).

## Inputs

| Source | Used for |
|---|---|
| `useApi()` | Vortex `IExtensionApi` for state reads, file picks, and driver calls |
| `pickModArchiveFile(api)` | The shared file-picker utility (lifted from the legacy action) |
| Vortex Redux state (`api.getState()`) | Active game / profile / mods / version readers in the loading pipeline |
| `<appData>/Vortex/event-horizon/installs/<package.id>.json` | Existing receipt for stale-detection and lineage |
| Mod source archive(s) referenced by the active profile | SHA-256 hashing during the snapshot pipeline |
| The selected `.ehcoll` ZIP | `readEhcoll` reads + parses + cross-checks bundled archives |

The wizard owns no Redux state and writes nothing to Redux. State lives in a `useReducer`-backed discriminated union (`WizardState`).

## Behavior

### 1. State machine

`WizardState` is a discriminated union; only one state is "live" at any time.

```
pick
  ↓ pick-file
loading ──→ stale-receipt   (only if a receipt points at a profile that no longer exists)
  ↓ plan-ready                ↓ keep / delete / cancel
preview ←──────────────── (re-runs second half of loading)
  ↓ open-decisions
decisions ↔ preview          (back-to-preview)
  ↓ open-confirm
confirm ↔ decisions          (back-from-confirm)
  ↓ start-install
installing
  ↓ install-result
done

Any state → error  (set-error)  → reset → pick
```

State transitions live in `wizardReducer`. The reducer is **strictly defensive**: each action checks `state.kind` before applying, so out-of-sequence dispatches (e.g. an old `install-progress` arriving after `install-result`) are no-ops instead of corrupting state.

### 2. The PickStep

Single screen with:
- The animated `EventHorizonLogo` at 96 px.
- A short tagline.
- One primary button: "Pick a `.ehcoll` package…". Clicking it calls `pickModArchiveFile(api)`; on resolve the wizard dispatches `pick-file` with the chosen path.
- Toast feedback if the user cancels the picker (info intent, "No file picked").

### 3. The loading pipeline (`runLoadingPipeline`)

A single async helper that mirrors the call sequence in `installCollectionAction.ts` but reports phase events to the reducer:

| Phase | Work | Reducer event |
|---|---|---|
| `reading-package` | `readEhcoll(zipPath)` opens + parses the ZIP | `loading-phase` |
| `checking-game` | Asserts active game equals `manifest.game.id` and is supported | `loading-phase` |
| `reading-receipt` | `readReceipt(appData, manifest.package.id)` | `loading-phase` |
| `hashing-mods` | `enrichModsWithArchiveHashes` over the active profile's mods (concurrency 4); also reports the count to render a stable progress ring | `loading-phase` with `hashCount` |
| `resolving-plan` | Builds `UserSideState`, picks `InstallTarget` (fresh-profile vs current), runs `resolveInstallPlan` | `loading-phase` |

If `readReceipt` returns a receipt **and** the receipt's profile id no longer exists in Vortex state, the helper returns a `stale-receipt` outcome instead of continuing — the wizard shows `StaleReceiptStep` and lets the user resolve the conflict before re-running the second half (`runLoadingPipelineWithReceipt`).

The "alive ref" pattern (a `let alive = true; … return () => { alive = false }` cleanup) guards every `dispatch` so navigating away mid-pipeline never sets state on an unmounted component.

### 4. The StaleReceiptStep

Renders three actions:

| Button | Effect |
|---|---|
| **Keep receipt and force fresh profile** | Re-runs the loading pipeline with `keepReceipt=true`; the resolver picks fresh-profile mode because the active profile id ≠ receipt profile id. |
| **Delete receipt and start fresh** | `deleteReceipt(appData, packageId)` → re-runs the pipeline with `receipt=undefined` (no lineage). |
| **Cancel** | Dispatches `reset`; back to `pick`. |

The step describes both options in plain English so testers understand the trade-off (keep history vs start clean).

### 5. The PreviewStep

The user's first look at the plan. Layout:

| Region | Contents |
|---|---|
| Header | Package name + version + author, "Targeting profile X (current / fresh)" pill |
| Verdict pill | `installable` / `manual-review` / `blocked` from `plan.summary.verdict` |
| Mod summary tiles | Counts: total mods, already-installed, will-download, bundled, divergences, missing externals, orphans |
| External-deps section | Per-dep status: present, missing, prompt-user |
| Plugin order plan | Compact table — top 8 entries + "+N more" |
| Mod rules plan | Counts of `before`/`after`/`requires`/`conflicts` to be applied |
| Footer | "Continue" (proceeds to decisions) and "Cancel" (resets) |

Continue is disabled when `plan.summary.canProceed === false` (hard blockers like `nexus-unreachable` / `external-missing`); the disabled state surfaces a tooltip explaining why.

### 6. The DecisionsStep

The per-mod conflict and orphan picker. Two collapsible sections.

**Conflicts** — one row per `ModResolution` returned by `selectConflictResolutions(bundle)`:
- `nexus-version-diverged`, `nexus-bytes-diverged`, `external-bytes-diverged`: choices `keep-existing` (default) or `replace`.
- `external-prompt-user`: choices `provide-archive` (paired with a file picker) or `skip`.

Each conflict row shows:
- The mod name + the curator's notes (if `instructions` is set on the manifest entry).
- The two competing identities (existing version, manifest version, hashes if available).
- A radio group bound to the row's `conflictChoices[compareKey]` slot.

**Orphans** — one row per `OrphanedModDecision`:
- `existing` choice → keep the existing local mod.
- `uninstall` choice → tear it down with the rest of the collection.
- Default is `keep` (least destructive).

`canProceedFromDecisions(bundle, conflictChoices)` enables / disables the "Continue" button — every conflict must have either an explicit choice or a sensible default (the default ladder lives in `defaultConflictChoice`).

### 7. The ConfirmStep

A final pre-flight summary. The wizard precomputes the `UserConfirmedDecisions` by filling defaults for anything the user didn't explicitly pick (`fillDefaultConflictChoices` / `fillDefaultOrphanChoices`). The step renders:

- "About to install <package> v<version>" hero strip.
- Bullet summary of every decision the user made (replace 3 mods, uninstall 2 orphans, etc.).
- Profile target reminder ("This will install into a brand-new profile called X" or "This will install into your current profile X").
- Big "Install" button (primary) + "Back" (returns to decisions, preserving choices).

### 8. The InstallingStep

Once the user clicks "Install", the page mounts an effect that calls `runInstall(...)` from `core/installer/runInstall.ts`. The driver streams `DriverProgress` events; the step renders:

- The `EventHorizonLogo` next to a phase label ("Creating profile…", "Installing mod 4 of 12: Skyland AIO", "Writing receipt…").
- A `ProgressRing` reflecting the driver's phase / step progress.
- A scrolling activity feed (last ~20 events) so testers can see the driver narrate what it's doing.
- No cancel button — the driver doesn't support clean abort yet (acknowledged gap in INSTALL_DRIVER.md).

When the driver resolves with `InstallResult`, the wizard transitions to `done`. Any thrown error transitions to `error`.

### 9. The DoneStep

Outcome screen. Branches on `result.kind`:

| Kind | Visual |
|---|---|
| `success` | Green pill, "Installed v1.0.0 into profile X", counts of mods installed / orphans handled / receipt path. CTAs: "Switch back to my old profile" (toast on success), "Open My Collections" (navigates), "Install another" (resets). |
| `aborted-precheck` | Amber pill, lists the precheck reasons (mismatched game, etc.). CTA: "Start over". |
| `failed-mid-install` | Red pill, references the orphaned profile by name and tells the user it was preserved for inspection. CTA: "Start over". |

The step doesn't decide whether to switch profiles — the driver already created the profile and (for fresh-profile target) switched into it. The "Switch back" button lets the user pop out without losing the install.

### 10. The error-recovery view (`ErrorRetry`)

When `set-error` fires, the step is replaced with `ErrorRetry`. It renders the formatted error's `title` and `message` and a single "Start over" CTA. The full technical report is already open in the global `ErrorReportModal` (the wizard's effect calls `reportError(err, …)` before dispatching `set-error`). The user can copy the report, then retry.

## Outputs

| Output | When |
|---|---|
| `pickModArchiveFile` opens an OS file dialog | User clicks pick |
| `readEhcoll` extracts `manifest.json` to a temp dir under `<appData>/Vortex/temp/event-horizon/<rand>/` | Loading phase 1 |
| `enrichModsWithArchiveHashes` reads up to N source archives (concurrency 4) | Hashing phase |
| `runInstall` writes — see `INSTALL_DRIVER.md` for the full list (creates a profile, downloads / installs mods, writes a receipt, deploys, etc.) | Install phase |
| Toast notifications for non-blocking events ("No file picked", "Switched to profile X") | UX feedback |
| `formatError(err, …)` + global modal | Any thrown error |

The wizard does not modify Vortex state directly — every mutation goes through `core/installer/runInstall.ts`.

## Failure modes

| Symptom | Likely cause | Mitigation |
|---|---|---|
| "No active game in Vortex" error during loading | User mounted the page without selecting a game first | Switch to the target game in Vortex's selector and click "Pick a `.ehcoll` package…" again. |
| "Active game is not supported" | User is on an unsupported Creation Engine game (e.g. Morrowind) | Wait for that game to be added or use a different installer. The loading pipeline guards on `SUPPORTED_GAME_IDS`. |
| Wizard appears stuck on "Hashing mods…" | A very large source archive blocks the hash worker; concurrency is 4 | Check Vortex's downloads folder; the hash will eventually complete. Force-cancelling with "Start over" is safe — no state was written yet. |
| Stale-receipt prompt loops | The user clicks "Keep receipt" but the active profile still doesn't exist | The next pipeline run still ends in `stale-receipt`. The user must either pick a different game/profile in Vortex or click "Delete receipt". |
| `runInstall` throws mid-install | Driver crashed; profile may exist with partial mods | The `failed-mid-install` done step preserves the profile name; user can switch into it from the Vortex profile picker and salvage what installed. |
| The progress ring never fills | The driver isn't emitting `DriverProgress` (an integration bug, not user error) | Wait for completion / abort. Open an issue with the install report from the modal. |
| Continue is disabled on Preview but plan looks fine | A hard blocker (e.g. external dep marked `missing` with no provided archive) lurks under the summary | Open the plan's full preview tree; any `external-missing` / `nexus-unreachable` row needs to be resolved at the curator level (re-bundle or update the source URL). |

## Quirks & invariants

- **INVARIANT: the wizard never mutates Vortex state outside of `runInstall`.** Reading state, hashing archives, parsing manifests are all read-only. The only writer is the driver call.
- **INVARIANT: every async effect uses an alive ref.** Navigating away from the install route mid-load / mid-install causes the cleanup to flip `alive=false`, suppressing late dispatches. State staying consistent if the user toggles routes is a load-bearing assumption — without it React 16 logs "set state on unmounted component" warnings into Vortex's renderer console.
- **INVARIANT: the reducer is pure.** No side effects, no `Date.now()`, no API calls. All side effects sit in effects / event handlers; the reducer is a `(state, action) → state` function.
- **The `loading` and `installing` effects depend on stable identifiers** (`zipPath` / `package.id` respectively), not on the entire state. This means setting an unrelated field (e.g. `progress`) doesn't re-trigger the pipeline.
- **`PickStep` is also rendered as a fallback in the exhaustiveness branch.** If TypeScript ever lets through a state we don't handle, the user sees the home of the wizard, not a blank screen.
- **The wizard owns its `key` only at the route level.** Navigating from `install` to `collections` and back remounts everything → `pick` state. This is intentional: ambient state ("a half-prepared plan") shouldn't survive navigation.
- **QUIRK:** The decisions step uses `compareKey` (defined in AUDITOR_MOD.md) as the React `key` for conflict rows. If two distinct mods ever produce the same `compareKey`, React would deduplicate rows. This is impossible by construction (compareKey is unique per identity tuple) but bears noting.
- **No "save my decisions and come back later".** A reload restarts the wizard. Worth adding only if testers actually ask.

## Acknowledged gaps

- **No drag-and-drop on the pick step.** Vortex's renderer doesn't expose a `webkitGetAsEntry` flow easily; pick-from-dialog is the only path today.
- **No live "validation badge" while editing decisions.** The "Continue" button gates correctness, but per-row validation hints (e.g. "you replaced this mod but its archive is missing on disk") aren't shown until the next step.
- **No undo on the orphan section.** Once the user switches an orphan to "uninstall" and clicks Install, the driver removes the mod with no second confirmation. We rely on the confirm step's bullet summary as the safety net.
- **No way to inspect the full plan as JSON from the wizard.** Useful for bug reports — currently testers must dig into the temp dir or rely on the global error modal's Save Report.

## Code references

| File | What it owns |
|---|---|
| `src/ui/pages/install/InstallPage.tsx` | The wizard shell — owns the reducer, runs the loading + installing effects, branches on `state.kind`, owns the `ErrorRetry` view |
| `src/ui/pages/install/state.ts` | `WizardState` discriminated union, `WizardAction` set, `wizardReducer`, plus per-state derivation helpers (`selectConflictResolutions`, `canProceedFromDecisions`, `fillDefaultConflictChoices`, `fillDefaultOrphanChoices`, `planHasHardBlockers`) |
| `src/ui/pages/install/engine.ts` | `runLoadingPipeline`, `runLoadingPipelineWithReceipt` — the call-sequence helpers that wrap `core/` reads + `resolveInstallPlan` |
| `src/ui/pages/install/steps.tsx` | All eight step components (`PickStep`, `LoadingStep`, `StaleReceiptStep`, `PreviewStep`, `DecisionsStep`, `ConfirmStep`, `InstallingStep`, `DoneStep`) plus shared step chrome (`STEP_LABELS`, header strip) |
| `src/core/installer/runInstall.ts` | The driver — see `INSTALL_DRIVER.md`. Called from the installing-effect in `InstallPage` |
| `src/core/manifest/readEhcoll.ts` | `readEhcoll` — see `READ_EHCOLL.md` |
| `src/core/installLedger.ts` | `readReceipt`, `deleteReceipt` — see `INSTALL_LEDGER.md` |
| `src/core/resolver/resolveInstallPlan.ts` | `resolveInstallPlan` — see `RESOLVE_INSTALL_PLAN.md` |
| `src/core/resolver/userState.ts` | `buildUserSideState`, `pickInstallTarget` — see `USER_STATE.md` |
| `src/core/archiveHashing.ts` | `enrichModsWithArchiveHashes` — see `ARCHIVE_HASHING.md` |
| `src/utils/utils.ts` | `pickModArchiveFile` (file-picker) |

## How this replaces the legacy action

| Legacy step (`installCollectionAction.ts`) | Wizard step |
|---|---|
| `pickModArchiveFile` | PickStep |
| `showDialog("info", "Reading…")` | LoadingStep with phase events |
| Stale-receipt `showDialog` with three actions | StaleReceiptStep |
| `showDialog("info", "Plan preview", { plan })` | PreviewStep |
| Implicit "you'll just have to trust the dialog" for conflicts | DecisionsStep (NEW) — explicit per-row picker |
| `showDialog("question", "Install now?")` | ConfirmStep |
| `notifications` on driver progress | InstallingStep with live activity feed |
| `showDialog("success" / "error", ...)` | DoneStep |

The action's `installCollectionAction` function remains in the codebase as `Event Horizon: Install (legacy dialog)` for testers who want the old flow as a sanity check. Both code paths call the same `runInstall` driver.
