# Install order & load order capture

> Module: [`src/core/getModsListForProfile.ts`](../../src/core/getModsListForProfile.ts) — per-mod fields
> Module: [`src/core/loadOrder.ts`](../../src/core/loadOrder.ts) — top-level load order
> Phase: 1, slice 4
> Status: implemented

This spec covers everything the extension records about **the order in
which the curator's mods were installed and loaded**. It is the input
signal the future installer (Phase 4+) uses to compute a deterministic
deployment priority for any conflicting files where no explicit override
or rule applies.

There are two independent captures:

| Capture                          | Where                       | Source                                   | Cost | Diffed?           |
| -------------------------------- | --------------------------- | ---------------------------------------- | ---- | ----------------- |
| `AuditorMod.installTime`         | per-mod                     | `mod.attributes.installTime`             | free | yes               |
| `AuditorMod.installOrder`        | per-mod, derived            | computed from `installTime` + `id`       | free | yes               |
| `ExportedModsSnapshot.loadOrder` | top-level snapshot          | `state.persistent.loadOrder[gameId]`     | free | not yet (Phase 4) |

---

## 1. Why we don't capture a single `deploymentPriority` number

Vortex doesn't store one. Conflict resolution at deploy time is computed
dynamically from:

1. Explicit per-file overrides (captured in slice 3 as `mod.fileOverrides`).
2. Mod rules (`before`/`after`/`requires`/etc., captured in slice 2 as
   `mod.rules`).
3. Install order — used as the tiebreaker when no rule applies.

We capture all three **inputs** (from slices 2, 3, and 4 respectively).
The `.ehcoll` packager (Phase 2) will compute the manifest's
`deploymentPriority` field by topologically sorting the rule graph and
breaking ties with `installOrder`. The user-side installer then re-applies
that pre-computed priority on the user's machine.

This division keeps the capture layer pure (no graph algorithms in core)
and concentrates the priority-computation logic in one place where it can
be tested in isolation.

---

## 2. Per-mod `installTime`

### What it is

Vortex stamps every mod with `attributes.installTime` when it first
deploys. The format is `string | Date` per Vortex's own type definition
(`ICommonModAttributes.installTime`). Real-world Vortex states have been
observed storing it as:

- An ISO-8601 string (most common in modern Vortex).
- A `Date` instance (older states, persisted/rehydrated).
- An arbitrary date-parseable string ("2024-12-25 18:30 UTC").
- (Rare) a unix-millis number stringified.

### Capture algorithm — `normalizeInstallTime`

1. If the raw value is `undefined` / `null` → return `undefined`.
2. If it is a `Date` instance → use as-is.
3. If it is a `string` or `number` → pass to `new Date(raw)`.
4. Anything else (object, boolean, etc.) → return `undefined`.
5. If the resulting Date is invalid (`Number.isNaN(getTime())`) → return
   `undefined`.
6. Otherwise return `date.toISOString()` — always UTC, always with `Z`
   suffix, always millisecond precision.

### Why we re-stringify even already-ISO inputs

Vortex on different machines / locales has been observed emitting
`"2024-12-25T18:30:00+00:00"` vs `"2024-12-25T18:30:00.000Z"` for
equivalent timestamps. Plain string comparison would treat them as
different. Re-stringifying via `Date.toISOString()` canonicalizes to a
single representation, so two snapshots representing the same moment
diff cleanly.

### Diff behavior

Listed in `compareMods.compareFields`. Plain string equality after
canonicalization. A `installTime` change between snapshots means the mod
was uninstalled and reinstalled (a meaningful event).

---

## 3. Per-mod `installOrder` (derived)

### What it is

A 0-indexed ordinal assigned to every mod in the active profile,
representing the curator's install sequence. Always present, never
negative, deterministic across runs.

### Why ordinals when we already have timestamps?

Two reasons:

1. **Diff readability.** "moved from 47 to 52" is far easier to scan than
   "moved from 2024-12-25T18:30:00.000Z to 2025-01-03T09:11:42.000Z".
2. **Tiebreaker stability.** Two mods installed in the same second (rare
   but observed during bulk installs) have identical `installTime`. The
   ordinal disambiguates them deterministically using their `id`.

### Algorithm — `assignInstallOrder`

After the per-mod walk produces `AuditorMod[]`, before returning:

1. Pair each mod with its parsed timestamp (`Date.parse(installTime)` →
   number, or `NaN` when missing).
2. Sort the pairs:
   - Mods with a valid timestamp come BEFORE mods without one.
   - Within the timestamped bucket: ascending by timestamp.
   - Within the no-timestamp bucket: no further ordering signal — fall
     through to step 3.
   - **Ties** (same timestamp, or both missing): break by `id` ASCII
     compare. This is arbitrary but **stable** — same input produces
     same output every time.
