/**
 * ──────────────────────────────────────────────────────────────────────
 * Bundling a mod the curator maintains by hand.
 *
 * An external mod is not always a downloaded thing that sits untouched. Some
 * are the curator's own — a settings bundle, a merged patch, a tweaked config
 * pack — edited in place, in the staging folder, over months. Measured on a
 * real one: 188 files in the source archive, 179 in staging, with 12 removed
 * and 3 added. The archive stopped describing the mod a long time ago.
 *
 * Bundling used to ship the SOURCE ARCHIVE, which means shipping the version
 * the curator started from. The user's install then reproduces the archive, not
 * the mod: the curator's removals come back and their additions never arrive.
 * The manifest even records the correct staged hashes, so the installer detects
 * the mismatch perfectly — and has no way to fix it, because the bytes it was
 * given are the wrong ones.
 *
 * So bundling an external mod now packs the STAGING FOLDER. What ships is what
 * the curator actually has.
 *
 * ## The identity has to move with the bytes
 *
 * A mod is identified by the sha256 of the archive that produces it. Repacking
 * produces different bytes, so the repacked archive's hash becomes the mod's
 * identity — otherwise the manifest would promise one thing and the package
 * would contain another, which is the failure this whole module exists to end.
 *
 * ## Determinism
 *
 * The archive is built from a sorted file list with 7z's timestamp-free zip
 * settings where available. Two builds from an unchanged staging folder should
 * produce the same bytes and therefore the same identity; a rebuild that
 * gratuitously changed every external mod's hash would make every collection
 * update look like every mod changed.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as fsp from "fs/promises";
import * as path from "path";

import { selectors, types } from "@nexusmods/vortex-api";

import { hashFileSha256 } from "../archiveHashing";
import { sevenZipAdd, type SevenZipApi } from "./sevenZip";
import type { AuditorMod } from "../getModsListForProfile";
import type { CollectionConfig } from "./collectionConfig";

/** One repacked mod: where the new archive is, and what it hashes to. */
export type RepackedBundle = {
  modId: string;
  modName: string;
  /** Absolute path to the archive built from staging. Temporary. */
  sourcePath: string;
  sha256: string;
  bytes: number;
};

export type RepackResult = {
  /** `archiveSha256` replaced for every repacked mod. */
  mods: AuditorMod[];
  bundles: RepackedBundle[];
  warnings: string[];
};

export type RepackOptions = {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, modName: string) => void;
  /**
   * Refuse to repack anything larger than this, in bytes. A curator can flag a
   * 37GB mod as bundled by accident, and discovering that by watching a build
   * consume the disk is the wrong way to find out. Default 2GB.
   */
  maxBytes?: number;
};

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024 * 1024;

async function directorySize(dir: string): Promise<number> {
  let total = 0;
  const walk = async (d: string): Promise<void> => {
    let entries;
    try {
      entries = await fsp.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else {
        try {
          total += (await fsp.stat(full)).size;
        } catch {
          /* unreadable — not counted, not fatal */
        }
      }
    }
  };
  await walk(dir);
  return total;
}

/**
 * Repack every external mod the curator flagged as bundled, from its staging
 * folder, and re-key it to the resulting archive.
 *
 * Never throws for a per-mod problem: a mod that cannot be repacked keeps its
 * original identity and produces a warning, because failing an entire build
 * over one bundle would cost the curator far more than shipping without it.
 */
