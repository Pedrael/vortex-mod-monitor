# Read `.ehcoll` — ZIP file → typed `EhcollManifest` + package layout

**Source of truth:** `src/core/manifest/readEhcoll.ts` (Phase 3 slice 2).
**Pure-validator delegate:** [`PARSE_MANIFEST.md`](PARSE_MANIFEST.md).
**Mirror of:** [`PACKAGE_ZIP.md`](PACKAGE_ZIP.md).

## Purpose

The user-side opener for `.ehcoll` packages. Takes one absolute path on
disk, opens the ZIP via `vortex-api`'s `util.SevenZip`, validates the
package structure, parses `manifest.json`, and returns a typed result
the resolver/installer can consume.

This is the I/O wrapper around the pure {@link parseManifest} validator.
The split mirrors the producer side:

| Stage | Pure (no I/O) | I/O wrapper |
| --- | --- | --- |
| Producer | `buildManifest` | `packageEhcoll` |
| Consumer | `parseManifest` | **`readEhcoll`** |

After this slice, anything `packageEhcoll` writes, `readEhcoll` reads
back losslessly. That round-trip is the gate every Phase 3+ consumer
(resolver, installer, drift report, package inspector UI) builds on.

## Why the manifest is read out of a temp dir

`node-7z` shells out to `7z.exe`, which writes extracted bytes to disk.
There is no in-memory extract pipe. So the read flow is:

1. **List** the archive's central directory (cheap; no extraction).
2. **Cherry-pick extract** `manifest.json` only into a temp dir.
3. Read its bytes from disk, hand them to `parseManifest`.
4. Cleanup.

Bundled archives are deliberately **not** extracted here. We only
confirm they're present in the central directory and that they match
the manifest's `bundled: true` mods. The resolver decides when to
extract them and where to.

## Inputs

```
readEhcoll(zipPath: string, options?: ReadEhcollOptions)
```

`zipPath` must be an absolute path to a single regular file. Symlinks
and directories are rejected.

`options`:

| Field | Default | Effect |
| --- | --- | --- |
| `stagingDir` | `os.tmpdir()/event-horizon-read-<random>` | Where `manifest.json` is extracted to. Useful for tests. |
| `cleanupOnSuccess` | `true` | When `false`, the staging dir is left in place after a successful read for offline inspection. |
| `sevenZip` | `resolveSevenZip()` | Test injection point. Defaults to `vortex-api`'s `util.SevenZip`. |

## Outputs

```
{
  manifest:          EhcollManifest,        // fully parsed + validated
  bundledArchives:   BundledArchiveEntry[], // sorted by sha256
  hasReadme:         boolean,
  hasChangelog:      boolean,
  iniTweakFiles:     string[],              // Phase 5; v1 producers emit []
  warnings:          string[]               // parse warnings + layout warnings
}
```

`BundledArchiveEntry` carries the parsed sha256, the in-zip path
(forward-slashed), the file extension (without dot), and the
uncompressed size when 7z reports it.

## Behavior — pipeline

The reader runs three phases. Phases 1 and 2 are short-circuit gates;
phase 3 accumulates errors.

### Phase 1 — file existence + listing

1. Reject if `zipPath` is not absolute.
2. `fs.stat` the path. `ENOENT` ⇒ "no file at...". Anything else ⇒
   "cannot stat...". Non-regular-file ⇒ "...is not a regular file."
3. Call `sevenZip.list(zipPath)`. Collect every emitted `data` entry.
4. If 7z's stream errors, wrap as a `ReadEhcollError` ("the file may be
   corrupt, password-protected, or not a ZIP").

### Phase 2 — layout classification + manifest extract

