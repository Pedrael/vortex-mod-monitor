/**
 * ──────────────────────────────────────────────────────────────────────
 * Can the USER still download what the curator packed?
 *
 * The curator never finds out on their own. Their copy of every mod is already
 * on disk, so a collection referencing a file Nexus deleted builds perfectly,
 * ships perfectly, and fails only on someone else's machine — as
 * "Nexus download for modId=… returned no archiveId", eight hundred mods into
 * an install, at which point the curator is not in the room.
 *
 * Two of those turned up in a tester's run (modIds 98669 and 82232) and failed
 * identically in every attempt for days. Nothing on the curator's side had
 * said a word.
 *
 * ─── WHAT THIS COSTS, MEASURED ─────────────────────────────────────────
 * `nexusGetModFiles` is per MOD, not per file, and a real collection has far
 * fewer mods than files: ivy-2 v1.0.9 is 955 mods, 926 Nexus-sourced, but only
 * **780 unique modIds**. One call answers every file from that mod.
 *
 * 780 calls is still a real chunk of a daily API budget, so this is an
 * explicit action rather than something every build pays for silently, and
 * results are cacheable by modId.
 *
 * ─── THE RULE THAT MATTERS MOST: UNKNOWN IS NOT MISSING ────────────────
 * A false "this mod is gone" is worse than no check at all. It tells the
 * curator to cut a mod that is perfectly fine, and they have no easy way to
 * discover the tool was wrong. So every failure to answer — a rejected call, a
 * rate limit, an offline machine, a response we do not recognise — resolves to
 * `unknown`, and `unknown` is reported as "could not check", never folded in
 * with the problems. This is the same five-state honesty the Doctor's health
 * checks use, for the same reason.
 *
 * ─── AND IT IS AN EARLY WARNING, NOT A GUARANTEE ───────────────────────
 * A file alive at pack time can die next week — authors routinely delete old
 * versions when they upload a new one, which is exactly how a collection rots.
 * So `old-version` is reported separately from `available`: those files are
 * downloadable *today* and are the ones most likely to disappear. A check that
 * only said "all fine" would be telling the truth and still leaving the
 * curator uninformed.
 * ──────────────────────────────────────────────────────────────────────
 */

import { ehLog, beginOp } from "../logging/ehLog";

export type NexusAvailability =
  /** Present in the mod's current file list. */
  | "available"
  /** Present, but flagged old/archived — downloadable now, fragile. */
  | "old-version"
  /** The mod exists; this file is not in its list any more. */
  | "file-missing"
  /** The mod page itself is gone, hidden, or under moderation. */
  | "mod-missing"
  /** Could not answer. NEVER treat as a problem. */
  | "unknown";

export interface AvailabilityEntry {
  compareKey: string;
  name: string;
  modId: number;
  fileId: number;
}

export interface AvailabilityFinding extends AvailabilityEntry {
  status: NexusAvailability;
  /** Why, in words, for the report. */
  detail?: string;
  /**
   * For a `file-missing` mod: the current main file, when there is one.
   *
   * The file list is already in hand at the moment we discover the loss, and
   * throwing it away leaves the curator with a problem and no next step. This
   * is the next step — the mod is still maintained, so the fix is usually to
   * move to this file and retest rather than to work around the old one.
   */
  replacement?: { fileId: number; name?: string; version?: string };
}

/**
 * One file as Nexus describes it.
 *
 * Both spellings are read on purpose. The Nexus REST API returns snake_case
 * (`file_id`, `category_name`); Vortex's `IFileInfo` wrapper is not something
 * this repo can verify locally, because `@nexusmods/nexus-api` is a
 * types-only transitive dependency that is not installed. Reading both costs
 * one `??` and removes a guess that would otherwise fail silently — as
 * "every file missing", the most alarming wrong answer available.
 */
export interface NexusFileLike {
  file_id?: number;
  fileId?: number;
  category_name?: string | null;
  categoryName?: string | null;
  name?: string;
  version?: string | null;
}

export function fileIdOf(file: NexusFileLike): number | undefined {
  return file.file_id ?? file.fileId;
}

function categoryOf(file: NexusFileLike): string {
  return (file.category_name ?? file.categoryName ?? "").toUpperCase();
}

/** Categories Nexus uses for files that still exist but are on their way out. */
const FRAGILE_CATEGORIES = new Set(["OLD_VERSION", "ARCHIVED"]);

/**
 * The file a curator would most likely move TO.
 *
 * Highest file id among the current main files: ids increase with upload, so
 * this is "the newest thing the author is actually publishing" without relying
 * on a timestamp field whose presence could not be verified here. Returns
 * undefined rather than guessing when the mod has no main file at all —
 * "update to nothing" is not advice.
 */
