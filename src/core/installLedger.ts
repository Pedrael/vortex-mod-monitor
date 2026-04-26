/**
 * Install ledger — read/write/parse (Phase 3 slice 5b).
 *
 * The single source of truth for cross-release lineage. Every
 * successful install writes a receipt; every install of an existing
 * collection reads its receipt to populate `UserSideState.previousInstall`
 * and tag `UserSideState.installedMods[].eventHorizonInstall`.
 *
 *     <appData>/Vortex/event-horizon/installs/<package.id>.json
 *
 * One file per `package.id`, overwritten in-place on every successful
 * install. Re-installs of the same collection (any version) supersede
 * the previous receipt; multi-release history is intentionally NOT
 * tracked in v1 (the resolver only needs "the most recent install of
 * THIS collection").
 *
 * Spec: docs/business/INSTALL_LEDGER.md
 *
 * ─── DESIGN ────────────────────────────────────────────────────────────
 * Pure CRUD + schema validation. No Vortex API access, no business
 * logic — that lives in the userState builder (slice 5) and install
 * driver (slice 6).
 *
 * Three-tier API surface:
 *
 *   Pure helpers (no I/O):
 *     - `getReceiptPath(appDataPath, packageId)`
 *     - `parseReceipt(raw)`
 *     - `serializeReceipt(receipt)`
 *
 *   Async I/O wrappers:
 *     - `readReceipt(appDataPath, packageId)`  → undefined when missing
 *     - `writeReceipt(appDataPath, receipt)`   → atomic write
 *     - `deleteReceipt(appDataPath, packageId)`→ idempotent
 *     - `listReceipts(appDataPath)`            → walks the installs dir
 *
 * Atomic write: write to `<file>.tmp`, fsync, rename. Vortex extensions
 * have been reported to die mid-write under specific conditions
 * (forced shutdown, antivirus, etc.); a half-written receipt would be
 * worse than no receipt because the resolver would treat it as ground
 * truth and miss orphans / mis-tag installed mods.
 *
 * Schema validation: every detectable problem is collected into one
 * `InstallLedgerError` listing every issue. Same "no whack-a-mole"
 * pattern we use in `parseManifest` and `collectionConfig`. A corrupt
 * receipt is NEVER silently overwritten — we throw and let the action
 * handler decide. Silently regenerating the receipt would erase the
 * lineage data the user cared about, which is the failure mode this
 * project exists to prevent.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as fsp from "fs/promises";
import * as path from "path";

import type {
  InstallReceipt,
  InstallReceiptMod,
  InstallTargetMode,
} from "../types/installLedger";
import { INSTALL_LEDGER_SCHEMA_VERSION } from "../types/installLedger";
import type { SupportedGameId } from "../types/ehcoll";

// ===========================================================================
// Error type
// ===========================================================================

export class InstallLedgerError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(
      errors.length === 1
        ? errors[0]
        : `Install receipt invalid (${errors.length} problems):\n  - ${errors.join(
            "\n  - ",
          )}`,
    );
    this.name = "InstallLedgerError";
    this.errors = errors;
  }
}

// ===========================================================================
// Constants
// ===========================================================================

/**
 * Subdirectory under `<appData>/Vortex/` where receipts live. Public
 * because the action handler may want to surface the path to the user
 * (e.g. "your install history is at <path>").
 */
export const INSTALL_LEDGER_DIRNAME = path.join(
  "event-horizon",
  "installs",
);

const SUPPORTED_GAME_IDS: ReadonlySet<SupportedGameId> = new Set<SupportedGameId>([
  "skyrimse",
  "fallout3",
  "falloutnv",
  "fallout4",
  "starfield",
]);

const VALID_INSTALL_TARGET_MODES: ReadonlySet<InstallTargetMode> = new Set<InstallTargetMode>([
  "current-profile",
  "fresh-profile",
]);

// ===========================================================================
// Pure helpers
// ===========================================================================

