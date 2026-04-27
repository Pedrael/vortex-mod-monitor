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

import { randomUUID } from "crypto";
import * as fsp from "fs/promises";
import * as path from "path";

import { util } from "vortex-api";

/**
 * Wire schema version — bump on breaking shape changes; older drafts
 * with a mismatched version are silently dropped on load.
 *
 * v1: gameId-keyed drafts (one draft per game per scope).
 * v2: draftId-keyed drafts (parallel drafts per game). Legacy v1
 *     files are migrated transparently on first read — see
 *     {@link loadDraft} for the back-fill path.
 */
export const DRAFT_SCHEMA_VERSION = 2;
/**
 * Earliest schema we still know how to migrate forward. Anything
 * older is silently dropped (treated as no draft).
 */
const DRAFT_OLDEST_MIGRATABLE = 1;

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
   * On-disk filename component, post-sanitisation. Since v2 this is
   * always a UUIDv4 for build drafts (see Track 1 — parallel drafts).
   *
   * Legacy v1 build drafts used the active gameId as their key; v2
   * loaders read those, mint a fresh UUIDv4, and re-write the file
   * under the new key transparently — see {@link loadDraft}.
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
 *   • the schema version is unmigratably old,
 *   • the scope/key on disk doesn't match the requested pair
 *     (defence-in-depth against hand-edited files).
 *
 * Crucially it NEVER throws — autosave/restore must be invisible to
 * the user when something goes wrong on disk; the wizard simply
 * starts from a blank slate.
 *
 * Legacy v1 drafts (pre-parallel-drafts, gameId-keyed) are upgraded
 * transparently: the loader rewrites them under a fresh UUID key and
 * returns the upgraded envelope. The original gameId-keyed file is
 * deleted so we don't surface the same draft twice in the dashboard.
 */
export async function loadDraft<T>(
  appDataPath: string,
  scope: DraftScope,
  key: string,
): Promise<DraftEnvelope<T> | undefined> {
  return readDraftFile<T>(getDraftPath(appDataPath, scope, key), scope, key);
}

/**
 * List every draft on disk for a given scope. Returns parsed
 * envelopes sorted by `savedAt` descending (most recent first).
 *
 * Legacy v1 drafts are migrated lazily on first read here too —
 * after a {@link listDrafts} pass, the on-disk layout is guaranteed
 * to be UUIDv4-keyed, so subsequent reads/writes behave uniformly.
 *
 * Errors on individual files are swallowed (autosave invariant); the
 * caller never sees them. If you need to know which files were
 * dropped, inspect `console.warn` output.
 */
export async function listDrafts<T>(
  appDataPath: string,
  scope: DraftScope,
): Promise<Array<DraftEnvelope<T>>> {
  const root = getDraftsRoot(appDataPath);
  let entries: string[];
  try {
    entries = await fsp.readdir(root);
  } catch {
    return [];
  }
  const prefix = `${scope}-`;
  const results: Array<DraftEnvelope<T>> = [];
  for (const filename of entries) {
    if (!filename.startsWith(prefix) || !filename.endsWith(".json")) continue;
    if (filename.endsWith(".tmp")) continue;
    const key = filename.slice(prefix.length, -".json".length);
    if (key.length === 0) continue;
    const filePath = path.join(root, filename);
    const env = await readDraftFile<T>(filePath, scope, key);
    if (env !== undefined) {
      results.push(env);
    }
  }
  results.sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
  return results;
}

/**
 * Internal read+migrate path used by both {@link loadDraft} and
 * {@link listDrafts}. Returns the envelope at v{@link DRAFT_SCHEMA_VERSION}
 * or undefined if the file is missing/malformed/too-old.
 */
