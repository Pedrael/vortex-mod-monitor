/**
 * Shared `AbortError` class for cooperative cancellation across the
 * codebase.
 *
 * Why a custom class instead of `DOMException("AbortError")` or the
 * native `AbortSignal.reason`:
 *
 *  - Vortex extensions run in Electron's renderer where DOMException
 *    exists, but on Node-only entry points (Jest tests, headless
 *    scripts) it isn't always available with the constructor we
 *    want. A plain `Error` subclass works everywhere.
 *  - We rely on `(err as Error).name === "AbortError"` checks at
 *    abort-handling sites; that contract is independent of the
 *    Web standard's `DOMException.name === "AbortError"` shape but
 *    looks identical to consumers, so existing checks keep working.
 *
 * Module-level history: this class used to be redefined privately
 * inside `archiveHashing.ts`, `applyModRules.ts`, `applyLoadOrder.ts`,
 * and `applyUserlist.ts`. Centralizing avoids drift (one of the four
 * had a different default message) and gives a single import path
 * for new abort-aware modules.
 */
export class AbortError extends Error {
  constructor(message = "Aborted") {
    super(message);
    this.name = "AbortError";
  }
}