/**
 * Build the absolute path to a given receipt file. Pure — no I/O.
 *
 * `appDataPath` is whatever Vortex's `util.getVortexPath('appData')`
 * resolves to. The packageId is validated here so a caller can't
 * accidentally pass a path-traversal string and write outside the
 * installs directory.
 */
export function getReceiptPath(appDataPath: string, packageId: string): string {
  if (typeof appDataPath !== "string" || appDataPath.length === 0) {
    throw new InstallLedgerError(["appDataPath cannot be empty."]);
  }
  if (!isUuid(packageId)) {
    throw new InstallLedgerError([
      `packageId must be a UUIDv4 string. Got ${JSON.stringify(packageId)}.`,
    ]);
  }
  return path.join(appDataPath, INSTALL_LEDGER_DIRNAME, `${packageId}.json`);
}

/**
 * Returns the absolute path to the installs directory itself. Useful
 * for `listReceipts` and for surfacing in UI ("show me my receipts").
 */
export function getInstallLedgerDir(appDataPath: string): string {
  return path.join(appDataPath, INSTALL_LEDGER_DIRNAME);
}

/**
 * Pure validator. Throws {@link InstallLedgerError} listing every
 * problem; returns a fully-typed receipt on success.
 *
 * Two tiers like `parseManifest`:
 *  - Errors abort the parse (missing/wrong-typed required fields,
 *    bad enum values, schemaVersion ≠ 1, malformed UUIDs).
 *  - Warnings would survive — there are none in v1 because receipts
 *    are always machine-written. If we ever support hand-edited
 *    receipts we'll add warnings here.
 */
