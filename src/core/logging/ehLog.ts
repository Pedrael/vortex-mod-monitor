/**
 * Event Horizon operation log.
 *
 * WHY THIS EXISTS: the extension only ever used `console.*`, which reaches
 * Electron's devtools console and nothing else. Nothing survives the session,
 * so "run it and tell me what happened" had no answer that did not involve the
 * user copying text out of devtools by hand.
 *
 * Two sinks, deliberately:
 *
 *  1. A dedicated JSONL file under `<event-horizon>/logs/`. One JSON object per
 *     line, so it can be read, grepped and parsed without a parser. This is the
 *     record you hand to someone debugging a run.
 *  2. Vortex's own `log()`, so entries also land in `%APPDATA%/Vortex/vortex.log`
 *     alongside everything else Vortex did at that moment — which is what makes
 *     a Vortex support request useful.
 *
 * ─── RULES ────────────────────────────────────────────────────────────
 * • Logging must NEVER break a feature. Every path here swallows its own
 *   errors; a failed write loses a line, it does not fail an export.
 * • Writes are queued and appended in order rather than written synchronously.
 *   `appendFileSync` in a renderer blocks the UI thread, and this runs during
 *   long operations where that would be felt.
 * • Payloads are truncated. A mods snapshot is megabytes; a log line that
 *   embeds one is not a log line.
 * ──────────────────────────────────────────────────────────────────────
 */

import { log as vortexLog } from "@nexusmods/vortex-api";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";

import { getEventHorizonDir } from "../paths";

export type EhLogLevel = "debug" | "info" | "warn" | "error";

/** Max characters of any single stringified metadata value. */
const MAX_VALUE_CHARS = 2000;

/**
 * Appends are chained onto this promise so lines land in call order even though
 * each write is async. A rejected link would poison the chain, so every link
 * catches.
 */
let writeQueue: Promise<void> = Promise.resolve();

/** Resolved once per session; `undefined` means "logging unavailable, stay quiet". */
let logFilePath: string | undefined;
let logFileResolved = false;

function resolveLogFile(): string | undefined {
  if (logFileResolved) return logFilePath;
  logFileResolved = true;
  try {
    const dir = getEventHorizonDir("logs");
    fs.mkdirSync(dir, { recursive: true });
    // One file per day. Long enough to hold a whole test session, short enough
    // that the file never becomes the thing you have to bisect.
    const day = new Date().toISOString().slice(0, 10);
    logFilePath = path.join(dir, `event-horizon-${day}.log`);
  } catch {
    // No log file (permissions, missing path). Vortex's own log still gets everything.
    logFilePath = undefined;
  }
  return logFilePath;
}

/** Where this session is writing, for surfacing in the UI. `undefined` if unavailable. */
export function getLogFilePath(): string | undefined {
  return resolveLogFile();
}

function truncate(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > MAX_VALUE_CHARS
      ? `${value.slice(0, MAX_VALUE_CHARS)}…[+${value.length - MAX_VALUE_CHARS} chars]`
      : value;
  }
  if (Array.isArray(value)) {
    // Arrays are usually mod lists. Length is the interesting part, not contents.
    return value.length <= 20
      ? value.map(truncate)
      : { length: value.length, sample: value.slice(0, 10).map(truncate) };
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack?.split("\n").slice(0, 8) };
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = truncate(v);
    }
    return out;
  }
  return value;
}

function enqueue(line: string): void {
  const file = resolveLogFile();
  if (file === undefined) return;
  writeQueue = writeQueue
    .then(() => fsp.appendFile(file, line + "\n", "utf8"))
    .catch(() => {
      /* a lost log line must never surface as a feature failure */
    });
}

/**
 * Record one event.
 *
 * @param level   severity; `error` also carries the stack when `data.err` is an Error
 * @param event   short stable identifier, e.g. "export.start" — grep on this
 * @param data    structured context; truncated, never trusted to be small
 */
export function ehLog(level: EhLogLevel, event: string, data?: Record<string, unknown>): void {
  const payload = data === undefined ? undefined : (truncate(data) as Record<string, unknown>);
  try {
    const entry = {
      ts: new Date().toISOString(),
      level,
      event,
      ...(payload === undefined ? {} : { data: payload }),
    };
    enqueue(JSON.stringify(entry));
  } catch {
    /* stringify can throw on exotic cycles; the vortex sink below still runs */
  }
  try {
    // Vortex's levels: debug | info | warn | error — ours map 1:1.
    vortexLog(level, `[Event Horizon] ${event}`, payload);
  } catch {
    /* vortexLog is unavailable outside Vortex (tests, smoke runs) */
  }
}

/** Handle returned by {@link beginOp}. */
export interface EhOp {
  /** A milestone inside the operation. */
  step: (name: string, data?: Record<string, unknown>) => void;
  /** Successful completion; logs elapsed ms. */
  ok: (data?: Record<string, unknown>) => void;
  /** Failure; logs elapsed ms plus the error. */
  fail: (err: unknown, data?: Record<string, unknown>) => void;
}

/**
 * Bracket a core operation so the log shows start, milestones, and an explicit
 * end with a duration — the shape you need to answer "where did it stop?".
 *
 * Every core flow should be wrapped: an operation that ends without `ok` or
 * `fail` is itself the finding.
 */
export function beginOp(name: string, data?: Record<string, unknown>): EhOp {
  const startedAt = Date.now();
  ehLog("info", `${name}.start`, data);
  let settled = false;
  return {
    step: (stepName, stepData) => ehLog("debug", `${name}.${stepName}`, stepData),
    ok: (okData) => {
      if (settled) return;
      settled = true;
      ehLog("info", `${name}.ok`, { ms: Date.now() - startedAt, ...(okData ?? {}) });
    },
    fail: (err, failData) => {
      if (settled) return;
      settled = true;
      ehLog("error", `${name}.fail`, {
        ms: Date.now() - startedAt,
        err: err instanceof Error ? err : { message: String(err) },
        ...(failData ?? {}),
      });
    },
  };
}
