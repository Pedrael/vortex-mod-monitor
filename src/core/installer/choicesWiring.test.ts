/**
 * Three install routes, the same omission, found three separate times.
 *
 *   1. Nexus downloads      — fixed when FOMOD replay was built.
 *   2. Hand-picked archives — found later; all 431 tests stayed green.
 *   3. Bundled archives     — found later still, by audit.
 *
 * Each time the primitive was covered and the CALL SITE was not, so the mod
 * installed with default options while the collection claimed to reproduce the
 * curator's build: every file present, every file correct, and the wrong ones.
 * Nothing about that is visible from outside, which is why it survived twice
 * after being fixed once.
 *
 * So this asserts the property structurally rather than per-path: every
 * install call in the driver that CAN carry the curator's answers does. A
 * fourth route added without them fails here, at the moment it is written,
 * instead of on someone's machine months later.
 *
 * It reads the real source because that is where the property lives — the same
 * approach as the theme-token check, which caught four dead tokens the type
 * system could not see.
 *
 * ─── AND NOW A SECOND OMISSION IN THE SAME SHAPE ───────────────────────
 * The user picks whether those answers are replayed silently or shown, and
 * that mode rides along with the choices as `replayArgs(entry, mode)`. The
 * mode argument is OPTIONAL and defaults to silent — so `replayArgs(entry)`
 * compiles, replays the right answers, and quietly ignores what the user asked
 * for. That is the identical failure this file was written for: correct
 * output, wrong provenance, invisible from outside. Hence the second check.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DRIVER = join(__dirname, "runInstall.ts");

/** Install primitives that accept the curator's recorded installer answers. */
const CHOICE_CAPABLE = [
  "installNexusViaApi",
  "installFromExistingDownload",
  "installFromLocalArchive",
  "installFromBundledArchive",
];

/**
 * The argument object of each call to `fn` in the driver.
 *
 * Brace-matched rather than regexed to the closing paren: these calls contain
 * nested objects and a lazy match would stop at the first `}`.
 */
function callArguments(source: string, fn: string): string[] {
  const out: string[] = [];
  const needle = `await ${fn}(`;
  let from = 0;
  for (;;) {
    const start = source.indexOf(needle, from);
    if (start === -1) return out;
    let depth = 0;
    let i = start + needle.length - 1;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    out.push(source.slice(start, i + 1));
    from = i + 1;
  }
}

describe("installer choices wiring", () => {
  const source = readFileSync(DRIVER, "utf8");

  it("passes the curator's choices at every choice-capable install call", () => {
    const offenders: string[] = [];
    for (const fn of CHOICE_CAPABLE) {
      for (const call of callArguments(source, fn)) {
        if (!call.includes("choices") && !call.includes("replayArgs(")) {
          offenders.push(`${fn}: ${call.slice(0, 90).replace(/\s+/g, " ")}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("actually finds the calls it claims to check", () => {
    // Guards the assertion above from passing because the parser silently
    // stopped matching — an empty offender list would then look like success.
    const total = CHOICE_CAPABLE.reduce(
      (n, fn) => n + callArguments(source, fn).length,
      0,
    );
    expect(total).toBeGreaterThanOrEqual(4);
  });

  it("threads the user's replay mode, not just the choices", () => {
    // `replayArgs(entry)` type-checks and silently falls back to the default
    // mode, so passing the choices is no longer sufficient on its own.
    const offenders: string[] = [];
    for (const fn of CHOICE_CAPABLE) {
      for (const call of callArguments(source, fn)) {
        if (!call.includes("replayArgs(")) continue;
        if (!/replayArgs\([^)]*,[^)]*\)/.test(call)) {
          offenders.push(`${fn}: replayArgs called without a mode`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("can tell a replayArgs call WITHOUT a mode from one with it", () => {
    // Both checks above must be able to fail, or they prove nothing.
    const bare = "await installFromLocalArchive(a, { ...replayArgs(e) })";
    const moded =
      "await installFromLocalArchive(a, { ...replayArgs(e, ctx.decisions.fomodReplayMode) })";
    const re = /replayArgs\([^)]*,[^)]*\)/;
    expect(re.test(bare)).toBe(false);
    expect(re.test(moded)).toBe(true);
  });

  it("can tell a call WITHOUT choices from one with them", () => {
    // The check itself must be able to fail, or it proves nothing.
    const fake = `const r = await installFromBundledArchive(ctx.api, {\n  gameId: g,\n});`;
    const calls = callArguments(fake, "installFromBundledArchive");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.includes("choices")).toBe(false);
  });
});