export async function repackBundledExternals(args: {
  state: types.IState;
  gameId: string;
  mods: AuditorMod[];
  config: CollectionConfig;
  sevenZip: SevenZipApi;
  /** Directory for the temporary archives. Caller owns cleanup. */
  workDir: string;
  isExternal: (mod: AuditorMod) => boolean;
  options?: RepackOptions;
}): Promise<RepackResult> {
  const { state, gameId, mods, config, sevenZip, workDir, isExternal } = args;
  const options = args.options ?? {};
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  const wanted = mods.filter(
    (m) => isExternal(m) && config.externalMods[m.id]?.bundled === true,
  );
  if (wanted.length === 0) {
    return { mods, bundles: [], warnings: [] };
  }

  const installRoot = selectors.installPathForGame(state, gameId);
  if (!installRoot) {
    return {
      mods,
      bundles: [],
      warnings: [
        `Could not resolve Vortex's staging folder for "${gameId}", so no ` +
          `bundled mod could be repacked. They will not ship.`,
      ],
    };
  }

  await fsp.mkdir(workDir, { recursive: true });

  const bundles: RepackedBundle[] = [];
  const warnings: string[] = [];
  const newSha = new Map<string, string>();
  let done = 0;

  for (const mod of wanted) {
    if (options.signal?.aborted === true) break;
    done += 1;
    options.onProgress?.(done, wanted.length, mod.name);

    const folder = mod.installationPath;
    if (folder === undefined || folder.length === 0) {
      warnings.push(
        `"${mod.name}" is flagged for bundling but Vortex records no staging ` +
          `folder for it, so its current files cannot be packed.`,
      );
      continue;
    }
    const stagingDir = path.join(installRoot, folder);

    try {
      const size = await directorySize(stagingDir);
      if (size > maxBytes) {
        warnings.push(
          `"${mod.name}" is flagged for bundling but its staging folder is ` +
            `${(size / 1024 ** 3).toFixed(1)} GB, over the ` +
            `${(maxBytes / 1024 ** 3).toFixed(1)} GB limit. It was NOT bundled — ` +
            `a collection carrying it would be unusable to download. Unflag it, ` +
            `or host the archive separately and give users instructions.`,
        );
        continue;
      }

      // `<dir>/*` so 7z stores paths relative to the staging root, matching
      // what the mod's own file list says. There is no cwd option in this
      // node-7z; see sevenZip.ts.
      const out = path.join(workDir, `${sanitize(mod.id)}.zip`);
      await fsp.rm(out, { force: true });
      await sevenZipAdd(
        sevenZip,
        out,
        [path.join(stagingDir, "*")],
        { raw: ["-tzip"], r: true },
        options.signal,
      );

      const sha256 = await hashFileSha256(out, options.signal);
      const bytes = (await fsp.stat(out)).size;
      bundles.push({ modId: mod.id, modName: mod.name, sourcePath: out, sha256, bytes });
      newSha.set(mod.id, sha256);
    } catch (err) {
      warnings.push(
        `"${mod.name}" is flagged for bundling but could not be packed from its ` +
          `staging folder: ${err instanceof Error ? err.message : String(err)}. ` +
          `It will not ship.`,
      );
    }
  }

  if (newSha.size === 0) {
    return { mods, bundles, warnings };
  }

  return {
    // Identity follows the bytes: the repacked archive is what the user gets,
    // so it is what the manifest must name.
    mods: mods.map((m) => {
      const sha = newSha.get(m.id);
      return sha !== undefined ? { ...m, archiveSha256: sha } : m;
    }),
    bundles,
    warnings,
  };
}

/** Keep a mod id usable as a filename without inventing collisions. */
function sanitize(id: string): string {
  return id.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
}

/**
 * Which external mods no longer match the archive they came from.
 *
 * This is the message that has to reach the curator, because bundling is
 * useless if nobody knows to tick the box. A mod edited in place looks
 * completely healthy: it installs, it deploys, the game runs. The divergence is
 * invisible until somebody else installs the collection and gets the ORIGINAL
 * archive — the curator's removals back, their additions absent.
 *
 * Compared by path in both directions rather than by content. Content matching
 * answers "did these bytes come from the archive", which a curator's edited
 * copy of an existing file would fail for an uninteresting reason; the question
 * here is "does this archive still describe this mod", and files appearing or
 * disappearing is what answers it.
 */
