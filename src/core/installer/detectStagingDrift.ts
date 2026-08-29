/**
 * ──────────────────────────────────────────────────────────────────────
 * Has a mod changed since WE installed it?
 *
 * When a collection is updated, most of its mods are untouched between
 * versions. Those should already be on disk exactly as the previous install
 * left them — and when one is not, something modified it in between: the user
 * editing an INI inside a mod folder, a tool rewriting a plugin, a game that
 * writes into its own mod directory, or a genuine corruption.
 *
 * ─── THE REFERENCE IS OUR OWN WORK, NEVER THE CURATOR'S DISK ───────────
 * This does not compare against the curator at all, and that is the whole
 * design. A curator's staging diverges from its archive in ways nobody
 * notices — post-install tooling on ~11% of a real 993-mod profile, plus
 * files Vortex silently lost during THEIR install — so treating it as the
 * etalon promotes their accident to truth for everyone.
 *
 * The receipt records a fingerprint of what the previous install left on THIS
 * machine, and only for mods whose verification passed, so the reference is
 * something we proved rather than something we assumed.
 *
 * ─── WHAT A MISMATCH MEANS, AND WHAT IT DOES NOT ───────────────────────
 * It means "this changed since we installed it". That is a fact.
 *
 * It does NOT mean "this is wrong". A user is entitled to edit a mod, and
 * plenty of mods edit themselves. So the result is offered, never enforced:
 * reinstall to return to the collection's version, or keep what is there.
 * Deciding for them would silently discard deliberate work.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { InstallReceiptMod } from "../../types/installLedger";
import type { EhcollMod } from "../../types/ehcoll";

export type DriftCandidate = {
  compareKey: string;
  /** Name from the receipt — what the user called it when it was installed. */
  name: string;
  /** Vortex mod id recorded at install; where to look on disk. */
  vortexModId: string;
  /** The fingerprint the previous install left behind. */
  expectedHash: string;
};

/**
 * Which mods are worth checking for drift.
 *
 * Three conditions, and each excludes a case where a mismatch would mean
 * something other than drift:
 *
 *  1. The receipt recorded a hash. Absent means the previous install could not
 *     prove what it left — an older receipt, a "fast" package, or a mod that
 *     failed verification. Unknown is not "unchanged", and must not be
 *     reported as changed either.
 *
 *  2. The mod is STILL IN the new manifest. One that was dropped between
 *     versions is being removed, not drifting.
 *
 *  3. Its identity is UNCHANGED — same `compareKey`, which encodes
 *     `nexus:modId:fileId` or `external:<sha256>`. A mod the curator UPDATED
 *     is supposed to differ; checking it would report drift on every upgraded
 *     mod in the collection, which is both wrong and the loudest possible way
 *     to be wrong.
 *
 * Pure: the caller does the hashing and decides what to do.
 */
export function selectDriftCandidates(args: {
  receiptMods: readonly InstallReceiptMod[];
  /** Mods in the NEW manifest — the version being installed now. */
  manifestMods: readonly EhcollMod[];
}): DriftCandidate[] {
  const stillPresent = new Set(args.manifestMods.map((m) => m.compareKey));

  const out: DriftCandidate[] = [];
  for (const mod of args.receiptMods) {
    if (mod.stagingSetHash === undefined) continue; // (1)
    if (!stillPresent.has(mod.compareKey)) continue; // (2) and (3)
    out.push({
      compareKey: mod.compareKey,
      name: mod.name,
      vortexModId: mod.vortexModId,
      expectedHash: mod.stagingSetHash,
    });
  }
  return out;
}

export type DriftFinding = {
  compareKey: string;
  name: string;
  vortexModId: string;
};

/**
 * Hash each candidate's staging folder and report the ones that moved.
 *
 * Never throws, and a mod that cannot be read is NOT reported as drifted: a
 * folder that has been deleted, or is locked by the game, is a different
 * situation with a different answer, and calling it drift would tell the user
 * their files changed when what actually happened is that we could not look.
 *
 * The per-file hash cache does the heavy lifting — it keys on
 * `path|size|mtime`, so an untouched file costs a stat and a changed file is
 * the one thing worth reading. The cost is therefore proportional to what
 * actually moved, which for a collection nobody edited is almost nothing.
 */
