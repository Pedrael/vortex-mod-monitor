/**
 * ──────────────────────────────────────────────────────────────────────
 * The report a user sends the curator when a mod cannot be made to match.
 *
 * This is the last rung of the escalation ladder, and it only exists because
 * the rungs beneath it removed the noise. A mod reaches here having:
 *
 *   - failed verification against the curator's staging,
 *   - been checked against its ARCHIVE and found to match neither reference,
 *   - and survived a reinstall.
 *
 * That last point is what makes the report worth a curator's attention. The
 * ~11% of mods whose curator-side staging was merely post-processed never get
 * here — they are settled earlier, by judgeReinstall — so a report that does
 * arrive is a genuine anomaly rather than one of a hundred false alarms.
 *
 * ─── WHAT IT MUST NOT DO ───────────────────────────────────────────────
 * Accuse. "Your mod is broken" is a conclusion the evidence does not support:
 * the archive may have been re-uploaded under the same file id, the user may
 * run their own tooling, a mod may write its own files at runtime. The report
 * states what was expected, what was found, and what was tried, and leaves the
 * conclusion to the person who can actually check.
 *
 * Written to be PASTED — into a Discord message, a Nexus comment, a GitHub
 * issue. That rules out anything a chat client will mangle and anything the
 * sender would have to redact: no absolute paths (they carry the user's real
 * name often enough), no machine identifiers.
 * ──────────────────────────────────────────────────────────────────────
 */

export type CuratorReportInput = {
  /** Collection identity, so the curator knows WHICH build to look at. */
  packageName: string;
  packageVersion: string;
  /** The package's own sha256 — proves which artefact the user actually has. */
  packageSha256?: string;

  modName: string;
  /** `compareKey` from the manifest: "nexus:1234:567890", "external:<sha>". */
  modCompareKey: string;
  modVersion?: string;

  /** Files the curator recorded and the user does not have. */
  missingFiles: string[];
  /** Files present on both sides whose bytes differ. */
  differingFiles: string[];
  /** Files the user has that the curator never recorded. */
  extraFiles: string[];

  /** What the ladder tried, in order, before giving up. */
  attempts: string[];
  /** Why the archive could not settle it, when it could not. */
  archiveNote?: string;

  /** Host description — "win32 (Wine/Proton)" is load-bearing information. */
  platform?: string;
};

/** How many example paths to show per category before summarising. */
const MAX_EXAMPLES = 8;

const list = (paths: string[]): string[] => {
  const shown = paths.slice(0, MAX_EXAMPLES).map((p) => `  - ${p}`);
  if (paths.length > MAX_EXAMPLES) {
    shown.push(`  - ...and ${paths.length - MAX_EXAMPLES} more`);
  }
  return shown;
};

/**
 * Build the pasteable report.
 *
 * Plain text, no markdown fences: a fenced block pasted into a Nexus comment
 * box arrives as literal backticks, and the one thing this must survive is
 * being pasted somewhere unknown.
 */
export function buildCuratorReport(input: CuratorReportInput): string {
  const lines: string[] = [];

  lines.push(`Event Horizon — mod could not be reproduced`);
  lines.push(``);
  lines.push(
    `Collection: ${input.packageName} v${input.packageVersion}`,
  );
  if (input.packageSha256 !== undefined) {
    // Proves WHICH build this is. A curator with two packages in circulation
    // otherwise has to guess, and the answer changes what the report means.
    lines.push(`Package sha256: ${input.packageSha256}`);
  }
  lines.push(`Mod: ${input.modName}${input.modVersion ? ` (${input.modVersion})` : ""}`);
  lines.push(`Mod id: ${input.modCompareKey}`);
  if (input.platform !== undefined) {
    lines.push(`Installed on: ${input.platform}`);
  }
  lines.push(``);

  lines.push(`What happened`);
  lines.push(
    `After installing, this mod's files did not match what the collection ` +
      `recorded, and they do not match its archive either.`,
  );
  lines.push(``);

  if (input.missingFiles.length > 0) {
    lines.push(`Missing (${input.missingFiles.length}) — recorded, not installed:`);
    lines.push(...list(input.missingFiles));
    lines.push(``);
  }
  if (input.differingFiles.length > 0) {
    lines.push(
      `Different (${input.differingFiles.length}) — installed, but not the recorded bytes:`,
    );
    lines.push(...list(input.differingFiles));
    lines.push(``);
  }
  if (input.extraFiles.length > 0) {
    // Informational, and said so: different FOMOD answers produce these
    // legitimately, and a curator reading a bare list will think otherwise.
    lines.push(
      `Extra (${input.extraFiles.length}) — present here, not in the collection. ` +
        `Often harmless (different installer options):`,
    );
    lines.push(...list(input.extraFiles));
    lines.push(``);
  }

  lines.push(`What was already tried`);
  for (const attempt of input.attempts) lines.push(`  - ${attempt}`);
  if (input.archiveNote !== undefined) lines.push(`  - ${input.archiveNote}`);
  lines.push(``);

  lines.push(`What this does and does not mean`);
  lines.push(
    `It does NOT prove the mod is broken. The archive may have been ` +
      `re-uploaded under the same file id since the collection was built, or ` +
      `something on this machine may be altering the files.`,
  );
  lines.push(
    `It DOES mean a clean install here cannot reproduce what the collection ` +
      `recorded, so anyone else installing it will most likely see the same.`,
  );
  lines.push(``);
  lines.push(
    `Worth checking: whether this mod still downloads the same archive it did ` +
      `when the collection was built.`,
  );

  return lines.join("\n");
}
