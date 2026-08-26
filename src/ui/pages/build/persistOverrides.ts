/**
 * ──────────────────────────────────────────────────────────────────────
 * Write the curator's typing to disk as they type.
 *
 * `saveCollectionConfig` was reachable from exactly three places — loading the
 * build context, running a build, and the action handler. None of them is the
 * FORM. So everything a curator typed into the external-mods table lived in a
 * module-scoped session and nowhere else: it survived tab switches and React
 * remounts, and evaporated on a Vortex restart.
 *
 * That is survivable for a version number you retype in four seconds. It is
 * not survivable for thirty-two download links researched one at a time, which
 * is exactly the work this table exists to collect — the more the form is
 * worth using, the more a restart costs.
 *
 * ── Why a file write and not a bigger idea ──
 * The config file is already the source of truth for these fields, already
 * written atomically, and already merged on load. Nothing new has to be
 * invented; the only thing missing was calling it at the right moment.
 *
 * Writes are debounced and last-write-wins. A keystroke should not produce a
 * file write, and the value being saved is small, self-contained, and always
 * complete — there is no partial state where an interrupted save leaves the
 * config meaning something the curator did not type.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { CollectionConfig } from "../../../core/manifest/collectionConfig";

export type PersistArgs = {
  configPath: string;
  config: CollectionConfig;
};

/** Injectable so the debounce and the merge can be tested without a disk. */
export type PersistDeps = {
  write: (configPath: string, config: CollectionConfig) => Promise<void>;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
};

export const PERSIST_DELAY_MS = 800;

/**
 * A debounced writer.
 *
 * Deliberately NOT one-shot: the curator types thirty-two rows in one sitting,
 * so this is asked to save over and over and must coalesce rather than queue.
 */
export function createOverridePersister(deps: PersistDeps): {
  save: (args: PersistArgs) => void;
  /** Write immediately — for a caller that knows the page is going away. */
  flush: () => Promise<void>;
  pending: () => boolean;
} {
  let timer: unknown;
  let latest: PersistArgs | undefined;

  const writeNow = async (): Promise<void> => {
    const args = latest;
    latest = undefined;
    if (args === undefined) return;
    try {
      await deps.write(args.configPath, args.config);
    } catch {
      // A failed autosave must not break the form the curator is typing into.
      // The build still writes the config, so this is a convenience losing a
      // round, not the only route to disk.
    }
  };

  return {
    save: (args: PersistArgs): void => {
      latest = args;
      if (timer !== undefined) deps.clearTimer(timer);
      timer = deps.setTimer(() => {
        timer = undefined;
        void writeNow();
      }, PERSIST_DELAY_MS);
    },
    flush: async (): Promise<void> => {
      if (timer !== undefined) {
        deps.clearTimer(timer);
        timer = undefined;
      }
      await writeNow();
    },
    pending: (): boolean => latest !== undefined,
  };
}

/**
 * The config as it should be on disk, given what the form currently holds.
 *
 * Merges rather than replaces: the config carries fields this form never shows
 * (packageId, lineage, last-built bookkeeping), and writing only what the form
 * knows about would quietly delete them — including the packageId, which is
 * the collection's identity across releases.
 */
export function configWithOverrides(args: {
  config: CollectionConfig;
  overrides: CollectionConfig["externalMods"];
}): CollectionConfig {
  return {
    ...args.config,
    externalMods: {
      ...args.config.externalMods,
      ...args.overrides,
    },
  };
}
