/**
 * Run the build-time self-check across every mod in a snapshot.
 *
 * ─── WHY IT IS AFFORDABLE ─────────────────────────────────────────────
 * Measured on the live 993-mod profile, an exhaustive check cost 2.41s per mod
 * — about 40 minutes — which is not acceptable on every build. Almost all of
 * that was walking the staging folder to CRC every file.
 *
 * The check that actually finds omissions does not need it. Deriving the
 * expected file set needs the archive HEADER (~0.02s), the FOMOD script, and
 * the recorded choices; comparing it to staging needs only the PATHS, which
 * `captureStagingFiles` has already collected. So this runs on paths and sizes
 * and skips content hashing entirely.
 *
 * Byte-level containment still degrades gracefully: without a CRC on the
 * staging side it falls back to size agreement, which `verifyStagingAgainstArchive`
 * reports as `size-only` and never as a match.
 *
 * ─── IT NEVER FAILS A BUILD ───────────────────────────────────────────
 * Every per-mod failure is contained. A build must not break because an archive
 * was deleted or a FOMOD script is exotic — the curator gets told what could
 * not be checked, and the build proceeds.
 */

import * as fs from "fs";
import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";

import type { types } from "@nexusmods/vortex-api";

import { getModArchivePath } from "../archiveHashing";
import type { AuditorMod } from "../getModsListForProfile";
import { ehLog } from "../logging/ehLog";
import type { SelfCheckReport } from "./selfCheckMod";
import { selfCheckMod, summarizeSelfChecks } from "./selfCheckMod";
import { resolveSevenZip } from "./sevenZip";
import type { SevenZipApi } from "./sevenZip";

export type RunSelfChecksOptions = {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, modName: string) => void;
};

export type SelfCheckRunResult = {
  reports: SelfCheckReport[];
  summary: ReturnType<typeof summarizeSelfChecks>;
  /** Lines suitable for the build's warning list. Empty when nothing to say. */
  warnings: string[];
};

/**
 * Extract one entry to a temp dir and read it.
 *
 * `sevenZip.extract` writes to disk — there is no in-memory entry read in the
 * node-7z surface Vortex exposes — so the temp dir is created and removed per
 * call. The files involved are FOMOD scripts, a few KB.
 */
function makeReadEntry(sevenZip: SevenZipApi) {
  return async (archivePath: string, entryPath: string): Promise<Buffer | undefined> => {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "eh-selfcheck-"));
    try {
      await new Promise<void>((resolve, reject) => {
        // $cherryPick selects the single entry; -y suppresses the overwrite
        // prompt, which would otherwise hang a headless extraction forever.
        const stream = sevenZip.extract(archivePath, dir, {
          $cherryPick: [entryPath],
          $raw: ["-y"],
        });
        stream.on("error", reject);
        stream.on("end", () => resolve());
      });
      // 7z flattens with `e`, but `extract` preserves paths; try both.
      const candidates = [
        path.join(dir, entryPath.split("/").join(path.sep)),
        path.join(dir, path.basename(entryPath)),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return await fsp.readFile(candidate);
      }
      return undefined;
    } catch {
      return undefined;
    } finally {
      await fsp.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  };
}

export async function runSelfChecks(
  state: types.IState,
  gameId: string,
  mods: AuditorMod[],
  opts?: RunSelfChecksOptions,
): Promise<SelfCheckRunResult> {
  let sevenZip: SevenZipApi;
  try {
    sevenZip = resolveSevenZip();
  } catch (err) {
    // Outside Vortex (tests, smoke runs) there is no SevenZip. Not an error.
    ehLog("warn", "selfcheck.unavailable", { err });
    return { reports: [], summary: summarizeSelfChecks([]), warnings: [] };
  }
  const readEntry = makeReadEntry(sevenZip);

  const reports: SelfCheckReport[] = [];
  const total = mods.length;
  let done = 0;

  for (const mod of mods) {
    if (opts?.signal?.aborted === true) break;
    done += 1;
    opts?.onProgress?.(done, total, mod.name);

    const staged = (mod.stagingFiles ?? []).map((f) => ({ path: f.path, size: f.size }));
    const archivePath = getModArchivePath(state, mod.archiveId, gameId);

    try {
      reports.push(
        await selfCheckMod({
          sevenZip,
          modId: mod.id,
          modName: mod.name,
          archivePath,
          staged,
          recordedChoices: mod.fomodSelections ?? [],
          readEntry,
          ...(opts?.signal !== undefined ? { signal: opts.signal } : {}),
        }),
      );
    } catch (err) {
      // selfCheckMod contains its own failures; this is belt and braces so one
      // pathological mod can never take a build down.
      ehLog("warn", "selfcheck.mod-threw", { mod: mod.name, err });
    }
  }

  const summary = summarizeSelfChecks(reports);

  // WHY a mod was not fully checked is the whole diagnostic value when the
  // numbers come back flat. The first real run reported skipped:993 in 112ms
  // and the reasons were sitting unread in each report's notes — a summary
  // that cannot explain itself is not a summary.
  const reasonCounts: Record<string, number> = {};
  for (const report of reports) {
    if (report.depth === "replayed") continue;
    const reason = report.notes[0] ?? "(no reason recorded)";
    reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
  }
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => `${count}x ${reason}`);

  // One concrete example, so a wrong path or id is visible rather than inferred.
  const firstSkipped = reports.find((r) => r.depth === "skipped");

  const warnings: string[] = [];
  const withMissing = reports.filter((r) => r.missing.length > 0);

  for (const report of withMissing) {
    warnings.push(
      `"${report.modName}" is missing ${report.missing.length} file(s) its FOMOD should have ` +
        `installed (e.g. ${report.missing[0]}). Reinstalling that mod before shipping is ` +
        `advisable — a collection built from it reproduces the gap.`,
    );
  }
  if (summary.skipped > 0) {
    warnings.push(
      `${summary.skipped} mod(s) could not be checked against their archive ` +
        `(archive missing from disk, or unreadable).`,
    );
  }

  ehLog("info", "selfcheck.done", {
    mods: reports.length,
    replayed: summary.replayed,
    containment: summary.containment,
    skipped: summary.skipped,
    modsWithMissing: summary.modsWithMissing,
    missingFiles: summary.missingFiles,
    reasons: topReasons,
    ...(firstSkipped !== undefined
      ? {
          exampleSkipped: {
            mod: firstSkipped.modName,
            stagedCount: firstSkipped.stagedCount,
            notes: firstSkipped.notes,
          },
        }
      : {}),
  });

  return { reports, summary, warnings };
}
