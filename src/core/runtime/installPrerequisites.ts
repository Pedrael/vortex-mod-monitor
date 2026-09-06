/**
 * ──────────────────────────────────────────────────────────────────────
 * Download and run the Microsoft runtime installers, then PROVE it helped.
 *
 * ─── THE CONTRACT THAT MATTERS ─────────────────────────────────────────
 * An exit code is not evidence. Under a Wine/Proton prefix an installer can
 * report success and change nothing, and 1638 reports "failure" on a machine
 * that was already fine. So this never says "fixed" on the strength of a
 * number: when the caller supplies {@link InstallPrereqDeps.verify}, the
 * result carries what that probe said AFTERWARDS, and that is what the UI
 * reports.
 *
 * The whole point of this module is to be able to say "we installed X and the
 * extractor now works" or "we installed X and it still does not" — never
 * "we installed X, good luck".
 *
 * ─── EVERY EXTERNAL EFFECT IS INJECTED ─────────────────────────────────
 * download / run / temp-dir are parameters, not imports. That is not test
 * theatre: this code downloads executables from the internet and runs them on
 * a user's machine, so the logic around WHEN it does that has to be testable
 * without ever doing it. The Wine behaviour itself cannot be verified from a
 * Windows dev box, and pretending otherwise would be the dishonest part.
 * ──────────────────────────────────────────────────────────────────────
 */

import { beginOp, ehLog } from "../logging/ehLog";

import {
  classifyExitCode,
  verdictIsGood,
  type ExitVerdict,
  type Prerequisite,
} from "./prerequisites";

export interface InstallPrereqDeps {
  /** Fetch `url` to `destPath`. Should reject on a non-2xx response. */
  download: (
    url: string,
    destPath: string,
    onBytes?: (received: number, total: number | undefined) => void,
  ) => Promise<void>;
  /** Run an executable and resolve with its exit code. */
  run: (exePath: string, args: string[]) => Promise<number>;
  /** A scratch directory the caller owns and will clean up. */
  makeTempDir: () => Promise<string>;
  /** Remove the scratch directory. Failures here are never fatal. */
  removeTempDir: (dir: string) => Promise<void>;
  /** Join path segments. Injected so this module imports no node builtins. */
  joinPath: (...parts: string[]) => string;
  /**
   * Re-probe the thing we were trying to fix, AFTER installing.
   *
   * Optional, but without it a result can only say what the installer claimed.
   * For the 7-Zip case this is the self-test, which is the only honest way to
   * answer "did that actually help?".
   */
  verify?: () => Promise<boolean>;
}

export type PrereqStep =
  | { phase: "downloading"; id: string; received: number; total?: number }
  | { phase: "installing"; id: string }
  | { phase: "verifying"; id: string }
  | { phase: "done"; id: string };

export interface PrereqResult {
  id: string;
  name: string;
  verdict: ExitVerdict;
  /**
   * What the post-install probe said, when one was supplied.
   *
   * `undefined` means nothing was checked — which the UI must render as
   * "installed, unverified" rather than as success.
   */
  verified?: boolean;
}

/**
 * Install the given prerequisites in order, stopping early only on abort.
 *
 * Sequential on purpose. Windows Installer serialises anyway — two at once
 * returns 1618 ("another installation is in progress") — and a user watching
 * a repair wants to see one thing happen at a time.
 */
