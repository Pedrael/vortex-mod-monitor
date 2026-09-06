/**
 * The real download/run/temp implementations behind {@link installPrerequisites}.
 *
 * Kept apart from the logic on purpose: this file is the part that reaches the
 * network and spawns executables, and it is the part that cannot be unit
 * tested honestly. Everything that decides WHETHER and WHEN lives next door
 * with full coverage; this only decides HOW.
 *
 * ─── REDIRECTS ARE NOT OPTIONAL HERE ───────────────────────────────────
 * Every Microsoft link in the catalogue is a redirector — `aka.ms` and
 * `go.microsoft.com` both 302 to a CDN, and the .NET links chain twice. A
 * downloader that does not follow redirects writes a few hundred bytes of
 * HTML to disk, names it `.exe`, and hands it to the shell. The size check at
 * the end exists because that failure otherwise surfaces as a baffling
 * installer error rather than a bad download.
 */

import * as cp from "child_process";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as https from "https";
import * as os from "os";
import * as path from "path";

import type { InstallPrereqDeps } from "./installPrerequisites";

/** Anything smaller than this is not a Microsoft redistributable. */
const MIN_PLAUSIBLE_BYTES = 100_000;
const MAX_REDIRECTS = 8;

/**
 * ─── A SOCKET THAT GOES QUIET IS THE FAILURE THIS PATH ACTUALLY HAS ────
 * Node sets no default socket timeout, so a stalled CDN connection left the
 * promise pending forever: a permanent "Downloading…" notification with no
 * cancel, and a log that recorded `prerequisites.download.start` and then
 * nothing at all — `beginOp` left open with neither ok nor fail. Against
 * "diagnosable from the log alone", that is the worst shape available.
 *
 * `.on("error")` does not cover it: a stalled socket is open and silent, not
 * errored. Two separate limits, because they catch different things — a
 * connection that never establishes, and a transfer that dies mid-stream.
 */
const CONNECT_TIMEOUT_MS = 30_000;
const STALL_TIMEOUT_MS = 60_000;

function download(
  url: string,
  destPath: string,
  onBytes?: (received: number, total: number | undefined) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err?: Error): void => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve();
    };

    const go = (current: string, hops: number): void => {
      if (hops > MAX_REDIRECTS) {
        finish(new Error(`Too many redirects fetching ${url}`));
        return;
      }
      const req = https
        .get(current, { headers: { "User-Agent": "EventHorizon" } }, (res) => {
          const status = res.statusCode ?? 0;
          const location = res.headers.location;
          if (status >= 300 && status < 400 && location !== undefined) {
            res.resume();
            go(new URL(location, current).toString(), hops + 1);
            return;
          }
          if (status !== 200) {
            res.resume();
            reject(new Error(`HTTP ${status} fetching ${current}`));
            return;
          }

          const totalHeader = res.headers["content-length"];
          const total =
            typeof totalHeader === "string" ? Number(totalHeader) : undefined;
          let received = 0;

          // Past the headers, so the connect budget is spent; from here the
          // question is whether bytes keep arriving.
          req.setTimeout(0);
          let stall: ReturnType<typeof setTimeout> | undefined;
          const armStall = (): void => {
            if (stall !== undefined) clearTimeout(stall);
            stall = setTimeout(() => {
              req.destroy();
              finish(
                new Error(
                  `Download stalled after ${received} bytes from ${current} ` +
                    `— no data for ${STALL_TIMEOUT_MS / 1000}s.`,
                ),
              );
            }, STALL_TIMEOUT_MS);
            stall.unref?.();
          };
          armStall();

          const out = fs.createWriteStream(destPath);
          res.on("data", (chunk: Buffer) => {
            received += chunk.length;
            armStall();
            onBytes?.(received, total);
          });
          res.on("close", () => {
            if (stall !== undefined) clearTimeout(stall);
          });
          res.pipe(out);
          out.on("error", finish);
          out.on("finish", () => {
            if (stall !== undefined) clearTimeout(stall);
            out.close(() => {
              if (received < MIN_PLAUSIBLE_BYTES) {
                // Almost always an error page saved with an .exe name.
                finish(
                  new Error(
                    `Downloaded only ${received} bytes from ${current} — that ` +
                      `is not an installer. The link may have moved.`,
                  ),
                );
                return;
              }
              finish();
            });
          });
        })
        .on("error", finish);

      // The connection itself never opening — a different failure from a
      // transfer that dies part-way, and the one a dead mirror produces.
      req.setTimeout(CONNECT_TIMEOUT_MS, () => {
        req.destroy();
        finish(
          new Error(
            `No response from ${current} within ` +
              `${CONNECT_TIMEOUT_MS / 1000}s.`,
          ),
        );
      });

      // So the run can be stopped rather than waited out.
      signal?.addEventListener(
        "abort",
        () => {
          req.destroy();
          finish(new Error("Cancelled."));
        },
        { once: true },
      );
    };

    if (signal?.aborted === true) {
      finish(new Error("Cancelled."));
      return;
    }
    go(url, 0);
  });
}

function run(exePath: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = cp.spawn(exePath, args, {
      windowsHide: true,
      stdio: "ignore",
    });
    child.on("error", reject);
    // `code` is null when the process was killed by a signal, which under a
    // prefix is a crash rather than an exit status. Report it as one.
    child.on("close", (code) =>
      code === null
        ? reject(new Error("Installer was terminated before it exited"))
        : resolve(code),
    );
  });
}

/** Real effects for {@link installPrerequisites}. */
export function nodePrereqDeps(
  verify?: () => Promise<boolean>,
): InstallPrereqDeps {
  return {
    download,
    run,
    makeTempDir: () => fsp.mkdtemp(path.join(os.tmpdir(), "eh-prereq-")),
    removeTempDir: (dir) => fsp.rm(dir, { recursive: true, force: true }),
    joinPath: (...parts) => path.join(...parts),
    ...(verify !== undefined ? { verify } : {}),
  };
}
