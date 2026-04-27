# UI Collections Page — Phase 5.2

The single place where a user sees "what did Event Horizon install on this machine?". Reads every install receipt under `<appData>/Vortex/event-horizon/installs/` and lets the user inspect the mod list, switch into the receipt's profile, or uninstall the whole collection.

> **Status:** shipped — the `collections` route renders the page. Direct receipt-file editing remains the only escape hatch when the page can't help.

---

## Trigger

| Source | What happens |
|---|---|
| User clicks the **My Collections** tab in the EH nav | `EventHorizonMainPage` switches to `collections`, mounts `<CollectionsPage>`. |
| User clicks the **Open My Collections** CTA on the dashboard | Same as above. |
| User finishes an install and clicks **Open My Collections** | Same as above. The wizard's `DoneStep` calls `onNavigate("collections")`. |

The page never receives parameters — it always loads from disk.

## Preconditions

- `<appData>/Vortex/event-horizon/installs/` may not exist yet (treated as empty).
- `vortex-api`'s `util.removeMods` is callable from the renderer (Vortex 1.x). Required for uninstall.
- `api.events.emit("set-active-profile", id)` works for the receipt's `gameId`. Required for "Switch to profile".
- The page lives inside the standard provider stack (api / errors / toasts).

No game / profile preconditions — the list works regardless of the active game. Per-receipt actions check the receipt's own `gameId`.

## Inputs

| Source | Used for |
|---|---|
| `listReceipts(appDataPath, onParseError)` | Streams every `*.json` under `installs/` and reports per-file parse errors |
| `<appData>/Vortex/event-horizon/installs/<package.id>.json` | The receipt JSON itself; see `INSTALL_LEDGER.md` |
| `api.getState().settings.profiles.activeProfileId` | Determines whether a receipt's profile is currently active (drives the "active" pill) |
| `useApi()` | Calls `switchToProfile`, `uninstallMod`, `deleteReceipt` |
| `refreshTick` (internal) | Bump-on-action counter that re-runs the loader |

The page does not read the manifest of the original `.ehcoll` package — receipts are self-describing.

## Behavior

### 1. State machine

A small union, distinct from the install wizard's:

```
loading
  ↓ (listReceipts succeeds, receipts.length === 0 && errors.length === 0)
empty
  ↓ —
loaded { receipts, errors }
  ↑ refresh()  (any successful action calls refresh which bumps refreshTick)
```

There is no `error` state for the list itself — a thrown error from `listReceipts` is reported through the global modal **and** the page falls into `loaded` with empty arrays (so the user can still see "No collections" and click Refresh). Per-receipt parse errors are surfaced in the loaded state's `errors` array.

### 2. The loading effect

`useEffect` on `[refreshTick, reportError]`:

1. Sets state to `loading`.
2. `appData = util.getVortexPath("appData")`.
3. `listReceipts(appData, onParseError)` — `onParseError` collects `{ filename, message }` into a local array. The function continues past parse errors so one bad file doesn't take the page down.
4. If both `receipts.length === 0` and `errors.length === 0`, transitions to `empty` (renders the EmptyState).
5. Otherwise transitions to `loaded` with both arrays.

The standard `alive` ref guards every `setState` against unmount races.

### 3. The EmptyState

Renders when there are no receipts at all (no parse errors either). Layout:
- The `EventHorizonLogo` at 88 px.
- A "No collections yet" heading.
- A short pitch ("Install your first .ehcoll collection and Event Horizon will keep a receipt here…").
- A primary CTA: **Install a collection** → `props.onNavigate("install")`.

### 4. The list page

When `state.kind === "loaded"`:

| Region | Contents |
|---|---|
| Header | "Installed collections" title; subtitle "N collection(s) on this machine."; "Refresh" + "Install another" buttons |
| Error banner | Only renders if `state.errors.length > 0`; lists the first 5 failed filenames + their error messages, in danger-color box |
| Card grid | `repeat(auto-fill, minmax(320px, 1fr))` of `ReceiptCard`s |

**ReceiptCard** shows for each receipt:
- Package name (clickable card opens the detail modal).
- A pill row: version, game id, install-target-mode (`fresh profile` / `current profile`), and an `active` pill if `receipt.vortexProfileId === activeProfileId`.
- "Profile: <name>".
- "Mods: N".
- Footer: "installed <localized date>".

