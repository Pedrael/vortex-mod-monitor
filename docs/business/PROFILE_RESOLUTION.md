# Profile Resolution Spec

How we answer two questions: **"What game is the user playing right now?"** and **"What profile is active for that game?"**. Three small functions sit in front of every operation that touches mods, so getting them right matters.

## Trigger

Called at the start of every toolbar action (export, compare-mods, compare-plugins). Never invoked directly by the user.

## Inputs

- `state: types.IState` — Vortex's full Redux state, returned by `context.api.getState()`.

## `getActiveGameId(state)` — what game

### Behavior

1. Call `selectors.activeGameId(state)`.
2. If the result is a non-empty string, return it.
3. Otherwise return `undefined`.

### Why the empty-string guard

`selectors.activeGameId` can return `""` in transient states (Vortex booting, no game selected yet, mid-switch). Treating `""` and `undefined` identically lets callers do a single `if (!gameId)` check.

### Output

- `string` (e.g. `"skyrimse"`) when a game is active and selected.
- `undefined` otherwise.

## `getActiveProfileIdFromState(state, gameId)` — what profile

### Behavior

Two-pass scan of `state.persistent.profiles`:

1. **Pass A — strict match.** Walk every profile entry. Return the id of the first profile whose `gameId` matches the requested game **and** whose `active === true`.
2. **Pass B — game-only fallback.** If pass A found nothing, walk again. Return the id of the first profile whose `gameId` matches, regardless of `active` flag.
3. If neither pass found a profile, return `undefined`.

### Why the two-pass fallback

Vortex's `active` flag on profiles can lag during gameplay-switching. A profile might exist for the active game but not yet have `active: true` set. Returning that profile is preferable to refusing the operation, since:

- The user clearly has a profile for this game.
- Reading mod state from a not-yet-marked-active profile is harmless (profile data is just a map; nothing is mutated by reading).
- The alternative (giving up) means the export/diff actions fail spuriously during normal use.

**QUIRK**: If two profiles exist for the same game and neither has `active: true`, we return whichever JS object iteration hits first. This is non-deterministic in theory, deterministic in practice (V8 preserves insertion order for object keys). We accept this — the case is rare, and the user can fix it by activating a profile.

### Output

- `string` (a profile id like `"abcdef12"`) on success.
- `undefined` if no profile exists for the requested game.

## `getActiveProfileId(state)` — convenience

### Behavior

1. Call `getActiveGameId(state)`. If it returned `undefined`, return `undefined`.
2. Otherwise call `getActiveProfileIdFromState(state, gameId)` and return its result.

### Why this exists

Most callers want "the active profile for the active game" without thinking about it. This composes the two so a caller writes one line.

**Note**: the toolbar actions in `src/actions/` currently call `getActiveGameId` and `getActiveProfileIdFromState` separately because they need to error-message about "no active game" vs "no profile for game" with different text. `getActiveProfileId` is provided for callers that don't care to distinguish.

## Failure modes

| Situation | What happens |
|---|---|
| Vortex hasn't loaded any game | `getActiveGameId` returns `undefined`, callers throw a user-visible error. |
| Game is active but no profile exists for it (very unusual; profiles are auto-created) | `getActiveProfileIdFromState` returns `undefined`, callers throw with the gameId in the message. |
| `state.persistent.profiles` is missing entirely | Treated as `{}` — no crash, just returns `undefined`. |
| `state.persistent.profiles[X]` is malformed (not an object, missing `gameId`) | Falsy `p?.gameId === gameId` test skips that entry — no crash. |

The behavior is **defensive by design**: any malformed corner of state is treated as "no match" rather than crashing the toolbar action.

## Outputs

None directly. These functions return values; they do not write files, dispatch actions, or notify.

## Quirks & invariants

- **INVARIANT**: `getActiveGameId` never returns `""`. Callers can safely use `if (gameId)` as the existence check.
- **INVARIANT**: Both profile functions are read-only. They never modify state.
- **QUIRK**: Multiple profiles for the same game with no active flag → first-encountered wins. Don't depend on which.
- **QUIRK**: We do not distinguish "wrong game profile is active" from "right game profile is active". If `state.persistent.profiles` claims active game = Skyrim SE but the active profile is for Fallout 4, our resolution returns the active Skyrim SE profile (or fallback), not the active-but-mismatched one. This matches Vortex's own behavior.

## Code references

- `getActiveGameId`: `src/core/getModsListForProfile.ts:56-59`
- `getActiveProfileId` (composer): `src/core/getModsListForProfile.ts:61-69`
- `getActiveProfileIdFromState` (two-pass): `src/core/getModsListForProfile.ts:71-94`
