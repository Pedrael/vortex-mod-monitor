/**
 * Centralised error classification + formatting for the UI.
 *
 * Every error that bubbles up to a UI surface (ErrorBoundary,
 * ErrorReportModal, Toast, inline banner) goes through `formatError`
 * first. The output is a structured `FormattedError` that the UI
 * renders consistently — same layout, same copy-to-clipboard payload,
 * same save-to-file payload, regardless of where the error came from.
 *
 * Why a structured shape?
 *
 *   - **Testers**: a one-screen layout (title / message / details /
 *     hints / technical) is far easier to screenshot than a raw stack
 *     trace, and the copyable bundle gives us a reproducible report
 *     without asking the tester to re-type anything.
 *   - **Us**: when we triage, the first thing we want is the error
 *     class and the original message. The structured shape preserves
 *     both even after the user has seen a friendly title.
 *   - **Future-us**: when a new custom error type lands, we register
 *     a single classifier here; the rest of the UI doesn't change.
 *
 * Classifiers are tried in order. The fall-through is the generic
 * `classifyUnknown` which still produces a usable bundle.
 */

import {
  BuildManifestError,
} from "../../core/manifest/buildManifest";
import {
  CollectionConfigError,
} from "../../core/manifest/collectionConfig";
import {
  PackageEhcollError,
} from "../../core/manifest/packageZip";
import {
  ParseManifestError,
} from "../../core/manifest/parseManifest";
import {
  ReadEhcollError,
} from "../../core/manifest/readEhcoll";
import {
  InstallLedgerError,
} from "../../core/installLedger";

export interface FormattedError {
  /**
   * Short, human-readable label. Fits in a modal title or toast.
   */
  title: string;
  /**
   * One-line summary of what went wrong. Reads as a complete English
   * sentence — no trailing colons or "Error:" prefixes.
   */
  message: string;
  /**
   * Bullet items expanding the message. Empty array if there's
   * nothing more to say.
   */
  details: string[];
  /**
   * "What to try next" hints, written as imperative sentences. Empty
   * array if we don't have specific advice for this error class.
   */
  hints: string[];
  /**
   * Severity used by toast / banner styling. Most things are errors;
   * `warning` is reserved for cases we explicitly classify as
   * recoverable.
   */
  severity: "error" | "warning";
  /**
   * The error class name (e.g. `"ReadEhcollError"`, `"Error"`,
   * `"TypeError"`). Useful for grouping on the tester's side.
   */
  className: string;
  /**
   * The raw `error.message` string, before any reformatting.
   */
  rawMessage: string;
  /**
   * Stack trace if available, with the first frame trimmed of any
   * absolute Vortex install path noise.
   */
  stack?: string;
  /**
   * Optional context object (key/value strings) the caller passed in.
   * Rendered in the technical details panel and included in the
   * copyable bundle.
   */
  context?: Record<string, string>;
  /**
   * Optional structured payload from a custom error class (e.g.
   * the `errors` array on `ReadEhcollError`).
   */
  structured?: unknown;
}

export interface FormatErrorOptions {
  /**
   * Optional bag of additional context to attach to the report —
   * "current step", "selected file", "package id", etc.
   */
  context?: Record<string, string | number | boolean | undefined | null>;
  /**
   * Optional title override. When set, callers can replace the
   * classifier's chosen title with something more specific to the
   * call site.
   */
  title?: string;
}

export function formatError(
  err: unknown,
  options: FormatErrorOptions = {},
): FormattedError {
  const base = classify(err);

  if (options.title !== undefined && options.title.length > 0) {
    base.title = options.title;
  }

  if (options.context !== undefined) {
    base.context = pickStringContext(options.context);
  }

  return base;
}

/**
 * Build a human-readable, plain-text bundle of a formatted error.
 * This is what the "Copy report" button writes to the clipboard and
 * what "Save report" writes to a `.txt` file. Layout is intentionally
 * stable so that pasted reports are easy to skim across multiple bugs.
 */