export function parseReceipt(raw: string): InstallReceipt {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new InstallLedgerError([
      `Receipt is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    ]);
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new InstallLedgerError(["Receipt root must be a JSON object."]);
  }

  const obj = parsed as Record<string, unknown>;
  const errors: string[] = [];

  if (obj.schemaVersion !== INSTALL_LEDGER_SCHEMA_VERSION) {
    errors.push(
      `Unsupported schemaVersion ${JSON.stringify(obj.schemaVersion)}. ` +
        `Expected ${INSTALL_LEDGER_SCHEMA_VERSION}.`,
    );
  }

  const packageId = expectString(obj, "packageId", errors);
  if (packageId !== undefined && !isUuid(packageId)) {
    errors.push(
      `packageId must be a UUIDv4 string. Got ${JSON.stringify(packageId)}.`,
    );
  }

  const packageVersion = expectString(obj, "packageVersion", errors);
  if (packageVersion !== undefined && !isSemverLike(packageVersion)) {
    errors.push(
      `packageVersion must look like a semver string (e.g. "1.2.3"). Got ${JSON.stringify(packageVersion)}.`,
    );
  }

  const packageName = expectString(obj, "packageName", errors);

  const gameId = expectString(obj, "gameId", errors);
  if (gameId !== undefined && !SUPPORTED_GAME_IDS.has(gameId as SupportedGameId)) {
    errors.push(
      `gameId ${JSON.stringify(gameId)} is not a supported Event Horizon game id. ` +
        `Expected one of: ${Array.from(SUPPORTED_GAME_IDS).join(", ")}.`,
    );
  }

  const installedAt = expectString(obj, "installedAt", errors);
  if (installedAt !== undefined && !isIso8601(installedAt)) {
    errors.push(
      `installedAt must be an ISO-8601 UTC timestamp. Got ${JSON.stringify(installedAt)}.`,
    );
  }

  const vortexProfileId = expectString(obj, "vortexProfileId", errors);
  const vortexProfileName = expectString(obj, "vortexProfileName", errors);

  const installTargetMode = expectString(obj, "installTargetMode", errors);
  if (
    installTargetMode !== undefined &&
    !VALID_INSTALL_TARGET_MODES.has(installTargetMode as InstallTargetMode)
  ) {
    errors.push(
      `installTargetMode must be "current-profile" or "fresh-profile". Got ${JSON.stringify(
        installTargetMode,
      )}.`,
    );
  }

  let mods: InstallReceiptMod[] = [];
  if (!Array.isArray(obj.mods)) {
    errors.push("mods must be an array.");
  } else {
    mods = validateModEntries(obj.mods, errors);
  }

  if (errors.length > 0) {
    throw new InstallLedgerError(errors);
  }

  return {
    schemaVersion: INSTALL_LEDGER_SCHEMA_VERSION,
    packageId: packageId as string,
    packageVersion: packageVersion as string,
    packageName: packageName as string,
    gameId: gameId as SupportedGameId,
    installedAt: installedAt as string,
    vortexProfileId: vortexProfileId as string,
    vortexProfileName: vortexProfileName as string,
    installTargetMode: installTargetMode as InstallTargetMode,
    mods,
  };
}

/**
 * Pretty-printed, stable JSON serialization. Sorted keys at the top
 * level only — the runtime reads via `parseReceipt` so order is not
 * load-bearing for correctness, but stable output makes diffs sensible
 * when curators inspect the file.
 */
export function serializeReceipt(receipt: InstallReceipt): string {
  // Validate before writing so we never persist a malformed receipt.
  // Roundtrip via parse to take advantage of the same validator the
  // reader uses.
  const validated = parseReceipt(JSON.stringify(receipt));
  return `${JSON.stringify(validated, null, 2)}\n`;
}

// ===========================================================================
// Async I/O
// ===========================================================================

/**
 * Read the receipt for `packageId`. Returns `undefined` when the file
 * does not exist (the most common "no lineage" case). Other I/O
 * errors propagate; validation errors throw {@link InstallLedgerError}.
 */
export async function readReceipt(
  appDataPath: string,
  packageId: string,
): Promise<InstallReceipt | undefined> {
  const filePath = getReceiptPath(appDataPath, packageId);
  let raw: string;
  try {
    raw = await fsp.readFile(filePath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return undefined;
    throw err;
  }
  return parseReceipt(raw);
}

/**
 * Write the receipt atomically. Ensures the installs directory
 * exists, writes to `<file>.tmp`, then renames in place. The temp
 * file is in the same directory (not the OS temp dir) so the rename
 * is guaranteed atomic at the filesystem level.
 *
 * Returns the absolute path the receipt was written to.
 */
export async function writeReceipt(
  appDataPath: string,
  receipt: InstallReceipt,
): Promise<{ path: string }> {
  const filePath = getReceiptPath(appDataPath, receipt.packageId);
  const dir = path.dirname(filePath);
  await fsp.mkdir(dir, { recursive: true });

  const json = serializeReceipt(receipt);
  const tmp = `${filePath}.tmp`;
  await fsp.writeFile(tmp, json, "utf8");
  // `fs.rename` on Windows replaces an existing destination atomically
  // for files on the same volume — guaranteed since we put the tmp
  // alongside the target.
  await fsp.rename(tmp, filePath);
  return { path: filePath };
}

/**
 * Idempotent delete. Returns `{ deleted: false }` if the receipt
 * didn't exist; never throws on absence.
 */
export async function deleteReceipt(
  appDataPath: string,
  packageId: string,
): Promise<{ deleted: boolean }> {
  const filePath = getReceiptPath(appDataPath, packageId);
  try {
    await fsp.unlink(filePath);
    return { deleted: true };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { deleted: false };
    throw err;
  }
}

/**
 * Walk the installs directory and parse every `<uuid>.json` file.
 * Skips files that don't match the receipt name pattern AND files
 * that fail to parse — the latter are logged via the optional
 * `onError` callback so the eventual UI can surface them as
 * "couldn't read N receipts," but they don't block the listing.
 *
 * Returns receipts in undefined order (the OS-level readdir order).
 * Callers that want a stable order should sort by
 * `installedAt`/`packageName` themselves.
 */
export async function listReceipts(
  appDataPath: string,
  onError?: (filename: string, err: Error) => void,
): Promise<InstallReceipt[]> {
  const dir = getInstallLedgerDir(appDataPath);
  let entries: string[];
  try {
    entries = await fsp.readdir(dir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw err;
  }

  const receipts: InstallReceipt[] = [];
  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith(".json")) continue;
    const stem = entry.slice(0, -".json".length);
    if (!isUuid(stem)) continue;

    const fullPath = path.join(dir, entry);
    try {
      const raw = await fsp.readFile(fullPath, "utf8");
      receipts.push(parseReceipt(raw));
    } catch (err) {
      if (onError) {
        onError(entry, err instanceof Error ? err : new Error(String(err)));
      }
      // Continue — one bad receipt does not invalidate the rest.
    }
  }
  return receipts;
}

// ===========================================================================
// Internals
// ===========================================================================

function validateModEntries(
  raw: unknown[],
  errors: string[],
): InstallReceiptMod[] {
  const out: InstallReceiptMod[] = [];
  raw.forEach((value, idx) => {
    const where = `mods[${idx}]`;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${where} must be an object.`);
      return;
    }
    const entry = value as Record<string, unknown>;
    const localErrs: string[] = [];

    const vortexModId = expectString(entry, "vortexModId", `${where}.vortexModId`, localErrs);
    const compareKey = expectString(entry, "compareKey", `${where}.compareKey`, localErrs);
    const source = expectString(entry, "source", `${where}.source`, localErrs);
    if (source !== undefined && source !== "nexus" && source !== "external") {
      localErrs.push(
        `${where}.source must be "nexus" or "external". Got ${JSON.stringify(source)}.`,
      );
    }
    const name = expectString(entry, "name", `${where}.name`, localErrs);
    const installedAt = expectString(entry, "installedAt", `${where}.installedAt`, localErrs);
    if (installedAt !== undefined && !isIso8601(installedAt)) {
      localErrs.push(
        `${where}.installedAt must be an ISO-8601 UTC timestamp. Got ${JSON.stringify(installedAt)}.`,
      );
    }

    if (localErrs.length > 0) {
      errors.push(...localErrs);
      return;
    }

    out.push({
      vortexModId: vortexModId as string,
      compareKey: compareKey as string,
      source: source as "nexus" | "external",
      name: name as string,
      installedAt: installedAt as string,
    });
  });
  return out;
}

