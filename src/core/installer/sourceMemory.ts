/**
 * ──────────────────────────────────────────────────────────────────────
 * Remember where the user found a mod we could not fetch for them.
 *
 * A collection carries mods Vortex cannot download — hand-installed things,
 * mods pulled from Nexus, files from elsewhere. For each one the install asks
 * the user to point at the archive, and that answer used to live only in the
 * wizard's state. Press "check and continue" a day later and it asks for every
 * one of them again, having learned nothing from the first time.
 *
 * A tester with two dozen external mods had to re-supply all of them to resume
 * an install he had already answered.
 *
 * ─── WRITTEN WHEN THE USER ANSWERS, NOT WHEN THE INSTALL SUCCEEDS ──────
 * The run that most needs this is the one that did NOT finish. Recording at
 * the end would remember only the answers that were already paid off by a
 * completed install, and forget precisely the ones the user would have to give
 * again. So the answer is kept the moment it is given.
 *
 * ─── AND IT IS A HINT, NEVER A SOURCE OF TRUTH ─────────────────────────
 * Nothing installs from this file on its own. A remembered path is offered
 * back as the pre-filled answer to the same question, and only after checking
 * the file is still there — drives get unplugged, folders get tidied, and a
 * silently-wrong path would install the wrong bytes under a compareKey that
 * claims otherwise. If the file is gone, the question is asked again, which is
 * exactly what should happen.
 *
 * The archive is still hashed and verified by the normal path afterwards. This
 * saves the user a file dialog; it does not lower the bar for what gets
 * installed.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as fsp from "fs/promises";
import * as path from "path";

export interface RememberedSource {
  /** Absolute path the user chose. */
  path: string;
  /** ISO-8601 UTC, so a stale entry can be reasoned about later. */
  rememberedAt: string;
}

/** compareKey → where the user said that mod lives. */
export type SourceMemory = Record<string, RememberedSource>;

export function getSourceMemoryDir(appDataPath: string): string {
  return path.join(appDataPath, "event-horizon", "install-ledger", "sources");
}

function memoryPath(appDataPath: string, packageId: string): string {
  // Per collection, keyed the same way the receipt is: two collections may
  // legitimately reference the same mod from different places.
  return path.join(getSourceMemoryDir(appDataPath), `${packageId}.json`);
}

/** Everything remembered for one collection. Never throws. */
export async function readSourceMemory(
  appDataPath: string,
  packageId: string,
): Promise<SourceMemory> {
  try {
    const raw = await fsp.readFile(memoryPath(appDataPath, packageId), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object") return {};
    const out: SourceMemory = {};
    for (const [key, value] of Object.entries(parsed as SourceMemory)) {
      const p = (value as { path?: unknown })?.path;
      if (typeof p !== "string" || p.length === 0) continue;
      const at = (value as { rememberedAt?: unknown })?.rememberedAt;
      out[key] = {
        path: p,
        rememberedAt: typeof at === "string" ? at : "",
      };
    }
    return out;
  } catch {
    // No file is the normal case, and an unreadable one must not stop an
    // install — it only means nothing is remembered.
    return {};
  }
}

/**
 * Remember one answer. Never throws.
 *
 * Merges rather than replaces: answers arrive one at a time as the user works
 * through the list, and a write that dropped the others would lose everything
 * said before it.
 */
export async function rememberSource(
  appDataPath: string,
  packageId: string,
  compareKey: string,
  filePath: string,
): Promise<void> {
  try {
    const current = await readSourceMemory(appDataPath, packageId);
    current[compareKey] = {
      path: filePath,
      rememberedAt: new Date().toISOString(),
    };
    const dir = getSourceMemoryDir(appDataPath);
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(
      memoryPath(appDataPath, packageId),
      JSON.stringify(current, null, 2),
      "utf8",
    );
  } catch {
    // Losing a convenience is not worth failing an install for.
  }
}

/**
 * The remembered answers whose files are STILL THERE.
 *
 * Existence is checked here rather than trusted, because the failure of a
 * stale path is silent: it would pre-fill an answer the user never re-confirms
 * and install from a file that has since changed or vanished.
 *
 * `exists` is injected so the filtering is testable without a filesystem.
 */
export async function usableSources(
  memory: SourceMemory,
  exists: (p: string) => Promise<boolean> = async (p) =>
    fsp
      .access(p)
      .then(() => true)
      .catch(() => false),
): Promise<SourceMemory> {
  const out: SourceMemory = {};
  for (const [key, value] of Object.entries(memory)) {
    if (await exists(value.path)) out[key] = value;
  }
  return out;
}

/** Forget one collection's answers entirely. Never throws. */
export async function forgetSources(
  appDataPath: string,
  packageId: string,
): Promise<void> {
  try {
    await fsp.unlink(memoryPath(appDataPath, packageId));
  } catch {
    // Absent is the normal case.
  }
}