export function buildErrorReport(err: FormattedError): string {
  const lines: string[] = [];
  const sep =
    "=================================================================";
  lines.push(sep);
  lines.push("Event Horizon — error report");
  lines.push(sep);
  lines.push(`Time:        ${new Date().toISOString()}`);
  lines.push(`Title:       ${err.title}`);
  lines.push(`Severity:    ${err.severity}`);
  lines.push(`Class:       ${err.className}`);
  lines.push("");
  lines.push("Message:");
  lines.push(`  ${err.message}`);
  if (err.rawMessage && err.rawMessage !== err.message) {
    lines.push("");
    lines.push("Raw message:");
    lines.push(`  ${err.rawMessage}`);
  }
  if (err.details.length > 0) {
    lines.push("");
    lines.push("Details:");
    for (const d of err.details) lines.push(`  - ${d}`);
  }
  if (err.hints.length > 0) {
    lines.push("");
    lines.push("Hints:");
    for (const h of err.hints) lines.push(`  - ${h}`);
  }
  if (err.context !== undefined && Object.keys(err.context).length > 0) {
    lines.push("");
    lines.push("Context:");
    for (const [k, v] of Object.entries(err.context)) {
      lines.push(`  ${k}: ${v}`);
    }
  }
  if (err.structured !== undefined) {
    lines.push("");
    lines.push("Structured payload:");
    try {
      const json = JSON.stringify(err.structured, null, 2);
      for (const line of json.split("\n")) {
        lines.push(`  ${line}`);
      }
    } catch {
      lines.push("  (not JSON-serialisable)");
    }
  }
  if (err.stack !== undefined) {
    lines.push("");
    lines.push("Stack trace:");
    for (const line of err.stack.split("\n")) {
      lines.push(`  ${line}`);
    }
  }
  lines.push(sep);
  return lines.join("\n");
}

// ===========================================================================
// Classifiers
// ===========================================================================

function classify(err: unknown): FormattedError {
  if (err instanceof ReadEhcollError) {
    return classifyMultiError(err, {
      title: "Could not read .ehcoll package",
      message: "Vortex couldn't open or parse the collection file.",
      hints: [
        "Make sure the file ends in .ehcoll and isn't a renamed .zip from elsewhere.",
        "Try downloading the package again — partial downloads can cause this.",
        "If you built the package yourself, rebuild it and check that it produced manifest.json.",
      ],
    });
  }
  if (err instanceof ParseManifestError) {
    return classifyMultiError(err, {
      title: "Manifest is malformed",
      message: "The package opened, but its manifest didn't validate.",
      hints: [
        "This package was likely built with an older or incompatible version of Event Horizon.",
        "Ask the curator to rebuild with the latest version.",
      ],
    });
  }
  if (err instanceof InstallLedgerError) {
    return classifyMultiError(err, {
      title: "Could not read install receipt",
      message: "The receipt file for this collection failed to load.",
      hints: [
        "Receipts live in %APPDATA%/Vortex/event-horizon/installs/<package-id>.json.",
        "If the file is corrupt, delete it and Event Horizon will treat the install as fresh.",
      ],
    });
  }
  if (err instanceof BuildManifestError) {
    return classifyMultiError(err, {
      title: "Manifest build failed",
      message: "Couldn't assemble a manifest from your current Vortex state.",
      hints: [
        "The mod list snapshot or load order may be in an unexpected shape.",
        "Make sure a profile is active and try again after Vortex finishes loading.",
      ],
    });
  }
  if (err instanceof PackageEhcollError) {
    return classifyMultiError(err, {
      title: "Could not write .ehcoll archive",
      message: "Packaging the manifest into a .ehcoll archive failed.",
      hints: [
        "Check disk space and antivirus exclusions for the output folder.",
        "If you're packing bundled archives, make sure each source file is accessible.",
      ],
    });
  }
  if (err instanceof CollectionConfigError) {
    return classifyMultiError(err, {
      title: "Collection config is invalid",
      message:
        "The per-collection config file (.config/<slug>.json) didn't validate.",
      hints: [
        "Restore from a backup, or delete the file to start fresh — the build action will recreate it.",
      ],
    });
  }
  if (err instanceof Error) {
    return classifyGenericError(err);
  }
  return classifyUnknown(err);
}

interface CommonClassifierMeta {
  title: string;
  message: string;
  hints: string[];
}

/**
 * Common classifier for our `multi-error` family — every custom class
 * exposes an `errors: string[]` field. Each entry becomes a detail
 * bullet. The custom class' own message is preserved as `rawMessage`.
 */
