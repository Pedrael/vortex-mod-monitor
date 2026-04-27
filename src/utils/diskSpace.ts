/**
 * Disk-space probing.
 *
 * We expose a single `getFreeBytes(path)` that returns the free bytes
 * available on the volume that hosts `path`, or `undefined` if the
 * underlying API isn't available (older Node, locked-down sandbox,
 * Electron renderer mismatch, ...).
 *
 * `undefined` is a deliberate signal — callers should treat "we don't
 * know" as "skip the warning" rather than "block the user". We never
 * want a flaky probe to gate an install.
 *
 * Implementation order:
 *   1. `fs.promises.statfs` (Node ≥ 18.15). Cheap, no shell out.
 *   2. (Future) `child_process` fallback for older Vortex bundles.
 */

import * as fs from "fs/promises";

/**
 * Returns free bytes available to the current user on the volume that
 * contains `targetPath`. The path doesn't need to exist — we walk up
 * to the closest existing ancestor before probing, because pre-flight
 * checks usually run *before* a directory is created.
 *
 * Returns `undefined` if probing isn't possible. Callers should treat
 * that as "skip the disk-space warning".
 */
export async function getFreeBytes(
  targetPath: string,
): Promise<number | undefined> {
  // statfs landed in 18.15. Older bundles (some Vortex builds) ship
  // with 16.x where the property is missing. Guard with a runtime
  // typeof check so we degrade gracefully.
  type StatfsModule = typeof fs & {
    statfs?: (p: string) => Promise<{ bavail: bigint; bsize: bigint }>;
  };
  const fsx = fs as StatfsModule;
  if (typeof fsx.statfs !== "function") return undefined;

  const probePath = await findExistingAncestor(targetPath);
  if (probePath === undefined) return undefined;

  try {
    const s = await fsx.statfs(probePath);
    // bavail = blocks available to non-superuser; bsize = block size.
    // Both are bigints on Node ≥ 20; on 18.15 some shims return
    // numbers. We coerce defensively.
    const bavail = typeof s.bavail === "bigint" ? s.bavail : BigInt(s.bavail);
    const bsize = typeof s.bsize === "bigint" ? s.bsize : BigInt(s.bsize);
    const total = bavail * bsize;
    // Number can hold up to ~9 PB exactly which is enough for any
    // user-facing display. We clamp to MAX_SAFE_INTEGER to avoid
    // surprises if a hilariously huge raid array shows up.
    if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number.MAX_SAFE_INTEGER;
    }
    return Number(total);
  } catch {
    return undefined;
  }
}

async function findExistingAncestor(p: string): Promise<string | undefined> {
  let current = p;
  // Cap iterations so a malformed path can't spin forever.
  for (let i = 0; i < 64; i++) {
    try {
      await fs.access(current);
      return current;
    } catch {
      // Not present — walk up.
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require("path") as typeof import("path");
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
  return undefined;
}

/** Human-readable byte string like "1.4 GB". Mirrored in BuildPage but
 * kept here so non-UI callers (logs, error context) can format too. */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v)} ${units[u]}`;
}
