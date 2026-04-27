import * as crypto from "crypto";

import type { EhcollStagingFile } from "../../types/ehcoll";

/**
 * Deterministic SHA-256 over a mod's staging file set — the manifest's
 * fallback identity oracle for external mods whose original archive
 * bytes are unavailable.
 *
 * The hash is identical iff two callers see *the same set of files
 * with the same content*, regardless of insertion order. The function
 * is pure (no I/O, no clocks) and stable across machines and OS:
 *
 *   - Files are sorted by `path` (POSIX-style, lexicographic) before
 *     digesting, so callers don't have to pre-sort.
 *   - Each file contributes exactly one canonical line:
 *
 *         <path>|<size>|<sha256>\n
 *
 *     where `<path>` is the POSIX-style relative path the curator
 *     captured, `<size>` is the byte count as a decimal integer, and
 *     `<sha256>` is the lowercase hex SHA-256 of the file contents.
 *
 * RETURN VALUE:
 *   - `string` (64 lowercase hex chars) when every input file has a
 *     `sha256` field. This is the only configuration the user-side
 *     resolver matches against; "fast" verification level captures
 *     `path + size` only and yields `undefined`.
 *   - `undefined` when:
 *       * `files.length === 0` (no staging snapshot — the curator
 *         opted out, or the mod has no files yet),
 *       * any file is missing `sha256` (partial capture due to I/O
 *         errors during walk; safer to refuse than to produce a
 *         hash that ignores some files).
 *
 * The "any file missing → undefined" rule is load-bearing: a
 * partial hash would silently match against unrelated mods that
 * happen to share the hashable subset, breaking the identity
 * promise the resolver relies on.
 *
 * WHY NOT MERKLE / TREE HASH:
 * Flat per-line digest is the right choice here. We don't need
 * proof-of-inclusion; we just need set equality. Sorted-line digest
 * is the simplest representation that's both order-insensitive and
 * cheap to verify by hand from a captured manifest snippet.
 *
 * @param files - Staging file entries. Modified copy is used internally;
 *                input array is not mutated.
 * @returns Lowercase hex SHA-256, or `undefined` when the input is
 *          unfit for a stable hash (see above).
 */
export function computeStagingSetHash(
  files: readonly EhcollStagingFile[],
): string | undefined {
  if (files.length === 0) {
    return undefined;
  }
  for (const f of files) {
    if (typeof f.sha256 !== "string" || f.sha256.length !== 64) {
      return undefined;
    }
  }

  const sorted = [...files].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );

  const hasher = crypto.createHash("sha256");
  for (const f of sorted) {
    hasher.update(`${f.path}|${f.size}|${f.sha256!}\n`);
  }
  return hasher.digest("hex");
}
