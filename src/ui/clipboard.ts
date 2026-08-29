/**
 * Best-effort clipboard write.
 *
 * Lived as a private function inside BuildPage until the install page needed
 * it too — for the curator report, whose entire purpose is being pasted
 * somewhere else. Copying it would have been the second implementation of a
 * fallback chain that exists because neither path is reliable on its own.
 *
 * Tries the navigator API first (works inside Electron's renderer when the
 * page is HTTPS-equivalent), then falls back to electron.clipboard.
 *
 * Returns FALSE rather than throwing when both fail. A copy button that
 * silently does nothing is bad; one that throws into an error boundary and
 * takes the page down, on a screen the user reached at the END of a long
 * install, is worse.
 */
export async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard !== undefined &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to electron clipboard */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require("electron") as {
      clipboard?: { writeText?: (s: string) => void };
    };
    if (electron.clipboard?.writeText) {
      electron.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* swallow */
  }
  return false;
}