export async function installPrerequisites(
  items: readonly Prerequisite[],
  deps: InstallPrereqDeps,
  opts: {
    onStep?: (step: PrereqStep) => void;
    signal?: { aborted: boolean };
  } = {},
): Promise<PrereqResult[]> {
  const op = beginOp("prerequisites.install", {
    items: items.length,
    ids: items.map((i) => i.id),
  });
  const results: PrereqResult[] = [];

  let dir: string;
  try {
    dir = await deps.makeTempDir();
  } catch (err) {
    op.fail(err, { stage: "make-temp-dir" });
    throw err;
  }

  try {
    for (const item of items) {
      if (opts.signal?.aborted === true) {
        ehLog("info", "prerequisites.install.aborted", {
          id: item.id,
          completed: results.length,
        });
        break;
      }

      const dest = deps.joinPath(dir, `${item.id}.exe`);

      try {
        ehLog("debug", "prerequisites.download.start", { id: item.id });
        opts.onStep?.({ phase: "downloading", id: item.id, received: 0 });
        await deps.download(item.url, dest, (received, total) => {
          opts.onStep?.({
            phase: "downloading",
            id: item.id,
            received,
            ...(total !== undefined ? { total } : {}),
          });
        });
        ehLog("debug", "prerequisites.download.ok", { id: item.id });
      } catch (err) {
        ehLog("warn", "prerequisites.download.fail", { id: item.id, err });
        results.push({
          id: item.id,
          name: item.name,
          verdict: {
            kind: "failed",
            why: `Download failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        });
        continue;
      }

      let verdict: ExitVerdict;
      try {
        opts.onStep?.({ phase: "installing", id: item.id });
        const exitCode = await deps.run(dest, item.silentArgs);
        verdict = classifyExitCode(exitCode);
        ehLog("debug", "prerequisites.run.done", {
          id: item.id,
          exitCode,
          verdict: verdict.kind,
        });
      } catch (err) {
        // A throw here is the prefix refusing to run the binary at all, which
        // is a different and more interesting failure than a non-zero code.
        ehLog("warn", "prerequisites.run.fail", { id: item.id, err });
        verdict = {
          kind: "failed",
          why: `Could not run the installer: ${
            err instanceof Error ? err.message : String(err)
          }`,
        };
      }

      let verified: boolean | undefined;
      if (deps.verify !== undefined && verdictIsGood(verdict)) {
        opts.onStep?.({ phase: "verifying", id: item.id });
        try {
          verified = await deps.verify();
          ehLog("debug", "prerequisites.verify.done", { id: item.id, verified });
        } catch (err) {
          // A probe that throws tells us nothing; it must not be reported as
          // a failed repair.
          ehLog("debug", "prerequisites.verify.threw", { id: item.id, err });
          verified = undefined;
        }
      }

      results.push({
        id: item.id,
        name: item.name,
        verdict,
        ...(verified !== undefined ? { verified } : {}),
      });
      opts.onStep?.({ phase: "done", id: item.id });

      // Stop as soon as the thing we were fixing works. Continuing would
      // install runtimes the user does not need to solve a solved problem.
      if (verified === true) {
        ehLog("info", "prerequisites.install.satisfied-early", { id: item.id });
        break;
      }
    }
  } finally {
    await deps.removeTempDir(dir).catch((err) => {
      ehLog("debug", "prerequisites.temp-dir-cleanup-failed", { err });
    });
  }

  op.ok({
    items: items.length,
    completed: results.length,
    verified: results.filter((r) => r.verified === true).length,
    failed: results.filter((r) => !verdictIsGood(r.verdict)).length,
  });
  return results;
}

/**
 * One sentence for the user, chosen by what we can actually claim.
 *
 * The three cases are deliberately distinct: a verified fix, an install we
 * could not verify, and an install that demonstrably did not help. Collapsing
 * the last two into "done" is how a repair tool loses people's trust.
 */
export function summarisePrereqResults(results: readonly PrereqResult[]): {
  fixed: boolean;
  message: string;
} {
  if (results.length === 0) {
    return { fixed: false, message: "Nothing was installed." };
  }

  if (results.some((r) => r.verified === true)) {
    return {
      fixed: true,
      message:
        "Installed, and the extractor works now. You can start the install.",
    };
  }

  if (results.some((r) => r.verified === false)) {
    const names = results
      .filter((r) => verdictIsGood(r.verdict))
      .map((r) => r.name)
      .join(", ");
    return {
      fixed: false,
      message:
        `${names || "The runtimes"} installed, but the extractor still does ` +
        `not work. That points at the Proton build rather than a missing ` +
        `runtime — try a different Proton version for the Vortex prefix.`,
    };
  }

  const failures = results.filter((r) => !verdictIsGood(r.verdict));
  if (failures.length === results.length) {
    return {
      fixed: false,
      message: `Nothing installed. ${
        failures[0]?.verdict.kind === "failed"
          ? failures[0].verdict.why
          : "The installers did not complete."
      }`,
    };
  }

  return {
    fixed: false,
    message:
      "Installed, but not verified — restart Vortex and try the install again.",
  };
}
