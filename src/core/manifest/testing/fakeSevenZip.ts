/**
 * A fake that mirrors node-7z 0.8.1 — the version Vortex actually bundles.
 *
 * This file exists because the previous fakes modelled an API that **does not
 * exist**: an event-emitter stream with `.on("data"/"end"/"error")`. Every
 * test passed against it while the real integration could not make a single
 * successful call, because Vortex's node-7z is promise-based, reports entries
 * through a progress callback, names the path field `name`, and — worst —
 * RESOLVES on failure with a non-zero `code` instead of rejecting.
 *
 * A fixture that cannot fail the way production fails is not a test. Keep this
 * fake faithful to `node_modules/node-7z/lib/*` inside Vortex's `app.asar`; if
 * the two ever disagree, the fake is wrong.
 */

import type {
  SevenZipApi,
  SevenZipArchiveSpec,
  SevenZipListEntry,
  SevenZipResult,
} from "../sevenZip";

export type FakeSevenZipOptions = {
  /** Entries `list` reports, one progress call per entry (as node-7z does). */
  entries?: SevenZipListEntry[];
  /** Make `list` REJECT — i.e. the promise fails outright. */
  listError?: Error;
  /**
   * Model an archive 7z could not OPEN: it resolves normally with an empty
   * spec and no entries, which is what a missing or corrupt file really does.
   * Distinct from a valid archive that is merely empty.
   */
  unreadable?: boolean;
  /**
   * Exit status `add` / `extractFull` resolve with. Non-zero means 7z failed
   * — and node-7z still resolves, which is the trap this models.
   */
  code?: number;
  errors?: string[];
  /** Records the options each method was called with, for assertions. */
  calls?: FakeSevenZipCall[];
};

export type FakeSevenZipCall = {
  method: "add" | "list" | "extractFull";
  args: unknown[];
};

export function fakeSevenZip(options: FakeSevenZipOptions = {}): SevenZipApi {
  const entries = options.entries ?? [];
  const calls = options.calls ?? [];
  const result = (): SevenZipResult => ({
    code: options.code ?? 0,
    errors: options.errors ?? [],
  });

  return {
    list: async (archive, opts, progress) => {
      calls.push({ method: "list", args: [archive, opts] });
      if (options.listError !== undefined) {
        throw options.listError;
      }
      // node-7z emits one entry per progress call: `progress([entry])`.
      for (const entry of entries) {
        progress?.([entry]);
      }
      // `list` resolves with the archive tech spec and DISCARDS {code,errors}.
      // An unopenable archive resolves with an EMPTY spec, not a rejection.
      const spec: SevenZipArchiveSpec =
        options.unreadable === true
          ? {}
          : { path: archive, type: "zip", physicalSize: "0" };
      return spec;
    },
    extractFull: async (archive, dest, opts) => {
      calls.push({ method: "extractFull", args: [archive, dest, opts] });
      return result();
    },
    add: async (archive, sources, opts) => {
      calls.push({ method: "add", args: [archive, sources, opts] });
      return result();
    },
  };
}
