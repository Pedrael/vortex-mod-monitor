# Install Ledger — receipts on disk

**Source of truth:**
- Types: `src/types/installLedger.ts` (Phase 3 slice 5b).
- Runtime: `src/core/installLedger.ts` (Phase 3 slice 5b).

**Related specs:**
- [`INSTALL_PLAN_SCHEMA.md`](INSTALL_PLAN_SCHEMA.md) — how the resolver consumes lineage data the ledger provides.
- [`docs/PROPOSAL_INSTALLER.md`](../PROPOSAL_INSTALLER.md) decision log entry (2026-04-27, "Cross-release lineage via install ledger, not Vortex attributes") for the rationale.

## Purpose

The ledger is a tiny, file-system-only database of "what Event Horizon installed where." One JSON file per collection `package.id`:

```
<appData>/Vortex/event-horizon/installs/<package.id>.json
```

It exists for exactly one reason: **so the resolver can tell which of the user's installed mods are ours**. Vortex's mod attributes are unreliable (the original motivation for this whole project), so we maintain our own ledger and never trust Vortex for lineage.

The ledger is the **single source of truth** for cross-release lineage. The Phase 3 install driver writes it after a successful install; the Phase 3 userState builder (slice 5) reads it when constructing `UserSideState.previousInstall` and tagging `installedMods[].eventHorizonInstall`.

## What's in a receipt

```jsonc
{
  "schemaVersion":     1,
  "packageId":         "<UUIDv4>",
  "packageVersion":    "1.2.3",
  "packageName":       "My Awesome Skyrim Pack",
  "gameId":            "skyrimse",
  "installedAt":       "2026-04-27T03:14:15.926Z",
  "vortexProfileId":   "<vortex-profile-uuid>",
  "vortexProfileName": "My Awesome Skyrim Pack (Event Horizon v1.2.3)",
  "installTargetMode": "fresh-profile",
  "mods": [
    {
      "vortexModId":  "<vortex-internal-id>",
      "compareKey":   "nexus:1234:5000",
      "source":       "nexus",
      "name":         "SkyUI",
      "installedAt":  "2026-04-27T03:14:16.541Z"
    }
  ]
}
```

Field-by-field:

| Field | Used by | Semantics |
|---|---|---|
| `schemaVersion` | parser | Bumped only on breaking changes; v1 is the current. |
| `packageId` | resolver, listing UI | Mirrors `manifest.package.id` at install time. The lookup key. |
| `packageVersion` | resolver | Mirrors `manifest.package.version`. Surfaced as `previousInstall.packageVersion`. |
| `packageName` | UI | Snapshot of the manifest's name at install time, for "I have collection X installed" listings. |
| `gameId` | UI | Lets the UI group receipts by game ("collections installed for Skyrim SE"). |
| `installedAt` | UI, resolver | ISO-8601 UTC. Used in `previousInstall.installedAt`. |
| `vortexProfileId` | UI, future driver | Which profile the install lives in. Important for fresh-profile installs (the driver may have created the profile specifically for this install). |
| `vortexProfileName` | UI | Display name; survives independently of Vortex's per-profile state. |
| `installTargetMode` | UI | `"current-profile"` or `"fresh-profile"`. Tells the user where the install landed. |
| `mods[]` | resolver | The orphan-detection key set. |

Per-mod entries:

| Field | Used by | Semantics |
|---|---|---|
| `vortexModId` | resolver, future driver | Vortex's internal mod id. The resolver uses this to find the matching entry in `state.persistent.mods[gameId]` and tag `installedMods[].eventHorizonInstall`. |
| `compareKey` | resolver | The manifest's compareKey at install time. Becomes `eventHorizonInstall.originalCompareKey`. The resolver cross-checks this against the new manifest to detect orphans. |
| `source` | UI | `"nexus"` or `"external"`. UI grouping only. |
| `name` | UI | Snapshot of the mod's display name at install time. |
| `installedAt` | UI | When this specific mod was installed. |

## Why receipts and not Vortex mod attributes?

This is **the** load-bearing rationale for the whole installer project, repeated here because it's that important:

