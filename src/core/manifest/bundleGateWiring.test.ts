/**
 * Every bundling gate must ask `mayBundle`, not `isNexusMod`.
 *
 * The unit tests on `mayBundle` cannot catch this. They prove the rule is
 * right; they say nothing about a caller that stopped asking it — which is
 * exactly what went wrong. `treatAsExternal` was taught to the branch that
 * chooses a mod's identity, and the two gates deciding whether an archive may
 * be BUNDLED each kept their own `isNexusMod(mod)` rejection. The flag
 * persisted, the manifest honoured it, and the build failed with "Only
 * external (non-Nexus) mods can be bundled" about ten mods the curator had
 * just declared external.
 *
 * Nothing in the type system links those three. This does, and it fails at the
 * moment a fourth copy is written rather than on a curator's machine.
 *
 * The same structural approach as `choicesWiring.test.ts`, for the same reason:
 * the property lives in the source, so the source is what gets read.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

/** Files that decide whether an archive may be bundled. */
const GATE_FILES = [
  join(ROOT, "ui", "pages", "build", "engine.ts"),
  join(ROOT, "actions", "buildPackageAction.ts"),
];

/**
 * The rejection branch, however it is spelled.
 *
 * Matches an `if` that rejects on a bare Nexus test — the shape both broken
 * gates had. `mayBundle(isNexusMod(mod), entry)` does not match, because the
 * call is not the whole condition.
 */
const BARE_NEXUS_REJECTION = /if\s*\(\s*isNexusMod\([a-zA-Z.]+\)\s*\)\s*\{/g;

describe("bundling gates", () => {
  const sources = GATE_FILES.map((f) => ({
    file: f,
    text: readFileSync(f, "utf8"),
  }));

  it("finds the files it claims to check", () => {
    // Guards the assertion below from passing because a path went stale — an
    // empty offender list would then look exactly like success.
    for (const s of sources) {
      expect(s.text.length).toBeGreaterThan(0);
      expect(s.text).toContain("bundled");
    }
  });

  it("routes every bundling decision through mayBundle", () => {
    const offenders: string[] = [];
    for (const { file, text } of sources) {
      // Only the bundle-resolution region: `isNexusMod` is used legitimately
      // elsewhere in these files (splitting mods for reporting, for example),
      // and banning it outright would be a rule nobody could follow.
      const start = text.indexOf("entry.bundled !== true");
      if (start === -1) {
        offenders.push(`${file}: no bundle-resolution loop found`);
        continue;
      }
      const region = text.slice(start, start + 2000);
      for (const m of region.matchAll(BARE_NEXUS_REJECTION)) {
        offenders.push(`${file}: rejects on bare ${m[0]}`);
      }
      if (!region.includes("mayBundle(")) {
        offenders.push(`${file}: bundle gate does not call mayBundle`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("can tell a bare rejection from a routed one", () => {
    // The check must be able to fail, or it proves nothing.
    expect(
      [...`if (isNexusMod(mod)) {`.matchAll(BARE_NEXUS_REJECTION)],
    ).toHaveLength(1);
    expect(
      [...`if (!mayBundle(isNexusMod(mod), entry)) {`.matchAll(
        BARE_NEXUS_REJECTION,
      )],
    ).toHaveLength(0);
  });
});
