/**
 * ──────────────────────────────────────────────────────────────────────
 * Does this verification failure actually justify a reinstall?
 *
 * `verifyModInstall` compares the user's staging against the CURATOR's
 * staging, and nothing else. That is a two-way comparison between two disks,
 * and it cannot tell apart the two situations it most needs to:
 *
 *   - the user's install went wrong, or
 *   - the CURATOR's staging diverged from its own archive.
 *
 * The second is not rare. Measured on a real 993-mod Fallout 4 profile, about
 * ELEVEN PERCENT of mods had staged files that legitimately differ from the
 * archive they came from — BA2 repacking, plugin cleaning, runtime-generated
 * config. For every one of those, on every user's machine, the driver saw a
 * mismatch, uninstalled, reinstalled from the archive, compared again against
 * the same post-processed reference, failed again, and recorded the mod as
 * broken. Twice the work, for files that were never wrong.
 *
 * The archive is the reference no one's extraction can corrupt, so it is the
 * tie-breaker. A user file that differs from the curator's copy but appears
 * IN THE ARCHIVE is not damaged — it is what a clean install produces, which
 * means reinstalling can only reproduce exactly what is already there.
 *
 * ─── WHAT THIS DELIBERATELY DOES NOT CLAIM ─────────────────────────────
 * "Explained by the archive" is not "correct", and "unexplained" is not
 * "corrupt" — a user may run their own optimiser too. This decides one narrow
 * question: whether spending a reinstall could possibly change the outcome.
 * When it cannot, the answer is no, whatever the cause.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as path from "path";

import { listArchiveNativeFirst } from "../manifest/listArchive";
import { crc32File } from "../manifest/readZip";
import {
  verifyStagingAgainstArchive,
  type StagedFileRef,
} from "../manifest/verifyAgainstArchive";

export type ReinstallJudgement =
  /**
   * Reinstalling could genuinely change the result.
   *
   * `archiveConsulted` says whether that verdict came from actually reading
   * the archive. It often does not: missing files are decided before the
   * archive is opened at all. The curator's report states "and they do not
   * match its archive either", and that sentence is only true when this is
   * true — a report claiming a comparison nobody made is worth less than no
   * report.
   */
  | { kind: "reinstall"; why: string; archiveConsulted: boolean }
  /**
   * The user's files are what the archive contains; the curator's copy is the
   * one that moved. A reinstall would reproduce exactly what is on disk.
   */
  | { kind: "curator-diverged"; explained: number; why: string }
  /**
   * We could not consult the archive, so we cannot tell. Falls back to
   * reinstalling — the behaviour that existed before this check — rather than
   * pretending an absent second opinion is a clean bill of health.
   */
  | { kind: "undecidable"; why: string };

export type JudgeInput = {
  /** Files the curator recorded that the user does not have. */
  missingFiles: string[];
  /** Files present on both sides whose content differs. */
  differingPaths: string[];
  /** Absolute path of the user's staging folder for this mod. */
  stagingRoot: string;
  /** The archive this mod was installed from, when we can find it. */
  archivePath: string | undefined;
  /** Injection point for tests; defaults to Vortex's own SevenZip. */
  sevenZip?: import("../manifest/sevenZip").SevenZipApi;
  signal?: AbortSignal;
};

/**
 * Never throws. A judgement that fails is answered `undecidable`, which
 * reinstalls — the status quo. Turning a verification detail into an install
 * failure would be a worse trade than an unnecessary reinstall.
 */
export async function judgeReinstall(
  input: JudgeInput,
): Promise<ReinstallJudgement> {
  // Missing files are the one thing the curator's staging is unambiguously
  // the right reference for. Content mutation does not affect PRESENCE, so a
  // file the curator recorded and the user lacks is an omission regardless of
  // any post-processing — and that is the failure this project was built to
  // catch. Never explained away.
  if (input.missingFiles.length > 0) {
    return {
      kind: "reinstall",
      why: `${input.missingFiles.length} file(s) the curator recorded are absent`,
      // Decided before the archive is opened — presence is not a content
      // question, so there is nothing here the archive could add.
      archiveConsulted: false,
    };
  }

  if (input.differingPaths.length === 0) {
    return {
      kind: "reinstall",
      why: "verification failed with no file detail",
      archiveConsulted: false,
    };
  }

  if (input.archivePath === undefined) {
    return {
      kind: "undecidable",
      why: "the archive this mod came from could not be located",
    };
  }

  // ZIP natively first, 7z only as the fallback — see listArchive.ts. This
  // check exists to stop ~11% of a collection being reinstalled for nothing,
  // and routing it solely through 7z meant it went silent on exactly the
  // prefix where 7z does not run.
  const attempt = await listArchiveNativeFirst({
    archivePath: input.archivePath,
    ...(input.sevenZip !== undefined ? { sevenZip: input.sevenZip } : {}),
    ...(input.signal !== undefined ? { signal: input.signal } : {}),
  });
  if (attempt.kind === "unreadable") {
    return {
      kind: "undecidable",
      why: `the archive could not be listed: ${attempt.why}`,
    };
  }
  const listing = attempt.listing;

  // An archive whose listing carries no CRCs can only be matched on size,
  // which is weak enough that calling a mod "fine" on its basis would be
  // guessing. Say so instead.
  if (listing.withCrc === 0) {
    return {
      kind: "undecidable",
      why: "the archive listing carries no checksums to compare against",
    };
  }

  const refs: StagedFileRef[] = [];
  for (const rel of input.differingPaths) {
    if (input.signal?.aborted) {
      return { kind: "undecidable", why: "cancelled" };
    }
    const abs = path.join(input.stagingRoot, ...rel.split("/"));
    try {
      const fsp = await import("fs/promises");
      const stat = await fsp.stat(abs);
      // CRC-32 specifically: it is what a ZIP central directory records, and
      // therefore the only hash that can ask whether these bytes are in that
      // archive. The sha256 verifyModInstall computed cannot answer it.
      const crc = await crc32File(abs, input.signal);
      refs.push({ path: rel, size: stat.size, crc });
    } catch {
      // Unreadable now though it existed a moment ago. Do not explain it away.
      return {
        kind: "reinstall",
        why: `"${rel}" could not be read back for comparison`,
        // The archive listing succeeded above; what failed was re-reading the
        // staged file, so the comparison genuinely was attempted.
        archiveConsulted: true,
      };
    }
  }

  const result = verifyStagingAgainstArchive(refs, listing);

  // `size-only` is NOT counted as explained here, unlike in the build-side
  // report. Acting on it means skipping a repair, and sizes agreeing while
  // checksums were available on neither side is too thin a reason to do that.
  if (result.matched === refs.length) {
    return {
      kind: "curator-diverged",
      explained: result.matched,
      why:
        `all ${result.matched} differing file(s) match the archive exactly — ` +
        `the curator's copy was modified after extraction, so reinstalling ` +
        `would reproduce what is already on disk`,
    };
  }

  return {
    kind: "reinstall",
    why:
      `${result.unexplained + result.sizeOnly} of ${refs.length} differing ` +
      `file(s) are not accounted for by the archive`,
    // The one verdict that earns the report's "and they do not match its
    // archive either".
    archiveConsulted: true,
  };
}