Clicking a card calls `setSelected(receipt)` which opens the detail modal.

### 5. The detail modal (`ReceiptDetailModal`)

Modal size `lg`, dismisses on backdrop click only when not `busy`.

| Region | Contents |
|---|---|
| Header | Package name + "v\<version> · \<gameId>" subtitle |
| Detail tiles | 4-column grid: Profile (name + id), Mode, Installed at, Mod count |
| Mod list | Scrollable `<ul>`, max-height 320 px, one row per `receipt.mods[i]` showing name + `source · vortexModId` (monospace) |
| Progress strip | Visible only during uninstall — "Uninstalling... C / T" |
| Footer | **Uninstall** (danger) → opens confirm modal · **Switch to profile** (ghost) · **Close** (primary) |

**Switch to profile** calls `switchToProfile(api, receipt.vortexProfileId)`:
- On success, success toast "Switched to profile X" and the modal closes.
- On failure, the global error modal opens with `step: "switch-profile"` context and the modal stays put.

**Uninstall** opens an `UninstallConfirmModal` (a small nested modal) with two buttons:
- "Cancel" — dismisses confirm only.
- "Uninstall N mods" (danger) — runs the uninstall sequence below.

### 6. Uninstall sequence (`handleUninstall`)

1. `setBusy(true)`, `setProgress({ current: 0, total: receipt.mods.length })`.
2. For each mod in `receipt.mods` (sequential, not parallel):
   - Increment progress.
   - `await uninstallMod(api, { gameId: receipt.gameId, modId: mod.vortexModId })` (wraps `util.removeMods`).
   - On per-mod failure, log a `console.warn` and continue. Per-mod failures do not abort the run; they are summarized via the `Uninstall partially failed` global error if any later step throws.
3. `await deleteReceipt(appData, receipt.packageId)` — atomic remove.
4. On the outer try's success, fire `onUninstalled()` which:
   - Closes the detail modal.
   - Shows a success toast: "Collection uninstalled. Receipt deleted."
   - Calls `refresh()` so the list re-fetches.
5. On any thrown error in the outer try, the global error modal opens with `step: "uninstall"` context and the receipt is **not** deleted (so the user can retry).
6. `finally` clears `busy`, `progress`, and the confirm-uninstall flag.

The driver-level `runInstall` did not pre-record orphan-uninstalls in a way that re-invokes the install pipeline; uninstall is intentionally simpler than install — it iterates the receipt and removes each mod via Vortex's own `util.removeMods`.

### 7. Refresh

Refresh is intentionally manual. The page does not watch the filesystem; if the user installs a collection in another window, the page won't reflect it until they click **Refresh**. `refresh()` bumps a `refreshTick` counter that is in the `useEffect` dependency list, which triggers a clean reload.

## Outputs

| Output | When |
|---|---|
| One toast | After a successful "Switch to profile" or successful uninstall |
| One filesystem delete (`<appData>/Vortex/event-horizon/installs/<package.id>.json`) | At the end of uninstall, if every mod removal step completed without throwing the outer try |
| Multiple `util.removeMods` calls | During uninstall — one per recorded mod; per-mod failures are logged but don't abort |
| Vortex profile switch | When user clicks "Switch to profile" |
| Global error modal | Any thrown error from list / switch / uninstall |

The page does not write or modify receipt JSON — it only reads or deletes.

## Failure modes

| Symptom | Likely cause | Mitigation |
|---|---|---|
| Page loads but shows "1 receipt failed to load" banner | A receipt JSON has invalid shape (e.g. missing `mods` array) | Fix the file by hand or delete it. The error banner shows the filename + parser message. |
| "Switch to profile" toasts success but the active game in Vortex didn't change | Vortex's profile picker is for a different game than the receipt | Switch to the receipt's `gameId` first, then click Switch again. |
| Uninstall reports "Uninstall partially failed" with one mod still listed in Vortex | A specific mod failed to remove (deployed file in use, plugin lock) | Close any external tools using the mod, then re-open the detail modal — the receipt was preserved, retry uninstall. |
| Refresh shows the same list after uninstall | The receipt deletion threw (rare; e.g. AV locked the file) | The error modal will already be open with the deletion error. Manually delete the receipt JSON to clean up. |
| EmptyState appears even though `installs/` has files | Every receipt in the folder is corrupt | The error banner explains why; corrupt files don't count toward "0 receipts". Repair or delete them. |
| Detail modal can't be dismissed | An uninstall is in progress (`busy=true`) | Wait — the modal disables backdrop dismissal during work. |