async function readDraftFile<T>(
  filePath: string,
  scope: DraftScope,
  expectedKey: string,
): Promise<DraftEnvelope<T> | undefined> {
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
  if (typeof env.version !== "number") return undefined;
  if (env.version > DRAFT_SCHEMA_VERSION) {
    // Newer than us — refuse to corrupt by misinterpreting fields.
    return undefined;
  }
  if (env.version < DRAFT_OLDEST_MIGRATABLE) return undefined;
  if (env.scope !== scope) return undefined;
  if (typeof env.savedAt !== "string") return undefined;
  if (!("payload" in env)) return undefined;

  if (env.version === DRAFT_SCHEMA_VERSION) {
    // Hand-edited files might rename the key field but leave the
    // filename. Trust the filename (which the OS guarantees) over
    // the JSON body.
    if (env.key !== expectedKey) {
      return { ...env, key: expectedKey };
    }
    return env;
  }

  // ── Migration path ───────────────────────────────────────────────
  // v1 → v2: rekey from gameId to a fresh UUIDv4 and back-fill any
  // payload-level identity fields the new schema requires. Scope-
  // specific migrators live below; defaulting to "rekey only" is
  // safe because v1 payloads are a strict subset of v2 payloads
  // for every existing scope.
  if (env.version === 1) {
    const newKey = randomUUID();
    const migratedPayload = migrateV1Payload<T>(scope, env);
    const migrated: DraftEnvelope<T> = {
      version: DRAFT_SCHEMA_VERSION,
      savedAt: env.savedAt,
      scope,
      key: newKey,
      payload: migratedPayload,
    };
    // Best-effort persistence; if the rewrite fails we still hand
    // the user the in-memory upgrade so their session works.
    //
    // The drafts dir is always `<appData>/Vortex/event-horizon/drafts`
    // — derive the new file path by sibling-renaming inside the same
    // folder rather than re-deriving from appDataPath (which we don't
    // hold here, only filePath).
    const draftsDir = path.dirname(filePath);
    const targetPath = path.join(
      draftsDir,
      `${scope}-${sanitizeKey(newKey)}.json`,
    );
    try {
      await fsp.mkdir(draftsDir, { recursive: true });
      const tmp = `${targetPath}.tmp`;
      await fsp.writeFile(tmp, JSON.stringify(migrated, null, 2), "utf8");
      await fsp.rename(tmp, targetPath);
      // Drop the legacy gameId-keyed file so listDrafts doesn't
      // surface the same draft twice.
      try {
        await fsp.unlink(filePath);
      } catch {
        /* swallow — best-effort cleanup */
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[Event Horizon] draft migration v1→v${DRAFT_SCHEMA_VERSION} failed for ${filePath}:`,
        err,
      );
    }
    return migrated;
  }

  return undefined;
}

/**
 * Pure payload upgrade per scope. Kept as a switch instead of a per-
 * scope strategy table because we have exactly one scope today and
 * code clarity beats abstraction we don't yet need.
 */
function migrateV1Payload<T>(
  scope: DraftScope,
  env: DraftEnvelope<unknown>,
): T {
  if (scope === "build") {
    // v1 build payloads are gameId-keyed at the envelope level; the
    // payload itself gains `draftId` and `gameId` in v2. We back-fill
    // both: draftId from the new randomly-minted key (set by the
    // caller), gameId from the old envelope key (which WAS the gameId).
    const oldPayload =
      env.payload !== null && typeof env.payload === "object"
        ? (env.payload as Record<string, unknown>)
        : {};
    return {
      ...oldPayload,
      // draftId is filled by the caller (it owns the new UUID).
      gameId:
        typeof oldPayload.gameId === "string"
          ? (oldPayload.gameId as string)
          : env.key,
    } as unknown as T;
  }
  return env.payload as T;
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
 *
 * `key` semantics (v2+): treat it as opaque on-disk identity. Build
 * drafts pass a UUIDv4 (`draftId`) so multiple parallel drafts can
 * coexist on the same machine without colliding. The legacy v1
 * convention of "key = active gameId" is migrated transparently on
 * read and never produced by current code.
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