function currentMainFile(
  files: readonly NexusFileLike[],
): NexusFileLike | undefined {
  let best: NexusFileLike | undefined;
  let bestId = -1;
  for (const f of files) {
    const category = categoryOf(f);
    if (category !== "MAIN") continue;
    const id = fileIdOf(f);
    if (id === undefined || id <= bestId) continue;
    best = f;
    bestId = id;
  }
  return best;
}

/**
 * Where one file stands in the mod's list.
 *
 * An empty list comes back `unknown` HERE, on its own, because one lookup in
 * isolation genuinely cannot tell "this mod has no files" from "this response
 * was not understood". The walk resolves it with evidence this function does
 * not have — see `checkNexusAvailability`.
 */
export function classifyFile(
  files: readonly NexusFileLike[],
  fileId: number,
): {
  status: NexusAvailability;
  detail?: string;
  replacement?: { fileId: number; name?: string; version?: string };
} {
  if (files.length === 0) {
    return {
      status: "unknown",
      detail: "Nexus returned no file list for this mod.",
    };
  }
  const hit = files.find((f) => fileIdOf(f) === fileId);
  if (hit === undefined) {
    const current = currentMainFile(files);
    const currentId = current === undefined ? undefined : fileIdOf(current);
    return {
      status: "file-missing",
      detail:
        `The mod page still exists but file ${fileId} is no longer among its ` +
        `${files.length} file${files.length === 1 ? "" : "s"}.`,
      ...(current !== undefined && currentId !== undefined
        ? {
            replacement: {
              fileId: currentId,
              ...(current.name != null ? { name: current.name } : {}),
              ...(current.version != null ? { version: current.version } : {}),
            },
          }
        : {}),
    };
  }
  const category = categoryOf(hit);
  if (FRAGILE_CATEGORIES.has(category)) {
    return {
      status: "old-version",
      detail: `Still downloadable, but filed under ${category}.`,
    };
  }
  return { status: "available" };
}

export interface CheckAvailabilityDeps {
  /**
   * One call per unique modId. Should reject when the mod page is gone.
   *
   * Injected rather than reached for, so the whole walk is testable without a
   * network — the only way to test the rate-limit and give-up behaviour at all.
   */
  getModFiles: (modId: number) => Promise<readonly NexusFileLike[]>;
  onProgress?: (done: number, totalMods: number) => void;
  signal?: AbortSignal;
  /**
   * Stop after this many CONSECUTIVE failed lookups.
   *
   * The same lesson as the install driver's systemic-failure guard: once the
   * API has refused six times in a row it is going to refuse the other seven
   * hundred, and grinding through them turns a rate limit into a twenty-minute
   * wait that ends in no information. The rest are reported `unknown`, which
   * is exactly what they are.
   */
  giveUpAfterConsecutiveFailures?: number;
}

/**
 * Non-empty lookups needed before an EMPTY list is read as "mod is gone".
 *
 * Low on purpose: the question it answers is "did the response shape parse at
 * all", and five mods answering normally settles that. It exists so a
 * three-mod collection, or a run that mostly failed, does not convict a mod on
 * no evidence.
 */
export const EMPTY_LIST_TRUST_MIN = 5;

export interface AvailabilityReport {
  findings: AvailabilityFinding[];
  /** Unique mods actually looked up. */
  modsChecked: number;
  /** True when the walk stopped early; the remainder are `unknown`. */
  gaveUpEarly: boolean;
}

/** Is this an abort rather than a failure to answer? */
function isAbort(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "AbortError" || /abort/i.test(err.message))
  );
}

/**
 * Check every entry, one lookup per unique mod.
 *
 * Sequential on purpose. This is a read-only sweep and could be parallel, but
 * the thing most likely to go wrong is a rate limit, and firing eight hundred
 * requests at a service in order to discover it is rate-limiting us is the
 * wrong way round.
 */
