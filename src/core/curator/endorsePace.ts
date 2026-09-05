/**
 * ──────────────────────────────────────────────────────────────────────
 * How long bulk endorsing takes, and the one constant that decides it.
 *
 * Vortex's `endorse-mod` is fire-and-forget: it returns no promise, so there
 * is nothing to await and no way to know a request finished. The only control
 * left is spacing, and 1,522 endorsements spaced 250 ms apart is a little
 * over six minutes of a button that cannot be stopped.
 *
 * So the curator is told before they press it. The estimate is computed FROM
 * the pacing constant rather than written beside it — an estimate derived
 * from a literal someone later edits is a lie with a delay fuse, and this is
 * exactly the kind of number that gets tuned once and mis-documented forever.
 *
 * ─── IT IS A FLOOR, AND IT SAYS SO ─────────────────────────────────────
 * `setTimeout(250)` means "not before 250 ms", never "at 250 ms" — a busy
 * renderer makes every gap longer, never shorter. So the wording is "about",
 * and the estimate is never presented as a deadline.
 * ──────────────────────────────────────────────────────────────────────
 */

/**
 * Milliseconds between two endorse requests.
 *
 * The whole reason bulk endorsing is slow. Firing 1,500 requests at Nexus in
 * one tick is not a faster result — it is a rate-limit, and a ban is slower
 * than six minutes.
 */
export const ENDORSE_PACE_MS = 250;

/** Lower bound on how long endorsing `count` mods will take, in ms. */
export function endorseDurationMs(count: number): number {
  // The last request needs no gap after it, which matters only for tiny
  // counts but is free to get right.
  return Math.max(0, count - 1) * ENDORSE_PACE_MS;
}

/**
 * The estimate as the curator reads it.
 *
 * Deliberately coarse. A number like "6 m 21 s" claims a precision that a
 * `setTimeout` floor does not have, and invites someone to notice it took
 * seven and call that a bug.
 */
export function describeEndorseDuration(count: number): string {
  const seconds = endorseDurationMs(count) / 1000;
  if (seconds < 30) return "a few seconds";
  if (seconds < 90) return "about a minute";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `about ${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? `about ${hours} hour${hours === 1 ? "" : "s"}`
    : `about ${hours} hour${hours === 1 ? "" : "s"} ${rest} minutes`;
}

/**
 * True when the run is long enough to warn about up front.
 *
 * Below this it finishes before a curator would think to stop it, and a
 * warning on every click is a warning nobody reads.
 */
export function endorseIsLong(count: number): boolean {
  return endorseDurationMs(count) >= 60_000;
}