3. Walk the sorted list and assign `installOrder = i` for `i = 0..n-1`.
4. The function mutates `mod.installOrder` in place but does NOT re-sort
   the returned array. Callers iterate mods in `Object.entries(modsByGame)`
   order; the ordinal is the only thing that changes.

### INVARIANT: deterministic across runs

Given identical state, two runs of `getModsForProfile` produce identical
`installOrder` values for every mod. This is the property the diff engine
relies on — without determinism, every export-then-immediate-export would
report bogus `installOrder` differences.

### Diff behavior

Listed in `compareMods.compareFields`. A change here means at least one
mod was added, removed, or had its `installTime` changed in a way that
shifted the ordinal. Often co-occurs with a `installTime` diff for the
same mod.

---

## 4. Top-level `loadOrder`

### What it is

A snapshot of `state.persistent.loadOrder[gameId]`, normalized into a
sorted array. This is **Vortex's own load-order tracking**, separate from
`plugins.txt`.

### Why it is separate from `plugins.txt`

`plugins.txt` (already captured by the Compare Plugins action) covers
ESPs, ESMs, and ESLs only — files Bethesda's runtime loads as plugins.

Vortex's `loadOrder` covers **every mod** in games that opt into the
LoadOrder API, including:

- Script extender binaries (SKSE, F4SE, NVSE).
- ENB / ReShade payloads.
- Any mod whose payload is "files in the game folder, no plugin".
- Plugins themselves — yes, they appear in BOTH.

So for Skyrim AE / Fallout 4 (next-gen) / Starfield, the `loadOrder`
gives us a complete deploy-priority view that `plugins.txt` cannot.

For Skyrim SE pre-AE, Fallout 3, Fallout NV, the `loadOrder` slot is
typically absent from state. We emit an empty array — never `undefined`
inside the structure.

### Type shape

```ts
type CapturedLoadOrderEntry = {
  modId: string;     // matches AuditorMod.id
  pos: number;       // 0-indexed
  enabled: boolean;
  locked?: boolean;  // omitted unless strictly true
  external?: boolean;// omitted unless strictly true
};
```

Sorted by `pos` ascending, with `modId` as deterministic tiebreaker.

### What we deliberately drop

| Vortex field | Why |
|---|---|
| `prefix` | UI display string, not portable. |
| `data` | Game-extension-specific opaque payload. We don't know what's in it for an arbitrary game. |

### Capture algorithm

1. Read `state.persistent.loadOrder[gameId]`. If missing or not an object,
   return `[]`.
2. For each `[modId, entry]` pair:
   - Skip if `entry` is not an object.
   - Skip if `entry.pos` is not a finite number.
   - Build a `CapturedLoadOrderEntry` with `modId`, `pos`, and `enabled`
     (strict `=== true` check).
   - Only include `locked` / `external` if strictly `true` (omit the field
     entirely otherwise — keeps the JSON minimal and unambiguous).
3. Sort by `pos` ascending, then `modId` for tiebreak.
4. Return.

### Failure modes

Defensive throughout — corrupt entries are skipped, never thrown.
`captureLoadOrder` never throws.

### Diff behavior

**Not diffed yet.** The top-level snapshot field is captured for the
future installer; `compareMods` ignores it. Diffing load orders requires
its own machinery (position changes, enabled-state changes, additions/
removals, much like `comparePluginsEntries`) and is deferred to a later
slice (or to the installer's reconciler in Phase 4+).

### Backwards compatibility

The field is **optional** on `ExportedModsSnapshot`:

- Pre-slice-4 snapshot files don't have it.
- Compare Mods builds a current-side snapshot synchronously and (today)
  does not capture loadOrder — though it's a synchronous capture, so we
  could add it cheaply if/when we start diffing it.

---

## Cross-references

- [`AUDITOR_MOD.md`](AUDITOR_MOD.md) — full per-mod field list including
  `installTime` and `installOrder`.
- [`MOD_RULES_CAPTURE.md`](MOD_RULES_CAPTURE.md) — the second input to
  deployment priority computation.
- [`FILE_OVERRIDES_CAPTURE.md`](FILE_OVERRIDES_CAPTURE.md) — the first
  input (explicit per-file winners).
- [`EXPORT_MODS.md`](EXPORT_MODS.md) — how this capture is wired in.
- [`COMPARE_PLUGINS.md`](COMPARE_PLUGINS.md) — the plugin-only ordering
  this complements.
- [`../PROPOSAL_INSTALLER.md`](../PROPOSAL_INSTALLER.md) §6 — manifest's
  `installOrder` and `deploymentPriority` fields, which the packager
  computes from the inputs captured here.