export async function checkNexusAvailability(
  entries: readonly AvailabilityEntry[],
  deps: CheckAvailabilityDeps,
): Promise<AvailabilityReport> {
  const byMod = new Map<number, AvailabilityEntry[]>();
  for (const e of entries) {
    const list = byMod.get(e.modId);
    if (list === undefined) byMod.set(e.modId, [e]);
    else list.push(e);
  }

  const op = beginOp("nexus-availability.check", {
    entries: entries.length,
    uniqueMods: byMod.size,
  });

  const giveUpAfter = deps.giveUpAfterConsecutiveFailures ?? 6;
  const findings: AvailabilityFinding[] = [];
  const emptyListGroups: AvailabilityEntry[][] = [];
  let nonEmptyLookups = 0;
  let consecutiveFailures = 0;
  let gaveUpEarly = false;
  let modsChecked = 0;
  let done = 0;

  for (const [modId, group] of byMod) {
    if (deps.signal?.aborted === true) {
      gaveUpEarly = true;
    }

    if (gaveUpEarly) {
      for (const e of group) {
        findings.push({
          ...e,
          status: "unknown",
          detail: "Not checked — the sweep stopped early.",
        });
      }
      continue;
    }

    try {
      const files = await deps.getModFiles(modId);
      modsChecked += 1;
      consecutiveFailures = 0;
      if (files.length === 0) {
        // Held back, not decided. See the reconciliation below.
        emptyListGroups.push(group);
      } else {
        nonEmptyLookups += 1;
        for (const e of group) {
          findings.push({ ...e, ...classifyFile(files, e.fileId) });
        }
      }
    } catch (err) {
      if (isAbort(err)) {
        gaveUpEarly = true;
        ehLog("info", "nexus-availability.aborted", {
          modsChecked,
          totalMods: byMod.size,
        });
        for (const e of group) {
          findings.push({
            ...e,
            status: "unknown",
            detail: "Not checked — cancelled.",
          });
        }
        continue;
      }
      modsChecked += 1;
      consecutiveFailures += 1;
      // A rejected lookup is ambiguous: a deleted mod page and a refused
      // request look the same from here. Only call it gone while the API is
      // otherwise answering — during a failure streak, it is the API talking,
      // not the mod.
      const looksSystemic = consecutiveFailures >= giveUpAfter;
      ehLog(looksSystemic ? "error" : "warn", "nexus-availability.lookup-failed", {
        modId,
        consecutiveFailures,
        looksSystemic,
        err,
      });
      for (const e of group) {
        findings.push({
          ...e,
          status: looksSystemic ? "unknown" : "mod-missing",
          detail: looksSystemic
            ? "Not checked — Nexus stopped answering."
            : `Nexus did not return this mod page: ${
                err instanceof Error ? err.message : String(err)
              }`,
        });
      }
      if (looksSystemic) {
        gaveUpEarly = true;
        ehLog("error", "nexus-availability.gave-up", {
          modsChecked,
          totalMods: byMod.size,
        });
      }
    }

    done += 1;
    deps.onProgress?.(done, byMod.size);
  }

  // ─── an empty file list, decided by what the rest of the run proved ───
  //
  // On its own, "Nexus returned no files for this mod" is ambiguous: the mod
  // page is gone, or we failed to understand the response. This used to
  // resolve as `unknown` always, on the reasoning that a misread shape is more
  // likely than an author deleting every file of their own mod.
  //
  // A real run refuted that. 789 mods looked up, 781 came back with usable
  // file lists and 8 came back empty — and two of those 8 (modIds 82232 and
  // 98669) are independently PROVEN undownloadable: they failed in under a
  // second, identically, in every one of a tester's install runs. A response
  // format we could not parse would have produced 789 empty lists, not 8.
  //
  // So the run validates itself. Once this many lookups have returned real
  // data, the parsing demonstrably works, and an empty list is the mod being
  // gone. When it has not — a tiny collection, or a run that mostly failed —
  // the ambiguity stands and `unknown` is still the honest answer.
  const parsingProven =
    nonEmptyLookups >= EMPTY_LIST_TRUST_MIN &&
    nonEmptyLookups > emptyListGroups.length;
  for (const group of emptyListGroups) {
    for (const e of group) {
      findings.push({
        ...e,
        status: parsingProven ? "mod-missing" : "unknown",
        detail: parsingProven
          ? `Nexus lists no files for this mod at all — the page is gone, ` +
            `hidden, or under moderation. (${nonEmptyLookups} other mods in ` +
            `this run answered normally, so this is the mod, not the check.)`
          : "Nexus returned no file list, and too little else answered to " +
            "tell whether that means the mod is gone.",
      });
    }
  }

  op.ok({
    modsChecked,
    totalMods: byMod.size,
    gaveUpEarly,
    findings: findings.length,
    unknown: findings.filter((f) => f.status === "unknown").length,
    modMissing: findings.filter((f) => f.status === "mod-missing").length,
    fileMissing: findings.filter((f) => f.status === "file-missing").length,
    oldVersion: findings.filter((f) => f.status === "old-version").length,
  });

  return { findings, modsChecked, gaveUpEarly };
}

