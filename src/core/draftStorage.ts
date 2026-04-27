/**
 * Draft storage — Phase 5.5.
 *
 * Lightweight on-disk persistence for "in-progress" curator/installer
 * forms so a half-filled wizard survives:
 *   • component remounts (user navigates away mid-flow and back),
 *   • React fiber reconciliations (e.g. error-boundary resets),
 *   • full Vortex restarts (hard crash, scheduled reboot, etc.).
 *
 * Design — why a JSON file instead of a Redux reducer:
 *   1. Curator drafts can be large (READMEs, CHANGELOGs, per-mod
 *      override blobs); persisting that in `state.persistent` would
 *      bloat the global store dump every Redux save tick.
 *   2. Drafts are read at most once per session (when a flow opens)
 *      and written every few hundred ms while the user is typing.
 *      A debounced fs write is cheaper than a Redux subscription.
 *   3. The data model is fully owned by the UI — no other extension
 *      ever needs to selectorize over a half-finished build form,
 *      and we don't want to leak draft contents into action logs.
 *
 *     <appData>/Vortex/event-horizon/drafts/<scope>-<key>.json
 *
 * Schema is intentionally simple: every record is `DraftEnvelope<T>`
 * with a `version` (so we can migrate later) and a `savedAt` ISO
 * timestamp (so the UI can show "Restored draft from 12 minutes ago").
 *
 * Errors are NEVER thrown to the UI directly — read failures resolve
 * to `undefined` (treated as "no draft"), write failures are logged
 * and swallowed (autosave should never crash the page).
 *
 * Atomicity: writes go to `<file>.tmp` first, then rename — the same
 * pattern used by `installLedger`. A truncated draft is worse than no
 * draft because the restore path would overwrite valid current state.
 */

import * as fsp from "fs/promises";
import * as path from "path";

import { util } from "vortex-api";

/**
 * Wire schema version — bump on breaking shape changes; older drafts
 * with a mismatched version are silently dropped on load.
 */
export const DRAFT_SCHEMA_VERSION = 1;

/**
 * Logical "drawer" a draft lives in. One scope per wizard / flow.
 *
 * Adding a new flow? Add it here so callers can't typo their way into
 * cross-pollinating each other's drafts.
 */
export type DraftScope = "build";

export interface DraftEnvelope<T> {
  /** Schema version of this envelope — see DRAFT_SCHEMA_VERSION. */
  version: number;
  /**
   * ISO timestamp of the last successful save. Used for the "Restored
   * draft from <relative time>" banner; never used for ordering or
   * conflict resolution (we always overwrite-in-place per key).
   */
  savedAt: string;
  /**
   * Human-readable scope/flow name — purely informational, useful when
   * inspecting raw files on disk.
   */
  scope: DraftScope;
  /**
   * Caller-provided key. For build drafts this is the active gameId,
   * so each game has its own independent in-progress build.
   */
  key: string;
  /** The actual draft payload. Opaque to this module. */
  payload: T;
}

/**
 * Resolve the on-disk path for a given (scope, key) pair.
 *
 * Pure — exposed for tests and for "Open drafts folder" affordances.
 * `key` is sanitised to a filesystem-safe slug so callers can pass
 * raw gameIds, profile names, etc. without worrying about path
 * traversal or reserved characters on Windows.
 */
export function getDraftPath(
  appDataPath: string,
  scope: DraftScope,
  key: string,
): string {
  const safeKey = sanitizeKey(key);
  return path.join(
    appDataPath,
    "Vortex",
    "event-horizon",
    "drafts",
    `${scope}-${safeKey}.json`,
  );
}

/**
 * Resolve the conventional drafts root used by Event Horizon.
 *
 * Provided so a future "show all drafts" UI affordance can list /
 * clean up old files without re-deriving the layout in three places.
 */
export function getDraftsRoot(appDataPath: string): string {
  return path.join(appDataPath, "Vortex", "event-horizon", "drafts");
}

/**
 * Best-effort load of a draft. Returns `undefined` whenever:
 *   • the file is missing,
 *   • the file is malformed JSON,
 *   • the schema version doesn't match,
 *   • the scope/key on disk doesn't match the requested pair
 *     (defence-in-depth against hand-edited files).
 *
 * Crucially it NEVER throws — autosave/restore must be invisible to
 * the user when something goes wrong on disk; the wizard simply
 * starts from a blank slate.
 */
export async function loadDraft<T>(
  appDataPath: string,
  scope: DraftScope,
  key: string,
): Promise<DraftEnvelope<T> | undefined> {
  const filePath = getDraftPath(appDataPath, scope, key);
  let raw: string;
  try {
    raw = await fsp.readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isPlainObject(parsed)) return undefined;
  const env = parsed as unknown as DraftEnvelope<T>;
  if (env.version !== DRAFT_SCHEMA_VERSION) return undefined;
  if (env.scope !== scope) return undefined;
  if (env.key !== key) return undefined;
  if (typeof env.savedAt !== "string") return undefined;
  if (!("payload" in env)) return undefined;
  return env;
}

/**
 * Atomically persist a draft to disk. Best-effort:
 *   • Returns `true` on success, `false` on any failure.
 *   • Failures are logged via console.warn but never propagated —
 *     a flaky disk should never tank the wizard.
 *
 * Callers should debounce this (the BuildPage uses ~500ms) — every
 * keystroke serialised + written would thrash the disk and shred the
 * battery on laptops without giving the user any extra safety.
 */
export async function saveDraft<T>(
  appDataPath: string,
  scope: DraftScope,
  key: string,
  payload: T,
): Promise<boolean> {
  const filePath = getDraftPath(appDataPath, scope, key);
  const envelope: DraftEnvelope<T> = {
    version: DRAFT_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    scope,
    key,
    payload,
  };
  try {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    await fsp.writeFile(tmpPath, JSON.stringify(envelope, null, 2), "utf8");
    await fsp.rename(tmpPath, filePath);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[Event Horizon] saveDraft(${scope}/${key}) failed:`, err);
    return false;
  }
}

/**
 * Idempotently delete a draft. Missing files are not an error.
 * Used after a successful build/install so the wizard re-opens fresh
 * next time, and from the "Discard draft" affordance.
 */
export async function deleteDraft(
  appDataPath: string,
  scope: DraftScope,
  key: string,
): Promise<void> {
  const filePath = getDraftPath(appDataPath, scope, key);
  try {
    await fsp.unlink(filePath);
  } catch (err) {
    // ENOENT is the happy path; only log the noisy ones.
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code !== "ENOENT") {
      // eslint-disable-next-line no-console
      console.warn(
        `[Event Horizon] deleteDraft(${scope}/${key}) failed:`,
        err,
      );
    }
  }
}

/**
 * Convenience — read the current Vortex appData path. Centralised
 * here so every caller doesn't reach into `vortex-api/util` directly
 * for the same one-liner.
 */
export function getAppDataPath(): string {
  return util.getVortexPath("appData");
}

// ─── Internals ────────────────────────────────────────────────────────

function sanitizeKey(key: string): string {
  // Replace anything that's not [A-Za-z0-9._-] with `_`. Empty strings
  // collapse to "default" so we always end up with a valid filename.
  const cleaned = key.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  return cleaned.length > 0 ? cleaned : "default";
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
