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

function download(
  url: string,
  destPath: string,
  onBytes?: (received: number, total: number | undefined) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const go = (current: string, hops: number): void => {
      if (hops > MAX_REDIRECTS) {
        reject(new Error(`Too many redirects fetching ${url}`));
        return;
      }
      https
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

          const out = fs.createWriteStream(destPath);
          res.on("data", (chunk: Buffer) => {
            received += chunk.length;
            onBytes?.(received, total);
          });
          res.pipe(out);
          out.on("error", reject);
          out.on("finish", () => {
            out.close(() => {
              if (received < MIN_PLAUSIBLE_BYTES) {
                // Almost always an error page saved with an .exe name.
                reject(
                  new Error(
                    `Downloaded only ${received} bytes from ${current} — that ` +
                      `is not an installer. The link may have moved.`,
                  ),
                );
                return;
              }
              resolve();
            });
          });
        })
        .on("error", reject);
    };
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
