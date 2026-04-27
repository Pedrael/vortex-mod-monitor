/**
 * nativeNotify — fire a Web Notification when long-running pipelines
 * finish so the user gets pinged even if Vortex is minimised or
 * they've Alt-tabbed to a different window.
 *
 * Design choices:
 *   - We use the standard Web `Notification` API (Electron exposes it
 *     to the renderer). No extra deps, no permission UI for the user
 *     to navigate — Vortex bundles it as already-granted.
 *   - We never throw. Any failure (API missing, permission denied,
 *     focus-aware suppression) silently no-ops; the in-app toast is
 *     the source of truth for "did this thing happen".
 *   - We only fire when the Vortex window is not focused. Pinging the
 *     OS notification centre while the user is staring at the success
 *     card is just noise.
 */

export interface NativeNotifyOptions {
  title: string;
  body: string;
  /**
   * If `true`, fire even when the window is currently focused. Useful
   * for failure cases where the user might have tabbed away even
   * within Vortex itself. Default: `false`.
   */
  even_when_focused?: boolean;
  /**
   * Optional tag — repeated notifications with the same tag replace
   * the prior one rather than stacking. We use this to dedupe
   * "build complete" pings if a user clicks Build twice quickly.
   */
  tag?: string;
}

/**
 * Best-effort fire-and-forget. Returns true if a notification was
 * actually shown, false if anything blocked it (no API, denied,
 * focused-window suppression, ...).
 */
export function nativeNotify(opts: NativeNotifyOptions): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (typeof Notification === "undefined") return false;

    // Suppress while the user is already looking at the app —
    // they'll see the in-app toast.
    if (
      opts.even_when_focused !== true &&
      typeof document !== "undefined" &&
      document.hasFocus()
    ) {
      return false;
    }

    if (Notification.permission === "denied") return false;

    if (Notification.permission === "granted") {
      // eslint-disable-next-line no-new
      new Notification(opts.title, {
        body: opts.body,
        tag: opts.tag,
        silent: false,
      });
      return true;
    }

    if (Notification.permission === "default") {
      // Asynchronously request permission. If it gets granted later,
      // the next call will succeed; we don't retry the current one
      // because by then the event has long passed.
      void Notification.requestPermission().catch(() => undefined);
      return false;
    }
    return false;
  } catch {
    return false;
  }
}