export async function findDriftedMods(args: {
  candidates: readonly DriftCandidate[];
  /** Resolves a Vortex mod id to its absolute staging folder. */
  stagingRootFor: (vortexModId: string) => string | undefined;
  /** Where the user's hash cache lives. Omit to hash everything afresh. */
  cacheDir?: string;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, name: string) => void;
}): Promise<DriftFinding[]> {
  const { walkStagingFolder, hashStagingFiles } = await import(
    "../manifest/stagingFileWalker"
  );
  const { computeStagingSetHash } = await import("../manifest/stagingSetHash");
  const { loadArchiveHashCache, saveArchiveHashCache, makeHashLookup } =
    await import("../archiveHashCache");

  // hashStagingFiles documents its cache as opt-in, because "reusing a
  // curator-era hash would be meaningless" on a user's staging folder. That
  // caution does not reach here: the key is `absolutePath|size|mtime` and this
  // loads the USER'S OWN cache from their appData, so a curator's entry
  // cannot appear in it, let alone be mistaken for one of these files.
  let cache;
  let lookup;
  let added;
  if (args.cacheDir !== undefined) {
    try {
      cache = await loadArchiveHashCache(args.cacheDir);
      // makeHashLookup returns the lookup ALONGSIDE the entries it accumulates
      // — the cache object itself is not mutated, so saving means merging what
      // this run added. Treating the wrapper as the lookup silently disables
      // caching, which is a performance bug that no test would ever notice.
      const made = makeHashLookup(cache);
      lookup = made.lookup;
      added = made.added;
    } catch {
      lookup = undefined;
    }
  }

  const found: DriftFinding[] = [];
  let done = 0;
  for (const candidate of args.candidates) {
    if (args.signal?.aborted) break;
    done += 1;
    args.onProgress?.(done, args.candidates.length, candidate.name);

    const root = args.stagingRootFor(candidate.vortexModId);
    if (root === undefined) continue;

    try {
      const walked = await walkStagingFolder(root, args.signal);
      const hashed = await hashStagingFiles(
        root,
        walked,
        "thorough",
        undefined,
        args.signal,
        () => undefined,
        lookup,
      );
      const actual = computeStagingSetHash(hashed);
      // `undefined` means some file could not be hashed, so the set is not
      // describable — which is not the same as matching.
      if (actual !== undefined && actual !== candidate.expectedHash) {
        found.push({
          compareKey: candidate.compareKey,
          name: candidate.name,
          vortexModId: candidate.vortexModId,
        });
      }
    } catch {
      // Unreadable is not drifted. See the note above.
    }
  }

  if (cache !== undefined && added !== undefined && args.cacheDir !== undefined) {
    // Every hash computed here is one a later run does not repeat. Merged
    // rather than written back directly: makeHashLookup collects additions
    // separately and leaves the loaded cache untouched.
    const { mergeHashes } = await import("../archiveHashCache");
    await saveArchiveHashCache(
      args.cacheDir,
      mergeHashes(cache, added, new Date().toISOString()),
    ).catch(() => undefined);
  }
  return found;
}

/**
 * The user-facing summary, or `undefined` when nothing drifted.
 *
 * One aggregate line plus the names, on the same reasoning as the curator's
 * divergence report: a per-mod card for each of forty drifted mods buries
 * whatever else the screen was trying to say.
 *
 * Worded to describe rather than accuse, because we genuinely do not know
 * which of these the user did on purpose — and telling someone their
 * deliberate edit is damage is a good way to have them ignore the next one.
 */
export function describeStagingDrift(
  findings: readonly DriftFinding[],
): string[] | undefined {
  if (findings.length === 0) return undefined;

  const n = findings.length;
  const names = findings.slice(0, 10).map((f) => `  - ${f.name}`);
  if (n > 10) names.push(`  - ...and ${n - 10} more`);

  return [
    `${n} mod${n === 1 ? "" : "s"} on this machine changed since the ` +
      `collection last installed ${n === 1 ? "it" : "them"}, and ${
        n === 1 ? "it is" : "they are"
      } unchanged in this version of the collection. That usually means ` +
      `something edited ${n === 1 ? "it" : "them"} in between — you, a tool, ` +
      `or the game itself. Nothing here is necessarily wrong.`,
    ...names,
    `Reinstalling any of these returns it to the collection's version; ` +
      `leaving it keeps what is on disk. Event Horizon has changed nothing.`,
  ];
}