/**
 * "It", "Both", "All 5" or "3 of them" — whichever is actually true.
 *
 * The counts here are usually small and usually ALL of the set, and a report
 * that says "2 of those… 2 of these…" about the same two things reads like a
 * machine filling a template. Saying "Both" once is the same information and
 * sounds like someone who looked.
 */
export function subjectOf(n: number, total: number): string {
  if (n !== total) return `${n} of them`;
  if (n === 1) return "It";
  if (n === 2) return "Both";
  return `All ${n}`;
}

export interface AvailabilitySummary {
  available: number;
  oldVersion: number;
  fileMissing: number;
  modMissing: number;
  unknown: number;
  /** Nothing a user could fail to download. */
  clean: boolean;
  lines: string[];
}

/**
 * Turn findings into what the curator reads.
 *
 * Counts first, names second: "3 mods your users cannot download" is the
 * sentence that changes behaviour, and burying it under 926 rows of "fine"
 * is how a check gets ignored.
 */
export function summarizeAvailability(
  findings: readonly AvailabilityFinding[],
): AvailabilitySummary {
  const by = (s: NexusAvailability): AvailabilityFinding[] =>
    findings.filter((f) => f.status === s);

  const fileMissing = by("file-missing");
  const modMissing = by("mod-missing");
  const oldVersion = by("old-version");
  const unknown = by("unknown");
  const lines: string[] = [];

  const blocked = fileMissing.length + modMissing.length;
  if (blocked > 0) {
    lines.push(
      `${blocked} mod${blocked === 1 ? "" : "s"} in this collection cannot be ` +
        `downloaded from Nexus any more. Your copy still works — you already ` +
        `have the files — but anyone installing this collection will fail on ` +
        `${blocked === 1 ? "it" : "them"}.`,
    );
  }
  // Split, because the two mean different things and the difference is the
  // curator's whole decision. A tidied-up old version is an author shipping
  // v2.1; a vanished mod page is an author or a moderator deliberately taking
  // the mod out of circulation. Same "cannot download" outcome, opposite
  // stories about what the curator should do next.
  if (fileMissing.length > 0) {
    const replaceable = fileMissing.filter(
      (f) => f.replacement !== undefined,
    ).length;
    lines.push(
      `${subjectOf(fileMissing.length, blocked)} ${
        fileMissing.length === 1 ? "is a file that is" : "are files that are"
      } gone while the mod page is still up — usually an author cleaning up ` +
        `an old version after an update.${
          replaceable > 0
            ? ` ${subjectOf(replaceable, fileMissing.length)} ${
                replaceable === 1 ? "has" : "have"
              } a current main file listed below — but check before moving to ` +
              `it. The newest file is not always the right one: an older file ` +
              `is often pinned deliberately because it is the last that works ` +
              `with the game version this collection targets. Where you ` +
              `cannot move, the choice is the same as for a mod whose page ` +
              `is gone.`
            : ""
        }`,
    );
  }
  if (modMissing.length > 0) {
    lines.push(
      `${subjectOf(modMissing.length, blocked)} ${
        modMissing.length === 1 ? "is a mod whose page" : "are mods whose pages"
      } no longer exist${modMissing.length === 1 ? "s" : ""} at all. That is ` +
        `usually deliberate — an author pulling their work, or moderation — ` +
        `so treat ${modMissing.length === 1 ? "it" : "them"} as removed on ` +
        `purpose rather than as something to work around.`,
    );
  }
  if (oldVersion.length > 0) {
    lines.push(
      `${oldVersion.length} file${oldVersion.length === 1 ? " is" : "s are"} ` +
        `filed as an old or archived version. ${
          oldVersion.length === 1 ? "It downloads" : "They download"
        } today, but authors routinely delete old files when they publish an ` +
        `update — this is how a collection quietly stops working.`,
    );
  }
  if (unknown.length > 0) {
    lines.push(
      `${unknown.length} could not be checked. That is not a problem with ` +
        `${unknown.length === 1 ? "it" : "them"} — it means Nexus did not ` +
        `answer, so nothing is known either way. ${
          unknown.length === 1 ? "It is" : "They are"
        } listed below, because a mod nobody could check is also a mod ` +
        `nobody has confirmed your users can download.`,
    );
  }
  if (lines.length === 0) {
    lines.push(
      `Every Nexus mod in this collection is still downloadable. Worth ` +
        `re-checking before you publish an update: this is true today, not ` +
        `forever.`,
    );
  }

  return {
    available: by("available").length,
    oldVersion: oldVersion.length,
    fileMissing: fileMissing.length,
    modMissing: modMissing.length,
    unknown: unknown.length,
    clean: blocked === 0,
    lines,
  };
}
