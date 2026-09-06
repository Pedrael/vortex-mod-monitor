/**
 * ──────────────────────────────────────────────────────────────────────
 * The sentences the curator reads are shipped output, so they get tested.
 *
 * This file exists because of one that was not. From alpha.28 to alpha.42 —
 * fifteen releases — every build that found undeclared post-processing told
 * the curator:
 *
 *   57 mod(s) have staged file(s) their archive cannot produce and are NOT
 *   declared post-processed """ + D + u""" "sse-xlodgen-output-pbr" (1608), ...
 *
 * The `""" + D + u"""` is a botched search-and-replace that was meant to be an
 * em dash. It compiled, it typechecked, 1300 tests passed, and it reached
 * `dist/`, because nothing anywhere asserted what that sentence actually says.
 *
 * `postProcessingDecision.ts` states the principle already — "The wording IS
 * the feature here, so it is tested like one" — and this is the module that
 * did not follow it.
 *
 * ─── TWO KINDS OF CHECK, ON PURPOSE ────────────────────────────────────
 * The first renders the real function and reads the result, which is the only
 * thing that can catch a wrong sentence. The second scans source for the
 * SIGNATURE of the accident — three consecutive double quotes, which arrive
 * when a Python or heredoc replacement leaks its own quoting into a file.
 * That one is cheap and catches the whole class, in copy this file has never
 * heard of.
 * ──────────────────────────────────────────────────────────────────────
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { describeUndeclaredPostProcessing } from "./runSelfChecks";
import type { SelfCheckReport } from "./selfCheckMod";

/** "These mods were answered, with no fingerprint recorded." */
const answered = (
  ids: string[],
): ReadonlyMap<string, { choice: "declare"; fingerprint?: string }> =>
  new Map(ids.map((id) => [id, { choice: "declare" as const }] as const));

const report = (
  modId: string,
  modName: string,
  unexplained: number,
): SelfCheckReport =>
  ({
    modId,
    modName,
    unexplained,
    unexplainedExamples: [],
    missing: [],
    omissionLeads: [],
    stagedCount: 0,
    expectedCount: 0,
    depth: "containment",
    notes: [],
  }) as unknown as SelfCheckReport;

describe("the undeclared-post-processing warning", () => {
  const line = (): string =>
    describeUndeclaredPostProcessing(
      [report("a", "sse-xlodgen-output-pbr", 1608), report("b", "Immersive Armours", 2)],
      answered([]),
    ) ?? "";

  it("says how many mods and names the worst of them", () => {
    expect(line()).toContain("2 mod(s)");
    expect(line()).toContain('"sse-xlodgen-output-pbr" (1608)');
  });

  it("carries no source-artefact debris", () => {
    // The exact failure that shipped for fifteen releases.
    expect(line()).not.toContain('"""');
    expect(line()).not.toContain("+ D + u");
  });

  it("separates the count from the names with an em dash", () => {
    expect(line()).toContain("post-processed — ");
  });

  it("stays silent when every mod is declared", () => {
    expect(
      describeUndeclaredPostProcessing(
        [report("a", "x", 5)],
        answered(["a"]),
      ),
    ).toBeUndefined();
  });
});

describe("no file carries a leaked replacement quote", () => {
  it('finds no """ anywhere in src', () => {
    // Three consecutive double quotes are not TypeScript. They are what a
    // Python heredoc leaves behind when its own quoting escapes into the
    // file it was editing — which is exactly how the warning above broke.
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry)) continue;
        // This file names the artefact in order to forbid it.
        if (entry === "curatorCopy.test.ts") continue;
        if (readFileSync(full, "utf8").includes('"""')) offenders.push(full);
      }
    };
    walk(join(__dirname, "..", ".."));
    expect(offenders).toEqual([]);
  });
});
