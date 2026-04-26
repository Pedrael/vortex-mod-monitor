# Package `.ehcoll` — `EhcollManifest` + bundled archives → `.ehcoll` file

**Source of truth:** `src/core/manifest/packageZip.ts` (Phase 2 slice 3) +
`src/core/manifest/sevenZip.ts` (vortex-api shim).
**Schema reference:** `src/types/ehcoll.ts` and [`MANIFEST_SCHEMA.md`](MANIFEST_SCHEMA.md).
**Upstream stage:** [`BUILD_MANIFEST.md`](BUILD_MANIFEST.md).

## Purpose

The packager turns one [`EhcollManifest`](../../src/types/ehcoll.ts) plus a list
of bundled-archive paths into a single `.ehcoll` file on disk, ready to ship to
the user-side installer (Phases 3–4).

It does the I/O that `buildManifest` deliberately doesn't: writes the manifest,
writes optional `README.md` / `CHANGELOG.md`, hardlinks/copies bundled mod
archives into a staging directory, and shells out to 7z to ZIP the whole thing.

## Why ZIP, not 7z

`.ehcoll` is the user-visible extension; the format inside is internal. We
choose ZIP for two reasons:

1. **Tooling compatibility.** Windows Explorer, WinRAR, `unzip`, and every
   programming-language stdlib can read ZIPs. When debugging a user-side
   install failure, "send me your `.ehcoll` so I can peek at `manifest.json`"
   has to work without anyone installing extra software.
2. **Compression doesn't help.** Bundled archives are *already-compressed* mod
   archives. Recompressing them with a different algorithm changes total size
   by a fraction of a percent. Not worth the tooling tradeoff.

The format is forced via `7z a -tzip` — without it 7z infers the format from
the file extension and `.ehcoll` is unrecognized, so it'd default to its
native `.7z` format.

## Identity is `(package.id, package.version)` — NOT byte-equal builds

Two builds of the *same collection version* are not guaranteed to produce
byte-identical `.ehcoll` files. They will differ in:

- File mtimes baked into ZIP entry headers.
- Filesystem enumeration order (passed through to 7z).
- 7z's own version-to-version output details.

This is fine. The canonical identity of a release is
`(manifest.package.id, manifest.package.version)`:

- `package.id` is a UUIDv4 generated once per collection by the action handler
  and persisted by the curator. Stable across releases.
- `package.version` is semver, bumped by the curator per release.

Together they're a globally unique key for "this is collection X, revision Y."
The user-side install cache, CDN dedup, and "did I install this already?"
checks all key off `(id, version)` — never off content hash.

If the curator rebuilds the same version twice (say, to fix a typo in the
README) the bytes change but `(id, version)` stays the same. Users who already
have that version installed see no change. That's the right behavior. Byte
determinism would only matter if we wanted to detect "operator forgot to bump
version" by file fingerprint — which is a curator-discipline problem, not a
packager problem, and byte determinism doesn't actually help with it.

The one stability concession we keep: **`manifest.json` keys are sorted via
`sortDeep` before serialization**. Cost: one function call. Benefit: when
debugging a problem report, `unzip` two `.ehcoll` files and `diff` the
manifests — the diff highlights real content changes, not JSON key-order
shuffles. Worth it.

## Inputs

```
packageEhcoll({
  manifest,            // EhcollManifest from buildManifest
  bundledArchives,     // [{ sourcePath, sha256 }, ...]
  readme?,             // markdown string
  changelog?,          // markdown string
  outputPath,          // absolute path to write .ehcoll to
  stagingDir?,         // optional override (test injection)
  cleanupOnSuccess?,   // default true
  verifyHashes?,       // default false (re-hash bundled archives before staging)
  sevenZip?,           // optional injection of SevenZipApi (test injection)
})
```

## Validation (fatal)

The packager collects every detectable problem into one `PackageEhcollError`
before throwing — same fail-fast philosophy as `buildManifest`.

| Cause                                                       | Why fatal                                         |
| ----------------------------------------------------------- | ------------------------------------------------- |
| `outputPath` is missing or not absolute                     | We refuse to guess where the curator meant.       |
| `bundledArchive.sha256` doesn't match the lowercase-hex 64-char invariant | Identity is malformed; downstream resolver would reject. |
| Two bundled archives share the same sha256                  | Each external mod has unique identity by sha256; duplicates would shadow each other in `bundled/`. |
| `bundledArchive.sha256` doesn't correspond to any external mod with `bundled=true` in the manifest | Curator is shipping bytes the manifest doesn't promise — or vice versa. |
| Manifest has an external mod with `bundled=true` but no archive supplied | Same problem from the other side: manifest promises bytes that won't be in the package. |
| `bundledArchive.sourcePath` is not absolute                 | Path is ambiguous and we won't make assumptions about cwd. |
| `verifyHashes=true` and a bundled archive's actual sha256 doesn't match | Archive cache changed under us; re-export the snapshot. |