> Vortex's vanilla collections store a "this came from collection X" tag on each `IMod.attributes`. In practice, those attributes get stripped randomly during version upgrades, profile switches, mod re-installs, and FOMOD reconfigurations. The "rules randomly disappear, FOMOD selections are lost, bytes are silently swapped" failure modes the user reported all trace back to attribute reliance.

By keeping our own file outside Vortex's mod store, we own the lifecycle:
- Vortex never touches the file.
- The resolver reads the file directly.
- The driver writes the file directly.
- Bugs in Vortex's attribute handling cannot affect lineage.

## Lifecycle

### First install of a collection

1. Action handler reads the ledger directory looking for `<package.id>.json`. File doesn't exist → `userState.previousInstall = undefined`, `installTarget.kind = "fresh-profile"`.
2. Resolver produces a fresh-profile plan.
3. User confirms; driver runs.
4. Driver writes a fresh receipt with the install metadata + the per-mod list.

### Upgrade (v1.0 → v1.1)

1. Action handler reads `<package.id>.json` for the v1.1 manifest's `package.id`. File exists with v1.0 metadata.
2. Action handler builds `userState.previousInstall = { packageId, packageVersion: "1.0.0", installedAt, modCount: receipt.mods.length }`.
3. Action handler walks `receipt.mods` and tags every matching `installedMod[i].eventHorizonInstall`.
4. Action handler picks `installTarget.kind = "current-profile"` (because the receipt is present).
5. Resolver produces an in-place upgrade plan. Orphan detection compares `receipt.mods[].compareKey` against the new manifest's `compareKey`s.
6. User confirms each conflict / orphan; driver runs.
7. Driver overwrites the receipt with the v1.1 metadata + the new per-mod list. The v1.0 record is gone — multi-release history is intentionally NOT tracked in v1.

### Receipt missing despite installed mods (the "ledger lost" case)

The user has v1.0 mods on disk, but the receipt was wiped (PC migration, AppData cleanup, antivirus quarantine, etc.).