## Quirks & invariants

- **INVARIANT: receipts are the only source of truth.** The page never reads Vortex mod state to decide what to show; the receipt drives the mod list, the profile pointer, and the uninstall sequence. If a receipt mod's `vortexModId` no longer exists in Vortex, `uninstallMod` returns gracefully (Vortex's `util.removeMods` skips unknown ids).
- **INVARIANT: the page is read-only against `installs/` except for `deleteReceipt`.** No other write path lives here. Editing a receipt's content is a manual operation through the filesystem.
- **INVARIANT: per-receipt parse failures don't crash the page.** Bad files are surfaced in the banner; valid files render normally.
- **The detail modal is dismissible only when `busy=false`.** This prevents the user from cancelling mid-uninstall (which would leave the receipt out of sync with Vortex's state).
- **Uninstall is sequential, not parallel.** Concurrency would cause `util.removeMods` to race against Vortex's own load-order recompute. One mod at a time keeps Vortex's reducer happy.
- **No "preview what uninstall will do".** The mod list inside the detail modal **is** the preview — every row will be removed.
- **No filesystem watching.** Refresh is manual. The page is mostly a tool for testers; long-running monitoring is out of scope.
- **QUIRK:** Two receipts can share a `vortexProfileId` if a user installed two collections into the same fresh-profile-mode profile (only possible if they manually switch to a fresh profile and run the install action again, since the resolver wouldn't pick the same profile twice). The list shows both with `active` pills; switching profiles or uninstalling either is unambiguous.
- **QUIRK:** The `active` pill compares against `settings.profiles.activeProfileId`, which is global across games. If the user is on a different game, no card shows `active` even if a profile of that game's id matches an installed-collection receipt.

## Acknowledged gaps

- **No "rename" / "duplicate" / "export" actions.** Receipts are immutable; if the user wants to clone an install they must rebuild the package.
- **No diff against the original manifest.** "What changed since I installed this?" requires the original `.ehcoll` package and is a future feature.
- **No batch operations.** The user can't select multiple receipts and uninstall in one click. By design — the consequences are large.
- **No filtering / search.** With <50 receipts in practice the grid scrolls fine; we'll add filtering when a tester actually has 50.
- **No localization.** Strings are English; numeric formatting uses the OS locale through `toLocaleDateString` / `toLocaleString`.

## Code references

| File | What it owns |
|---|---|
| `src/ui/pages/CollectionsPage.tsx` | The page — `CollectionsPage` (boundary wrapper), `CollectionsList` (loader + grid), `EmptyState`, `ReceiptCard`, `ReceiptDetailModal`, `UninstallConfirmModal`, `DetailTile` |
| `src/core/installLedger.ts` | `listReceipts`, `readReceipt`, `deleteReceipt` — see `INSTALL_LEDGER.md` |
| `src/core/installer/modInstall.ts` | `uninstallMod` (thin wrapper over `util.removeMods`) |
| `src/core/installer/profile.ts` | `switchToProfile` |
| `src/types/installLedger.ts` | `InstallReceipt`, `InstallReceiptMod` |
| `src/ui/components/Modal.tsx` | The generic modal primitive |
| `src/ui/components/Card.tsx`, `Pill.tsx`, `Button.tsx`, `ProgressRing.tsx`, `EventHorizonLogo.tsx` | UI primitives |
| `src/ui/state/ApiContext.tsx` | `useApi` |
| `src/ui/errors/index.ts` | `useErrorReporter`, `useErrorReporterFormatted`, `ErrorBoundary` |

## Relationship to the rest of the system

The Collections page is the **only** UI consumer of `installLedger.ts` apart from the install wizard. The wizard *writes* (via `runInstall`); the page *reads + deletes*. The driver and the UI are decoupled — they only meet through the on-disk receipt format.

Receipts are also consumed by the dashboard's player panel (see `UI_DASHBOARD.md`); that panel renders a top-3 preview using the same `listReceipts` call but doesn't expose actions.
