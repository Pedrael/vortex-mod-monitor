/**
 * Thin typed wrapper around `vortex-api`'s re-exported `SevenZip` (which
 * is the `node-7z` default export under the hood).
 *
 * Why this file exists:
 *  - `node-7z` ships no usable type definitions, and `@types/node-7z` is
 *    not in our deps. `tsconfig.skipLibCheck` keeps vortex-api's import
 *    of it from breaking our build, but our own callsites would need
 *    `as any` everywhere.
 *  - Defining a narrow `SevenZipApi` interface here lets the rest of the
 *    code use a typed surface; the `as unknown as` cast lives in exactly
 *    one place, and tests can inject a fake implementation by satisfying
 *    the interface.
 *
 * If `vortex-api` ever exposes proper types for SevenZip, this module
 * collapses to a re-export.
 */

import { util } from "@nexusmods/vortex-api";

/**
 * One entry yielded by `list`'s `data` event. The shape mirrors
 * `node-7z`'s output: `file` is the path inside the archive, `size` is
 * the uncompressed size in bytes (when 7z reports it), `attr` is the DOS
 * attribute flag string (`"D...."` on directories).
 *
 * `crc` is the archive's stored CRC32 for the entry. It used to be
 * deliberately omitted here, but it is the cheapest per-file integrity signal
 * that exists — 7z reports it from the header, with no decompression. Measured
 * across .zip/.7z/.rar on a real 939-mod profile: present on 100% of file
 * entries at ~0.02s per archive. `archiveContents.ts` uses it to verify an
 * extraction against the ARCHIVE rather than against the curator's staging
 * folder, which may itself be silently broken.
 *
 * Typed loosely (`string | number`) and left optional on purpose: node-7z's
 * field naming is not guaranteed across versions and some entries legitimately
 * carry no CRC. Consumers must treat absence as "cannot verify", never as
 * "mismatch".
 *
 * `dateTime` and `compressed` are still unconsumed — the type stays narrow to
 * keep callers honest about what we actually rely on.
 */
export type SevenZipListEntry = {
  file: string;
  size?: number;
  attr?: string;
  crc?: string | number;
  /** `"+"` on directories in some node-7z versions; see `attr` for the rest. */
  folder?: string;
};

/**
 * Stream returned by every `node-7z` operation. Emits at minimum:
 *  - `end`     — the operation completed successfully.
 *  - `error`   — the operation failed; argument is an Error.
 *  - `data`    — per-file events. For `list`, payload is a
 *                {@link SevenZipListEntry}. For `add`/`extract`, it's a
 *                progress entry we ignore.
 *  - `progress`— overall percent updates (we don't consume these).
 */
export type SevenZipStream = {
  on(event: "end", listener: () => void): SevenZipStream;
  on(event: "error", listener: (err: Error) => void): SevenZipStream;
  on(
    event: "data",
    listener: (entry: SevenZipListEntry) => void,
  ): SevenZipStream;
  on(event: string, listener: (...args: unknown[]) => void): SevenZipStream;
};

export type SevenZipAddOptions = {
  /**
   * Working directory passed to the spawned `7z.exe`. File paths in the
   * `source` argument are resolved relative to this directory, and the
   * resulting archive entries preserve those relative paths.
   */
  workingDir?: string;
  /** Pass `-r` to recurse into subdirectories. */
  recursive?: boolean;
  /**
   * Raw extra CLI flags appended to the 7z command line. Used for
   * options node-7z doesn't expose as named fields (e.g. `-tzip`).
   */
  $raw?: string[];
  /**
   * Compression-method overrides, e.g. `["mx=5"]`. Each entry is prefixed
   * with `-m` by node-7z. We don't currently use this, but keep the field
   * so the typed surface matches what node-7z accepts.
   */
  method?: string[];
};

/**
 * Shared options for `list` and `extract`. We only use the few fields
 * relevant to the Phase 3 slice 2 reader (`$cherryPick` to extract
 * specific files, `$raw` for niche flags).
 */
export type SevenZipReadOptions = {
  /**
   * Only operate on these archive entries. For `extract`, only listed
   * files are extracted; for `list`, only listed entries are yielded.
   * Path syntax follows 7z's CLI patterns (forward slashes, glob ok).
   */
  $cherryPick?: string[];
  /** Raw extra CLI flags appended to the 7z command line. */
  $raw?: string[];
};

/**
 * The narrow surface of `node-7z` we consume. Add methods here only as
 * we need them — keeps the cast site honest about what we depend on.
 */
export type SevenZipApi = {
  add(
    archive: string,
    source: string | string[],
    options?: SevenZipAddOptions,
  ): SevenZipStream;
  list(archive: string, options?: SevenZipReadOptions): SevenZipStream;
  extract(
    archive: string,
    output: string,
    options?: SevenZipReadOptions,
  ): SevenZipStream;
};

/**
 * Resolve the runtime SevenZip implementation from `vortex-api`.
 *
 * The symbol lives at `util.SevenZip` — vortex-api re-exports the
 * `node-7z` default through a `declare namespace util { ... }` block.
 * `node-7z` ships no usable types, so we cast to our local
 * {@link SevenZipApi} surface for the rest of the codebase.
 */
export function resolveSevenZip(): SevenZipApi {
  const exposed = (util as unknown as { SevenZip: unknown }).SevenZip;
  if (!exposed) {
    throw new Error(
      "vortex-api.util.SevenZip is not available at runtime. " +
        "Are we running outside of Vortex?",
    );
  }
  return exposed as SevenZipApi;
}
