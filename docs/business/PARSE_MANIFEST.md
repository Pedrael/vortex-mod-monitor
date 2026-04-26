# Parse Manifest — `manifest.json` → `EhcollManifest`

**Source of truth:** `src/core/manifest/parseManifest.ts` (Phase 3 slice 1).
**Schema reference:** `src/types/ehcoll.ts` and [`MANIFEST_SCHEMA.md`](MANIFEST_SCHEMA.md).
**Mirror of:** [`BUILD_MANIFEST.md`](BUILD_MANIFEST.md).

## Purpose

The user-side validator of the `.ehcoll` contract. Takes the raw text of a
`.ehcoll` package's `manifest.json` and either returns a fully-typed
[`EhcollManifest`](../../src/types/ehcoll.ts) plus a list of warnings, or
throws a single error listing every problem it found.

`parseManifest` is the gate every Phase 3+ consumer goes through. The
resolver, the installer, the drift reporter, and the eventual React UI's
package inspector all start from the manifest object this function returns.
If the bytes on disk are malformed, those consumers must never see them.

`parseManifest` is a **pure function**. No filesystem, no network, no
state. The caller (`readEhcoll`, Phase 3 slice 2) reads the ZIP and pulls
out the JSON text; the validator only looks at the resulting string.

## Why a custom validator and not e.g. Zod?

We considered a runtime schema library. We chose a hand-written validator
because:

1. **One dependency surface.** The TypeScript shape in
   `src/types/ehcoll.ts` is already the source of truth. A schema library
   would create a second, parallel definition that has to be kept in
   sync — exactly the trap that shipped Vortex's vanilla collection bugs.
   The validator here is just code that walks the same shape.
2. **Zero runtime weight in the loaded extension.** Vortex extensions
   ship as bundled JavaScript that runs inside Vortex itself. We avoid
   pulling in heavy runtime dependencies unless the value justifies it.
3. **Custom error messages we control end-to-end.** Curators editing a
   `.ehcoll` by hand (debugging, testing) get plain-English failures that
   reference the manifest field path, not "ZodError: invalid_union at
   path mods.0.source.kind".

Trade-off accepted: every new field in the schema requires a hand-edit in
this file. That cost is low because the schema is intentionally additive
(see [`MANIFEST_SCHEMA.md`](MANIFEST_SCHEMA.md) on versioning).

## Inputs

```
parseManifest(raw: string): ParseManifestResult
```

`raw` is the JSON text exactly as it appears inside the ZIP. The validator
calls `JSON.parse` itself; the caller does not need to pre-parse.

## Outputs

```
{
  manifest: EhcollManifest,   // fully typed, narrowed by every check
  warnings: string[]          // non-fatal issues for the UI
}
```

### Two severity tiers

The validator distinguishes structural problems from referential problems:

- **Errors** abort the parse. The validator collects every detectable
  error in one pass and then throws **one** `ParseManifestError` whose
  `.errors` field carries the full list. The user/curator sees the whole
  picture, not a fix-rerun-fix-rerun loop. Examples:
  - JSON parse failure
  - `schemaVersion !== 1`
  - Missing required field, wrong type, malformed UUID/SHA-256/semver
  - `game.id` outside the supported set
  - `mods[i].source.kind` not `"nexus"` or `"external"`
  - Duplicate `compareKey` across two mods
- **Warnings** survive the parse. The manifest is structurally valid but
  some references won't resolve. The resolver may downgrade or skip
  these at install time. Examples:
  - Rule whose `source` or `reference` doesn't match any mod in `mods[]`
  - File-override winning/losing mod missing from `mods[]`
  - Two external mods sharing the same `archiveSha256`

### Why warnings exist

A manifest with a dangling rule is not a *broken* manifest. The curator
removed a mod from the collection but the rule pointing at it survived;
or two parts of the collection were authored independently and the
reference didn't get reconciled. The installer can still proceed — it
just can't honor the unresolvable directive.

We surface warnings up so the user can see them in the install
preview/drift report, but we do **not** block the install on them.
"Strict-mode" behavior (warning ⇒ error) is left to the resolver, which
already has more context than the validator.

## Behavior — error collection model

The validator never short-circuits on the first error within a section.
Every section (`package`, `game`, `mods`, `rules`, etc.) runs to
completion accumulating problems into the same `errors[]` list. After
all sections finish, if any errors exist, the function throws.

This mirrors the collection behavior of `buildManifest`,
`packageEhcoll`, and `validateBuildManifestInput`. Curators get the
full diagnosis from one parse, every parse.