## Behavior

1. Validate inputs (above). On any error, throw `PackageEhcollError` carrying
   the full list — no I/O has happened yet.
2. Prepare a staging directory. Default: `os.tmpdir()/event-horizon-pack-<random>`
   via `fs.mkdtemp`. When `stagingDir` is supplied (test path) the directory
   is `rm -rf`'d and recreated.
3. Write `manifest.json`. Keys are sorted via `sortDeep`, serialized with 2-space
   indent, trailing newline. UTF-8.
4. Write optional `README.md` / `CHANGELOG.md`. Content gets a trailing newline
   if the source didn't have one — purely so unzipping the package doesn't
   produce surprise "no newline at end of file" diff noise.
5. Create `bundled/` directory inside staging.
6. For each bundled archive:
   - When `verifyHashes=true`, stream the source file through SHA-256 and
     compare against the supplied `sha256`. Mismatch ⇒ fatal error with a
     "re-export the snapshot" hint.
   - Compute the destination filename: `<sha256>.<ext>` where `<ext>` is the
     original archive's extension (without the leading dot). When the source
     has no extension, the file is `<sha256>` with no suffix.
   - **Try `fs.link(src, dst)` first.** Hardlink is free and instant on the
     same volume.
   - **On failure (EXDEV cross-volume / EPERM / ENOSYS), fall back to
     `fs.copyFile`.** Slow but always works.
   - The `EEXIST` case is re-thrown — the staging dir was freshly created,
     so a duplicate filename means a duplicate sha256 we should have
     caught at validation.
7. Delete any existing file at `outputPath`. 7z's `add` is *additive* — it
   would append to a pre-existing archive, not replace it.
8. Ensure `outputPath`'s parent directory exists (curator may have picked a
   non-existent path).
9. Shell out to 7z via the `vortex-api`-bundled `node-7z`:
   - Working directory: the staging dir.
   - Source: `*` recursive.
   - Format: `-tzip` (forced via `$raw`).
   - Compression: 7z's default. Bundled archives are already compressed.
10. `fs.stat` the produced file to capture its size for the result.
11. On success and `cleanupOnSuccess !== false`, `rm -rf` the staging directory.
12. Return `{ outputPath, outputBytes, bundledCount, warnings }`.

## Failure modes

- **Validation errors** ⇒ `PackageEhcollError` with the full list. No staging
  directory was created; nothing to clean up.
- **I/O errors during staging or 7z invocation** ⇒ wrapped in
  `PackageEhcollError`. The staging directory is `rm -rf`'d in the `finally`
  branch regardless of success — partial output is never left lying around
  the curator's temp dir.
- **7z process exit with non-zero code** ⇒ surfaces as `error` event on the
  Stream returned by `SevenZip.add`, gets wrapped in `PackageEhcollError`.

## INVARIANTs

- Validation is exhaustive. The packager doesn't proceed past validation if
  *any* problem was detected; the curator gets one report.
- The staging directory is always removed (`safeRmDir`) even on success when
  `cleanupOnSuccess !== false`. Failure to remove is swallowed — partial
  cleanup is better than crashing on a closed-file-handle race.
- Hardlinking is best-effort, never required. Cross-volume packaging works,
  it's just slower because we copy.
- `manifest.json` is the only file whose bytes are guaranteed stable across
  same-version rebuilds. Bundled archive bytes are stable by sha256 (that's
  their identity); other package bytes (mtimes, ZIP entry order) may vary.

## Non-goals (explicit)

- **No byte-identical packages.** Identity is `(id, version)`, see above.
- **No upload / publish.** The packager produces a file; shipping it to a
  CDN or release page is the curator's job.
- **No signing.** v1 doesn't sign manifests. If we need signing for
  authenticity, it's an additive v1.x: a new top-level field on the manifest
  + a signature file alongside `manifest.json`.
- **No incremental rebuilds.** Every call recreates the full package from
  scratch. The staging-and-7z dance is fast enough that incremental
  optimization isn't justified for v1.

## See also

- [`MANIFEST_SCHEMA.md`](MANIFEST_SCHEMA.md) — the manifest we're packaging.
- [`BUILD_MANIFEST.md`](BUILD_MANIFEST.md) — where the manifest comes from.
- [`ARCHIVE_HASHING.md`](ARCHIVE_HASHING.md) — same `hashFileSha256` we
  reuse when `verifyHashes=true`.
- [`../PROPOSAL_INSTALLER.md`](../PROPOSAL_INSTALLER.md) §6 — the package
  on-disk layout this packager produces.
