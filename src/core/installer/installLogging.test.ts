/**
 * The install driver logged NOTHING.
 *
 * runInstall, modInstall, bundledPrefetch and profile.ts had zero log calls
 * between them, while the build side logged extensively. So when a tester's
 * install sat and did not progress, the log he sent contained only
 * `extension.init`, `installer.api-probe` and `nexus.account-probe` — nothing
 * about the install at all, and no way to tell which mod it stopped on.
 *
 * These are source assertions rather than behavioural tests because runInstall
 * needs a live Vortex to exercise. That is exactly why the gap existed: there
 * is no cheap test that fails when logging is missing, so nothing objected for
 * the life of the project.
 */
import { describe, expect, it } from "vitest";

const read = async (rel: string): Promise<string> => {
  const fs = await import("fs");
  const path = await import("path");
  return fs.readFileSync(path.join(__dirname, rel), "utf8");
};

describe("the install driver is no longer silent", () => {
  it("logs the start of the run, with what it is installing", async () => {
    const src = await read("runInstall.ts");
    expect(src).toMatch(/ehLog\("info", "install\.start"/);
    // A log that starts mid-way through mod 400 with no header is a list of
    // names. The decision breakdown is what tells a reader whether they are
    // looking at a first run or a resumed one.
    expect(src).toMatch(/decisions: countByDecision\(/);
  });

  it("logs each mod BEFORE installing it, not after", async () => {
    // The load-bearing property. When an install hangs there is no "after":
    // a completion-only log ends with the last mod that SUCCEEDED and says
    // nothing about the one still running, which is the only one anybody
    // wants to know about.
    const src = await read("runInstall.ts");
    const start = src.indexOf('"install.mod.start"');
    const exec = src.indexOf("await executeDecision({");
    expect(start).toBeGreaterThan(-1);
    expect(exec).toBeGreaterThan(-1);
    expect(start).toBeLessThan(exec);
  });

  it("records how long each mod took, so slowness is visible as slowness", async () => {
    const src = await read("runInstall.ts");
    expect(src).toMatch(/"install\.mod\.done"/);
    expect(src).toMatch(/ms: Date\.now\(\) - modStartedAt/);
  });

  it("logs a failure with the decision kind, not just the message", async () => {
    // "Failed installing X" reaches the user. Which ARM it took, and how long
    // it ran first, is what separates one broken mod from everything after
    // mod 400 being slow.
    const src = await read("runInstall.ts");
    expect(src).toMatch(/"install\.mod\.failed"/);
    expect(src).toMatch(/decision: resolution\.decision\.kind/);
  });

  it("explains a stall with the budget that was in force", async () => {
    // Without the numbers, "it timed out" cannot be told from "the budget was
    // too small" — and that is the distinction deciding whether to fix the
    // code or the collection.
    const src = await read("modInstall.ts");
    expect(src).toMatch(/"install\.stalled"/);
    for (const field of ["phase:", "budgetMs", "idleSec", "wine:"]) {
      expect(src).toContain(field);
    }
  });

  it("keeps every install-path module reachable from a log line", async () => {
    // Enumerate-and-assert: the regression this guards is a module quietly
    // going dark again. runInstall and modInstall are the two that can hang;
    // if either stops logging, a remote stall becomes undiagnosable again.
    for (const f of ["runInstall.ts", "modInstall.ts"]) {
      const src = await read(f);
      expect(src, `${f} must import the logger`).toMatch(
        /import \{ ehLog \} from "\.\.\/logging\/ehLog"/,
      );
    }
  });
});