1. Action handler reads the ledger → `undefined`.
2. `userState.previousInstall` stays undefined; no `installedMods[].eventHorizonInstall` tagged.
3. `installTarget.kind = "fresh-profile"` (forced — see [INSTALL_PLAN_SCHEMA.md "Install target"](INSTALL_PLAN_SCHEMA.md#install-target-current-profile-vs-fresh-profile)).
4. Resolver produces a fresh-profile plan. The user's existing v1.0 mods are invisible to the resolver — they live in the global pool but the new profile won't enable them.
5. After install, the new profile is the official home of the collection; the user's old profile (with the orphaned v1.0 mods) is byte-untouched.

### Re-install of the same version

1. Action handler reads the receipt, finds version matches.
2. Resolver runs in `current-profile` mode; mostly emits `*-already-installed` decisions.
3. Driver writes a new receipt (overwrites the previous one with refreshed `installedAt` timestamps).

The receipt is *replaced*, not *merged*. If a previous install had mod X but the current install doesn't, X becomes orphaned per the resolver's ordinary orphan detection — no special-cased re-install logic.

### Uninstall (Phase 5+)

The Phase 5 UI will offer "uninstall this collection." Driver:
1. Reads the receipt.
2. Disables every `mods[i].vortexModId` in the target profile.
3. (Optionally) deletes the profile if `installTargetMode === "fresh-profile"`.
4. Deletes the receipt file with `deleteReceipt`.

This isn't implemented in slice 5b; the API surface is in place.

## File operations & atomicity

| Operation | Implementation | Why |
|---|---|---|
| Read | `fs.readFile` → `parseReceipt` | Receipts are tiny; reading the whole file is fine. |
| Write | Write to `<file>.tmp`, then `fs.rename` | Vortex extensions can die mid-write (forced shutdown, antivirus). A half-written receipt would mis-tag installed mods or hide orphans. The temp file is in the same directory as the target so the rename is filesystem-atomic. |
| Delete | `fs.unlink`, ignore ENOENT | Idempotent. UI calling delete twice is fine. |
| List | `fs.readdir` → parse each `<uuid>.json` | One bad receipt does not invalidate the rest; failures are reported via the optional `onError` callback. |

The serializer also round-trips through `parseReceipt` before writing — no malformed receipt can ever land on disk via our code path. If `serializeReceipt` is given a runtime object that fails validation (e.g. a missing field due to a programmer error), the write throws *before* anything touches the filesystem.

## Validation rules

`parseReceipt` is the gate every reader passes through. Two tiers:

**Errors** (abort the parse with `InstallLedgerError`):
- Not valid JSON.
- Root is not a JSON object.
- `schemaVersion` ≠ 1.
- `packageId` missing, non-string, empty, or not a UUID.
- `packageVersion` missing, non-string, empty, or fails the loose semver-like check (`^v?\d+\.\d+\.\d+([.\-+].*)?$`).
- `packageName`, `vortexProfileId`, `vortexProfileName` missing or not non-empty strings.
- `gameId` not in the supported game-id set (`skyrimse`, `fallout3`, `falloutnv`, `fallout4`, `starfield`).
- `installedAt` not a valid ISO-8601 UTC timestamp.
- `installTargetMode` not `"current-profile"` or `"fresh-profile"`.
- `mods` not an array.
- For each `mods[i]`: missing/wrong-type fields, `source` not in `{ nexus, external }`, `installedAt` not ISO-8601.

**Warnings**: none in v1. Receipts are always machine-written; if a hand-edited receipt path is ever supported, hand-edit-friendly warnings will land here.

## Why we never silently overwrite a corrupt receipt

If `parseReceipt` throws, the action handler is required to surface the error to the user, NOT silently regenerate a fresh receipt. Reasons:

1. Silently regenerating would erase whatever lineage data was there, defeating the entire purpose of the ledger.
2. The corruption may be reversible — the user might have an older copy in a backup, or the file might be lockable by another process.
3. Surfacing the error gives the user agency: they can choose to delete the corrupt file (via the eventual UI), restore from backup, or proceed with no lineage (treated as "fresh install" by the resolver).

The ledger is a small file; manual recovery is realistic.

## Path & naming conventions

- **Directory**: `<appData>/Vortex/event-horizon/installs/`. The `INSTALL_LEDGER_DIRNAME` constant exposes the relative path; the action handler joins with whatever Vortex returns from `util.getVortexPath('appData')`.
- **Filename**: `<package.id>.json`. The `package.id` is a UUIDv4 generated when the curator first builds the collection (see [`COLLECTION_CONFIG.md`](COLLECTION_CONFIG.md)). It's deliberately opaque — users don't need to recognize the filename, the listing UI surfaces names from `packageName`.
- **Path traversal**: `getReceiptPath` validates `packageId` is a UUID before joining. A non-UUID `packageId` throws `InstallLedgerError`. Defense against passing a malicious string in the unlikely event the action handler gets one from a manifest read.

## Quirks & invariants

1. **One file per `package.id`, overwritten on each install.** Multi-release history is NOT tracked in v1. The resolver only ever needs the most-recent install of a collection.
2. **The receipt is the orphan-detection key set.** `mods[].compareKey` is the field the resolver compares against the new manifest's `compareKey`s.
3. **Vortex mod attributes are NEVER consulted for lineage.** The receipt is the only source.
4. **Atomic writes.** Writes go through `<file>.tmp` + rename. A half-written receipt is impossible.
5. **Idempotent delete.** `deleteReceipt` returns `{ deleted: false }` on ENOENT; never throws on absence.
6. **Listing is best-effort.** A single corrupt receipt does not invalidate the listing of the rest. The optional `onError` callback surfaces individual failures so the UI can show "could not read N receipts."
7. **Receipts validate themselves on serialize.** `serializeReceipt` round-trips through `parseReceipt` — no malformed receipt lands on disk via our code path.
8. **`packageId` validation is enforced at every entry point.** `getReceiptPath`, `parseReceipt`, and `writeReceipt` all reject non-UUID `packageId`s.
9. **Schema is additive.** Future v1.x revisions add fields; never rename or remove. Breaking changes bump `INSTALL_LEDGER_SCHEMA_VERSION`.
10. **No-receipt is a normal state.** `readReceipt` returns `undefined` on ENOENT — the most common "first install" case is not an error.
