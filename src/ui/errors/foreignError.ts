/**
 * ──────────────────────────────────────────────────────────────────────
 * Whose error is this, actually?
 *
 * `ErrorProvider` listens on `window.error` and `window.unhandledrejection`,
 * which are not ours — they are the whole Vortex renderer's. Anything that
 * goes wrong anywhere in the application, in any extension, arrives at our
 * handler and is presented in an Event Horizon dialog with an Event Horizon
 * title.
 *
 * A tester saw exactly that: an unhandled `UserCanceled` raised deep inside
 * Vortex's own promise machinery, reported to him as
 * "Operation cancelled — canceled by user" while his install of 967 mods had
 * in fact completed every step. He had cancelled nothing, and the dialog gave
 * him no way to know the failure was not ours or his.
 *
 * Catching those is still right — a silent unhandled rejection is worse, and
 * some of them ARE ours. What is wrong is claiming them. So the report says
 * where it came from.
 *
 * ─── HOW IT DECIDES, AND WHY IT ERRS TOWARDS "OURS" ────────────────────
 * A stack frame from this extension names the plugin folder it was loaded
 * from — `event-horizon` — because Vortex loads extensions out of
 * `plugins/<name>/`. Vortex's own frames sit in `app.asar`, and its bundled
 * libraries in `node_modules`.
 *
 * An error is called FOREIGN only when it has a real stack, that stack names
 * Vortex's own code, and no frame anywhere in it belongs to us. Anything
 * ambiguous — no stack, an unfamiliar shape, a mixed stack — stays ours.
 * Wrongly disowning our own bug is far more expensive than wrongly keeping
 * someone else's: the first sends a real defect back to a user as "not our
 * problem", and there is no second chance to notice it.
 * ──────────────────────────────────────────────────────────────────────
 */

/** Frames from this extension carry the plugin folder name. */
const OURS = /event[-_]horizon/i;

/** Vortex's own code and the libraries it bundles. */
const VORTEX = /app\.asar|[\\/]node_modules[\\/](zone\.js|bluebird)/i;

export function stackOf(err: unknown): string {
  if (err instanceof Error && typeof err.stack === "string") return err.stack;
  if (
    typeof err === "object" &&
    err !== null &&
    typeof (err as { stack?: unknown }).stack === "string"
  ) {
    return (err as { stack: string }).stack;
  }
  return "";
}

/**
 * Did this come from Vortex rather than from Event Horizon?
 *
 * Both conditions are required: the stack must name Vortex's own code AND
 * contain no frame of ours. See the header for why the doubt resolves towards
 * "ours".
 */
export function isForeignError(err: unknown): boolean {
  const stack = stackOf(err);
  if (stack.length === 0) return false;
  if (OURS.test(stack)) return false;
  return VORTEX.test(stack);
}

/**
 * The sentence added to a foreign error's report.
 *
 * Says three things, in the order the reader needs them: it is not ours, the
 * work may be unaffected, and what to actually check. The last matters most —
 * "not our problem" without a next step is just a shrug.
 */
export function describeForeignError(): string {
  return (
    "This error came from Vortex itself, not from Event Horizon — no part of " +
    "it happened in our code. An Event Horizon operation that was running may " +
    "have finished normally regardless; check My Collections, which lists a " +
    "collection as installed only once its receipt is written."
  );
}