export type ExternalDrift = {
  modId: string;
  modName: string;
  /** In the archive, absent from staging — the curator removed them. */
  removed: string[];
  /** In staging, absent from the archive — the curator added them. */
  added: string[];
  /** Already flagged for bundling, so the drift is about to be shipped correctly. */
  bundled: boolean;
};

/**
 * Compare each external mod's staging folder against its source archive.
 *
 * Costs one 7z header read per external mod — about 20ms each, so a profile
 * with thirty of them pays under a second. Mods with no archive on disk are
 * skipped: there is nothing to diverge from, and their identity already comes
 * from the staged files.
 */
export async function detectExternalDrift(args: {
  state: types.IState;
  gameId: string;
  mods: AuditorMod[];
  config: CollectionConfig;
  sevenZip: SevenZipApi;
  isExternal: (mod: AuditorMod) => boolean;
  archivePathFor: (mod: AuditorMod) => string | undefined;
  listArchive: (archivePath: string) => Promise<{ entries: Array<{ path: string }> }>;
  signal?: AbortSignal;
}): Promise<ExternalDrift[]> {
  const installRoot = selectors.installPathForGame(args.state, args.gameId);
  if (!installRoot) return [];

  const out: ExternalDrift[] = [];
  for (const mod of args.mods) {
    if (args.signal?.aborted === true) break;
    if (!args.isExternal(mod)) continue;

    const archivePath = args.archivePathFor(mod);
    if (archivePath === undefined) continue;
    const staged = (mod.stagingFiles ?? []).map((f) => f.path.toLowerCase());
    if (staged.length === 0) continue;

    let entries: Array<{ path: string }>;
    try {
      entries = (await args.listArchive(archivePath)).entries;
    } catch {
      continue; // unreadable archive is the self-check's problem, not this one
    }

    const archived = entries.map((e) => e.path.toLowerCase());
    const stagedSet = new Set(staged);
    const archivedSet = new Set(archived);
    // Vortex strips a leading wrapper directory, so compare on tails the same
    // way omissionLeads does rather than demanding identical prefixes.
    const tailMatch = (needle: string, hay: Set<string>): boolean => {
      if (hay.has(needle)) return true;
      for (const h of hay) {
        if (h.endsWith(`/${needle}`) || needle.endsWith(`/${h}`)) return true;
      }
      return false;
    };

    const removed = archived.filter((a) => !tailMatch(a, stagedSet));
    const added = staged.filter((sPath) => !tailMatch(sPath, archivedSet));
    if (removed.length === 0 && added.length === 0) continue;

    out.push({
      modId: mod.id,
      modName: mod.name,
      removed,
      added,
      bundled: args.config.externalMods[mod.id]?.bundled === true,
    });
  }
  return out;
}

export function describeExternalDrift(drift: ExternalDrift[]): string[] {
  const unbundled = drift.filter((d) => !d.bundled);
  if (unbundled.length === 0) return [];

  const worst = [...unbundled].sort(
    (a, b) => b.removed.length + b.added.length - (a.removed.length + a.added.length),
  );
  const lines = [
    `${unbundled.length} external mod${unbundled.length === 1 ? "" : "s"} ` +
      `no longer match the archive ${unbundled.length === 1 ? "it" : "they"} came ` +
      `from — files have been added or removed in the staging folder since. ` +
      `Right now the collection ships the ARCHIVE, so whoever installs it gets ` +
      `the original, not your version. Tick "bundle" on ${unbundled.length === 1 ? "it" : "them"} ` +
      `to pack your actual files into the .ehcoll instead.`,
  ];
  for (const d of worst.slice(0, 5)) {
    lines.push(
      `  • "${d.modName}": ${d.removed.length} file(s) in the archive are not ` +
        `staged, ${d.added.length} staged file(s) are not in the archive` +
        (d.added.length > 0 ? ` (e.g. ${d.added[0]})` : "") +
        `.`,
    );
  }
  if (worst.length > 5) {
    lines.push(`  • and ${worst.length - 5} more; see the event-horizon log.`);
  }
  return lines;
}