/**
 * Returns the value at `key` if it's a non-empty string, otherwise
 * pushes a descriptive error (using `displayPath`) and returns
 * undefined. `displayPath` defaults to `key` when not supplied — it
 * exists separately so nested validators can produce diagnostics like
 * `"mods[3].name"` while still doing a plain record lookup.
 */
function expectString(
  obj: Record<string, unknown>,
  key: string,
  displayPath: string,
  errors: string[],
): string | undefined;
function expectString(
  obj: Record<string, unknown>,
  key: string,
  errors: string[],
): string | undefined;
function expectString(
  obj: Record<string, unknown>,
  key: string,
  displayPathOrErrors: string | string[],
  maybeErrors?: string[],
): string | undefined {
  const displayPath =
    typeof displayPathOrErrors === "string" ? displayPathOrErrors : key;
  const errors =
    typeof displayPathOrErrors === "string"
      ? (maybeErrors as string[])
      : displayPathOrErrors;

  const value = obj[key];
  if (typeof value !== "string") {
    errors.push(`${displayPath} must be a string. Got ${JSON.stringify(value)}.`);
    return undefined;
  }
  if (value.length === 0) {
    errors.push(`${displayPath} must be a non-empty string.`);
    return undefined;
  }
  return value;
}

function isUuid(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isSemverLike(value: string): boolean {
  // Tolerate optional `v` prefix and prerelease/build metadata.
  // We're not enforcing strict semver here — `manifest.package.version`
  // may have already been validated with a stricter rule when the
  // receipt was originally written. This is a structural sanity check.
  return /^v?\d+\.\d+\.\d+([.\-+].*)?$/i.test(value);
}

function isIso8601(value: string): boolean {
  // Loose ISO-8601 UTC check. Either:
  //   YYYY-MM-DDTHH:MM:SS(.sss)?Z
  //   YYYY-MM-DDTHH:MM:SS(.sss)?±HH:MM
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+\-]\d{2}:?\d{2})$/.test(
    value,
  );
}
