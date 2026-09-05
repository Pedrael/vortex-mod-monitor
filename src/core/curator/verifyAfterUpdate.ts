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
 * ─── AND WHY "COULD NOT CHECK" IS ITS OWN ANSWER ───────────────────────
 * A mod with no archive on disk, or a FOMOD whose script would not replay,
 * yields no verdict. Reporting that as "fine" would be the tool claiming a
 * check it never ran — so it comes back as `cannot-check` with the reason, and
 * `runBulkUpdate` keeps it apart from the mods it actually verified.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { types } from "@nexusmods/vortex-api";

import { captureStagingFiles } from "../manifest/captureStagingFiles";
import {
  getActiveProfileIdFromState,
  getModsForProfile,
} from "../getModsListForProfile";
import { runSelfChecks } from "../manifest/runSelfChecks";

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
    if (report.depth === "skipped") {
      return {
        kind: "cannot-check",
        why: report.notes[0] ?? "the archive could not be inspected",
      };
    }
    if (report.missing.length > 0) {
      return { kind: "missing", missing: report.missing };
    }
    if (report.depth !== "replayed") {
      // Containment-only: we know every staged file came from the archive, but
      // not that every file the archive should have produced is present. That
      // is a weaker statement than "nothing was lost" and is reported as such.
      return {
        kind: "cannot-check",
        why:
          "no FOMOD script to replay, so the complete expected file set is " +
          "unknown — nothing staged is unexplained, which is not the same as " +
          "nothing missing",
      };
    }
    return { kind: "ok" };
  } catch (err) {
    return {
      kind: "cannot-check",
      why: err instanceof Error ? err.message : String(err),
    };
  }
}