The only place we short-circuit is `schemaVersion` — if that's wrong we
literally don't know what the rest of the document is supposed to mean,
so we throw immediately.

## Cross-reference validation

After per-section validation succeeds, the validator runs a single
post-pass that compares cross-references against the assembled set of
mod `compareKey`s. This is where warnings come from. It runs only when
all per-section validation passed — there's no point cross-referencing a
half-built mod list.

The post-pass checks:

- Every `rules[i].source` is some mod's `compareKey`.
- Every fully-pinned `rules[i].reference` is some mod's `compareKey`.
  (Partially-pinned references like `nexus:1234` survive the check —
  they're meant to be resolved at install time.)
- Every `fileOverrides[i].winningMod` is some mod's `compareKey`.
- Every `fileOverrides[i].losingMods[j]` is some mod's `compareKey`.
- No two external mods share the same `archiveSha256` (warning, not
  error — the resolver still works, but the package would only ship the
  archive once).

## Failure modes

| Symptom | Cause | Outcome |
| --- | --- | --- |
| `JSON.parse` fails | Manifest text is not valid JSON | One-error throw |
| `schemaVersion !== 1` | Manifest authored against a future schema | Single-error throw, immediate abort, suggests upgrading the extension |
| `package.id` not a UUID, `package.version` not semver | Producer bug or hand-edit | Per-field error in the aggregated list |
| `mods[i].source.kind` is `"steam"` | Future kind not yet implemented | Per-field error: "must be 'nexus' or 'external'" |
| `mods[i].source.sha256` is not 64-char lowercase hex | Producer bug — the spec is strict | Per-field error |
| Two mods with `compareKey: "nexus:1234:567890"` | Hand-merged manifests | Per-field error citing both indices |
| `rules[i].reference` is `nexus:1234` and no mod has that compareKey | Curator removed mod 1234 from the collection but kept a rule | **Warning** — resolver decides whether to skip or fail |
| Two external mods with the same `archiveSha256` | Likely curator dedupe miss | **Warning** — installer still works |

## Quirks & invariants

1. **`schemaVersion` is the only short-circuit gate.** Any other error
   accumulates with the rest. This is deliberate so curators see the
   full picture per parse.
2. **JSON parsing is the validator's job, not the caller's.** `readEhcoll`
   passes the raw string in; it does not pre-parse. This keeps "the on-
   disk format is JSON" a single-responsibility decision and lets us
   change to e.g. JSON5 in v2 without changing every caller.
3. **Cross-reference checks emit warnings, never errors.** A manifest
   with an unresolvable rule is still *structurally* valid. The
   installer will decide whether to honor `package.strictMissingMods`
   when actually installing.
4. **Partially-pinned rule references are intentionally allowed.** The
   reference `nexus:1234` (without `:fileId`) is a legal way to say
   "this rule applies to any version of Nexus mod 1234". The resolver
   matches against whatever Nexus file id is present at install time.
   The validator only warns when a *fully-pinned* reference doesn't
   resolve.
5. **No silent type coercion.** `"42"` is not a valid `modId`; `1` is
   not a valid `enabled`. Producers (us) emit exact types, consumers
   (us) require exact types.
6. **UUID format is permissive.** We accept any RFC 4122-shaped string
   (8-4-4-4-12 hex), not just v4. The producer always emits v4 (via
   `uuid` package's `v4()`); the validator doesn't enforce that.
7. **`Date.parse` is the ISO-8601 oracle.** We don't roll our own date
   parser — anything `Date.parse` returns a finite number for is
   accepted. The producer always emits `Date.toISOString()` output, so
   round-trip is clean.
8. **Empty arrays are valid.** `mods: []`, `rules: []`,
   `fileOverrides: []`, `iniTweaks: []` (always for v1 producers),
   `externalDependencies: []` are all legitimate shapes. A truly empty
   collection still produces a valid manifest.
9. **The validator never mutates its input.** It only reads. The result
   is freshly constructed.

## Round-trip property

For any `EhcollManifest m` produced by `buildManifest(...)`:

```
parseManifest(JSON.stringify(m)).manifest === m  (deep-equal)
parseManifest(JSON.stringify(m)).warnings === []
```

This is the contract that lets us confidently put `parseManifest` at the
gate of every consumer in Phase 3+. Phase 3 slice 2's `readEhcoll`
extends this round-trip to: "anything `packageEhcoll` writes,
`readEhcoll` reads back losslessly."
