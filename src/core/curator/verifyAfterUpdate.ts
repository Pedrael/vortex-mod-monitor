/**
 * ──────────────────────────────────────────────────────────────────────
 * Did this install actually produce the files the archive contains?
 *
 * The check the curator asked for, and it is not a new one. `runSelfChecks`
 * already lists a mod's archive, replays its FOMOD script against the choices
 * Vortex recorded, derives the file set that install SHOULD have produced, and
 * reports what is absent. It was written for the build side — proving the
 * curator's own staging is sound before it ships — and the question after an
 * update is identical.
 *
 * So this is an adapter, not an implementation. Reimplementing it would give
 * the project two answers to "was anything lost", and this session's audit was
 * mostly about what happens when a question has two owners.
 *
 * ─── WHY `fast` IS THE RIGHT LEVEL HERE ────────────────────────────────
 * `selfCheckMod` compares staged files against archive entries by SIZE on this
 * path — it never reads a staged file's hash — so capturing at `thorough`
 * would hash every byte of the mod to produce a field nothing then looks at.
 * On a 300 MB texture pack that is a minute of disk for no answer.
 *
 * ─── TWO SIGNALS, BECAUSE ONE COVERS ONLY A SIXTH OF MODS ──────────────
 * With a FOMOD script and recorded choices the expected file set is exact, and
 * anything absent from it is missing. But only ~17% of archives carry a
 * script. For the rest the shape of the gap is the evidence: a file never
 * meant to install belongs to a directory absent in its ENTIRETY, while one
 * Vortex lost leaves a hole in a directory that is otherwise present. That is
 * `findOmissionLeads` at `high` confidence, and using it is what makes this
 * check mean something on five mods out of six rather than shrugging at them.
 *
 * ─── AND WHY "COULD NOT CHECK" IS STILL ITS OWN ANSWER ─────────────────
 * A mod with no archive on disk yields no verdict at all. Reporting that as
 * "fine" would be the tool claiming a check it never ran — so it comes back as
 * `cannot-check` with the reason, and `runBulkUpdate` keeps it apart from the
 * mods it actually verified.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { types } from "@nexusmods/vortex-api";

import { captureStagingFiles } from "../manifest/captureStagingFiles";
import {
  getActiveProfileIdFromState,
  getModsForProfile,
} from "../getModsListForProfile";
import { runSelfChecks } from "../manifest/runSelfChecks";
import type { SelfCheckReport } from "../manifest/selfCheckMod";

export type VerifyResult =
  | { kind: "ok" }
  | { kind: "missing"; missing: string[] }
  | { kind: "cannot-check"; why: string };

/**
 * Check one just-installed mod against its own archive.
 *
 * Never throws: a verification that fell over is `cannot-check`, because the
 * one thing this must not do is report an unchecked mod as verified.
 */
export async function verifyUpdatedMod(args: {
  state: types.IState;
  gameId: string;
  /** The mod id Vortex reported installing. */
  vortexModId: string;
  signal?: AbortSignal;
}): Promise<VerifyResult> {
  const { state, gameId, vortexModId, signal } = args;
  try {
    // The profile is resolved rather than assumed: `getModsForProfile` needs
    // one, and Vortex's own selector answers globally — on a multi-game
    // machine it names a profile for the wrong game.
    const profileId = getActiveProfileIdFromState(state, gameId);
    if (profileId === undefined) {
      return {
        kind: "cannot-check",
        why: `no active profile for ${gameId}, so its mod list cannot be read`,
      };
    }
    const mod = getModsForProfile(state, gameId, profileId).find(
      (m) => m.id === vortexModId,
    );
    if (mod === undefined) {
      return {
        kind: "cannot-check",
        why:
          "Vortex installed it but the active profile does not list it yet, " +
          "so there is nothing to compare",
      };
    }

    // `fast`: path and size only. That is exactly what the containment check
    // reads, and hashing every byte here would buy a field nobody consults.
    const [enriched] = await captureStagingFiles(state, gameId, [mod], {
      level: "fast",
      ...(signal !== undefined ? { signal } : {}),
    });
    if (enriched === undefined || (enriched.stagingFiles?.length ?? 0) === 0) {
      return {
        kind: "cannot-check",
        why: "its staging folder could not be read",
      };
    }

    const { reports } = await runSelfChecks(state, gameId, [enriched], {
      ...(signal !== undefined ? { signal } : {}),
    });
    const report = reports[0];
    if (report === undefined) {
      return { kind: "cannot-check", why: "the archive check did not run" };
    }
    return verdictFromReport(report);
  } catch (err) {
    return {
      kind: "cannot-check",
      why: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Turn one self-check report into a verdict.
 *
 * Split out so the branch that matters — which evidence is believed — is
 * testable without an archive, a disk or Vortex. The IO above finds the
 * report; this decides what it means.
 */
export function verdictFromReport(report: SelfCheckReport): VerifyResult {
  if (report.depth === "skipped") {
    return {
      kind: "cannot-check",
      why: report.notes[0] ?? "the archive could not be inspected",
    };
  }
  if (report.missing.length > 0) {
    return { kind: "missing", missing: report.missing };
  }
  const dropped = report.omissionLeads.filter((l) => l.confidence === "high");
  if (dropped.length > 0) {
    return { kind: "missing", missing: dropped.map((l) => l.path) };
  }
  return { kind: "ok" };
}