5. For each list entry, normalize the path (`\` → `/`), drop directory
   entries (`attr` starts with `D`, or trailing slash), and classify:
   - `manifest.json` at root → `hasManifest = true`
   - `README.md` at root → `hasReadme = true`
   - `CHANGELOG.md` at root → `hasChangelog = true`
   - `bundled/<basename>` → parse basename as `<64-hex>[.<ext>]`. On
     match, push to `bundledEntries`; on miss, the file is silently
     dropped (we tolerate stray content here; the cross-check step is
     where we catch real problems).
   - `ini-tweaks/...` → push to `iniTweakFiles`.
   - Anything else at root → ignored. Forward-compat headroom for
     additive v1.x schema changes that ship root-level files.
6. **Short-circuit gate:** if `hasManifest === false`, throw
   `ReadEhcollError`. The package is not a valid Event Horizon
   collection at all.
7. Prepare a staging directory (clears `options.stagingDir` if
   provided, else `mkdtemp` under the OS temp dir).
8. Call `sevenZip.extract(zipPath, stagingDir, { $cherryPick: ['manifest.json'] })`.
   On 7z error, wrap as `ReadEhcollError`.
9. `fs.readFile(stagingDir + '/manifest.json', 'utf8')`.
10. Call `parseManifest(raw)`. If it throws `ParseManifestError`,
    repackage its `.errors[]` into a `ReadEhcollError` so callers have
    one error type to catch.
11. **`finally`-cleanup the staging dir** (when `cleanupOnSuccess` is
    truthy). Cleanup runs even on error.

### Phase 3 — cross-check `bundled/` against `manifest.mods`

12. Build the **expected** set: every `mod.source.kind === "external" && mod.source.bundled === true`,
    keyed by `sha256` → `compareKey`. Duplicate external SHAs survive
    (the parse layer already warns about them); the *first* mod claims
    the archive.
13. Build the **seen** set: every parsed bundled-directory entry, keyed
    by `sha256` → `ParsedBundledEntry`. **Duplicate sha256 entries in
    the ZIP are an error** (every external identity is unique; two of
    the same SHA in `bundled/` should be impossible).
14. Every expected SHA missing from seen → error
    ("...marked bundled=true in the manifest but no archive with sha256 X
    is present...").
15. Every seen SHA missing from expected → error
    ("...is present in the package but does not correspond to any external
    mod with bundled=true...").
16. If any errors, throw `ReadEhcollError` with the full list. Otherwise
    return the survivors as `BundledArchiveEntry[]`, sorted by sha256
    for deterministic consumer ordering.

## Failure modes

| Symptom | Cause | Severity |
| --- | --- | --- |
| `zipPath` not absolute | Caller bug | Throw, single error |
| `ENOENT` | File moved / deleted | Throw, single error |
| `EACCES`, etc. | Filesystem issue | Throw, single error |
| Path is a directory or symlink | Wrong target | Throw, single error |
| `7z list` errors out | Corrupt ZIP, password-protected, not a ZIP | Throw, single error |
| `manifest.json` missing | Not an Event Horizon package | Throw, single error |
| `manifest.json` not valid JSON | Hand-edit / producer bug | Throw, list from `parseManifest` |
| `schemaVersion` ≠ 1 | Future package | Throw, single error |
| Field-level shape problems | Hand-edit / producer bug | Throw, list from `parseManifest` |
| Bundled mod missing in `bundled/` | Producer bug, package corruption | Throw, accumulated |
| Stray archive in `bundled/` | Hand-edit, producer bug | Throw, accumulated |
| Two `bundled/` entries with the same sha256 | Hand-edit, never producer | Throw, accumulated |
| Bundled basename is not `<64-hex>[.ext]` | Hand-edit | Silently ignored at classification (tolerable: it's not in the manifest's bundled set, so it can't masquerade as an expected archive) |
| Unknown root-level file | Forward-compat additive change | Tolerated, no warning |
| Extension cannot stat staging dir | Permission issue | Bubbled up as `ReadEhcollError` |

## Quirks & invariants

1. **`readEhcoll` only extracts `manifest.json`.** Bundled archives are
   listed, never extracted. The resolver (slice 3+) owns extraction;
   `readEhcoll` is purely "tell me what's in here." This keeps a UI
   "inspect package" action fast on a 4 GB collection.
2. **Path normalization is forward-slash.** 7z reports OS-native
   separators; we rewrite them so cross-platform comparisons and the
   eventual UI stay consistent. Producer-side `packageEhcoll` already
   stages with `/`.
3. **Directory entries from 7z are filtered.** Some 7z builds emit
   `bundled/` as a separate entry with `attr` starting `"D"`. We drop
   those — they're the directory marker, not a file.
4. **Unknown root-level files are tolerated.** The schema is additive;
   a v1.x producer might ship a new top-level file that this v1 reader
   doesn't recognize. We don't refuse the package — we just ignore the
   file. This keeps users on the older extension able to install
   newer packages whenever the additive change is compatible.
5. **Bundled entries with malformed basenames are silently dropped at
   classification.** They can't masquerade as expected archives (the
   sha256 won't match). If you want to *see* such files for debugging,
   the unrecognized-basename list lives in the layout state but isn't
   currently surfaced — wire it up if/when a debug-inspector view
   needs it.
6. **Short-circuit gates are categorical "no document" cases.** Missing
   ZIP, unreadable ZIP, missing `manifest.json`. Everything else
   accumulates so the operator gets a full diagnosis from one read.
7. **`parseManifest`'s warnings are forwarded as-is**, not wrapped or
   re-categorized. The reader adds nothing of its own to that list at
   present (the cross-check is error-only). Layout warnings (e.g.
   "manifest references a README but the package doesn't ship one")
   may be added here in a future slice if it turns out the resolver
   needs them.
8. **Staging cleanup is `finally`-bound.** A read that fails midway
   through extraction never leaks bytes into the temp dir, even when
   the error is `ReadEhcollError` (we don't catch-and-rethrow inside
   the try block — the `finally` does the work).
9. **The reader is stateless.** Two concurrent reads of two different
   `.ehcoll` files are safe; `mkdtemp` gives each a unique staging
   directory.
10. **No file is held open beyond the synchronous tail of each
    function.** All I/O is `await`ed; nothing leaks descriptors.

## Round-trip property

The Phase 3 slice 2 done-criterion. For any input `(input, archives)`
that `packageEhcoll` accepts:

```
const { outputPath } = await packageEhcoll({ ... });
const result = await readEhcoll(outputPath);

result.manifest                           === input.manifest          (deep-equal)
result.bundledArchives.length             === bundledArchives.length
result.bundledArchives[*].sha256          ⊆ archives[*].sha256
result.hasReadme                          === (input.readme !== undefined)
result.hasChangelog                       === (input.changelog !== undefined)
result.iniTweakFiles                      === []                       (v1 producers)
result.warnings                           === parseManifest(JSON.stringify(input.manifest)).warnings
```

This contract is what lets later slices (resolver/installer) build on
the reader without re-parsing or re-validating the manifest.