function classifyMultiError(
  err: Error & { errors: string[] },
  meta: CommonClassifierMeta,
): FormattedError {
  return {
    title: meta.title,
    message: meta.message,
    details: err.errors.length > 0 ? [...err.errors] : [err.message],
    hints: meta.hints,
    severity: "error",
    className: err.constructor.name,
    rawMessage: err.message,
    stack: cleanStack(err.stack),
    structured: { errors: [...err.errors] },
  };
}

function classifyGenericError(err: Error): FormattedError {
  // Some heuristics for nicer titles based on common patterns we see
  // bubbling up from the core layer.
  const title = guessGenericTitle(err);
  return {
    title,
    message: err.message || "An unexpected error occurred.",
    details: [],
    hints: guessGenericHints(err),
    severity: "error",
    className: err.constructor.name || "Error",
    rawMessage: err.message,
    stack: cleanStack(err.stack),
  };
}

function classifyUnknown(err: unknown): FormattedError {
  let raw: string;
  try {
    raw = typeof err === "string" ? err : JSON.stringify(err);
  } catch {
    raw = String(err);
  }
  return {
    title: "Something went wrong",
    message: raw || "An unknown error was thrown.",
    details: [],
    hints: [
      "This kind of error usually points to a non-Error value being thrown — please copy the report and tell us.",
    ],
    severity: "error",
    className: typeof err,
    rawMessage: raw,
  };
}

function guessGenericTitle(err: Error): string {
  const msg = err.message.toLowerCase();
  if (msg.includes("no active game") || msg.includes("active game")) {
    return "No active game in Vortex";
  }
  if (msg.includes("no profile") || msg.includes("no active profile")) {
    return "No profile selected";
  }
  if (msg.includes("not supported") || msg.includes("unsupported")) {
    return "Unsupported game or feature";
  }
  if (msg.includes("permission") || msg.includes("eperm") || msg.includes("eacces")) {
    return "Permission denied";
  }
  if (msg.includes("enoent")) {
    return "File or folder not found";
  }
  if (msg.includes("ebusy") || msg.includes("locked")) {
    return "File is locked";
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("econn")) {
    return "Network problem";
  }
  if (msg.includes("nexus")) {
    return "Nexus Mods request failed";
  }
  if (msg.includes("cancelled") || msg.includes("canceled") || msg.includes("aborted")) {
    return "Operation cancelled";
  }
  return "Unexpected error";
}

function guessGenericHints(err: Error): string[] {
  const msg = err.message.toLowerCase();
  const hints: string[] = [];
  if (msg.includes("no active game")) {
    hints.push(
      "Switch to a supported game in Vortex (Skyrim SE, Fallout 3, Fallout NV, Fallout 4, Starfield) and retry.",
    );
  }
  if (msg.includes("eperm") || msg.includes("eacces") || msg.includes("permission")) {
    hints.push(
      "Run Vortex once as Administrator OR exclude %APPDATA%/Vortex from your antivirus.",
    );
  }
  if (msg.includes("enoent")) {
    hints.push(
      "The file or folder Vortex expected isn't there — check that the path still exists.",
    );
  }
  if (msg.includes("ebusy") || msg.includes("locked")) {
    hints.push(
      "Another program is holding the file open. Close OneDrive/Dropbox sync clients and antivirus quarantine, then retry.",
    );
  }
  if (msg.includes("nexus")) {
    hints.push(
      "Make sure you're signed in to Nexus inside Vortex and that your API key is current.",
    );
  }
  return hints;
}

function cleanStack(stack: string | undefined): string | undefined {
  if (stack === undefined) return undefined;
  // Trim noisy absolute paths — keep the file name + line/col only.
  return stack.replace(
    /\(?([A-Za-z]:[\\/][^()\n]+|\/[^()\n]+)\)?/g,
    (full) => {
      const cleaned = full.replace(/\\/g, "/");
      const idx = cleaned.indexOf("/dist/");
      if (idx >= 0) return cleaned.slice(idx + 1);
      const idx2 = cleaned.indexOf("/src/");
      if (idx2 >= 0) return cleaned.slice(idx2 + 1);
      return cleaned;
    },
  );
}

function pickStringContext(
  ctx: Record<string, string | number | boolean | undefined | null>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}
