/**
 * ──────────────────────────────────────────────────────────────────────
 * Show a built .ehcoll in the OS file manager.
 *
 * The package is the entire output of this extension and until now there was
 * no way to get to it from the UI — you had to know that builds land in
 * `<VortexUserData>/event-horizon/collections` and go there yourself. For the
 * one artefact the curator actually hands to someone else, that is a strange
 * thing to have to look up.
 *
 * ── Three ways to do it, none of them guaranteed ──
 * Vortex extensions run inside Electron, but `require("electron")` is not
 * something the published typings promise and `util.opn` is marked
 * `@deprecated` in `api.d.ts`. So this tries the best option first and walks
 * down, and reports which one worked rather than assuming:
 *
 *   1. `shell.showItemInFolder(file)` — opens the folder AND highlights the
 *      package, which is what someone about to attach it to a message wants.
 *   2. `shell.openPath(folder)` — opens the folder.
 *   3. `util.opn(folder)` — deprecated, still present, still works.
 *
 * ── The trap ──
 * `shell.openPath` RESOLVES WITH AN ERROR STRING rather than rejecting: an
 * empty string means success and a non-empty one means it failed. Awaiting it
 * and moving on treats every failure as a success — the same shape as the
 * bundled 7z call that resolves on a failed run. It is checked explicitly here
 * because nothing else would catch it.
 * ──────────────────────────────────────────────────────────────────────
 */

import { util } from "@nexusmods/vortex-api";

export type RevealOutcome =
  | { kind: "revealed"; via: "showItemInFolder" | "openPath" | "opn" }
  | { kind: "failed"; why: string };

/** The subset of Electron's `shell` this needs, all of it optional. */
export type ShellLike = {
  showItemInFolder?: (fullPath: string) => void;
  openPath?: (dir: string) => Promise<string>;
};

export type RevealDeps = {
  /** `undefined` models an Electron that did not load. */
  shell?: ShellLike | undefined;
  opn?: (target: string) => Promise<void>;
};

/**
 * Reveal `filePath` if it is known, otherwise just open `folderPath`.
 *
 * Never throws: this is a convenience button, and a file manager that will not
 * open is worth a message, not a crash in the middle of the build page.
 */
export async function revealInFileManager(
  target: { filePath?: string | undefined; folderPath: string },
  deps: RevealDeps = {},
): Promise<RevealOutcome> {
  const shell = deps.shell !== undefined ? deps.shell : loadShell();
  const opn = deps.opn ?? defaultOpn;
  const problems: string[] = [];

  if (target.filePath !== undefined && typeof shell?.showItemInFolder === "function") {
    try {
      shell.showItemInFolder(target.filePath);
      return { kind: "revealed", via: "showItemInFolder" };
    } catch (err) {
      problems.push(`showItemInFolder: ${describe(err)}`);
    }
  }

  if (typeof shell?.openPath === "function") {
    try {
      // Resolves with "" on success and with the error message on failure.
      // Not checking this is how "could not open" becomes "opened fine".
      const failure = await shell.openPath(target.folderPath);
      if (failure === "") return { kind: "revealed", via: "openPath" };
      problems.push(`openPath: ${failure}`);
    } catch (err) {
      problems.push(`openPath: ${describe(err)}`);
    }
  }

  try {
    await opn(target.folderPath);
    return { kind: "revealed", via: "opn" };
  } catch (err) {
    problems.push(`opn: ${describe(err)}`);
  }

  return {
    kind: "failed",
    why:
      problems.length === 0
        ? "No way to open a folder is available in this Vortex."
        : problems.join("; "),
  };
}

const describe = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

/**
 * Electron's `shell`, if this process has one.
 *
 * `require` rather than `import` because the module is supplied by the host
 * app and may not resolve at all — an import would fail at load time and take
 * the whole build page with it, for a button.
 */
function loadShell(): ShellLike | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require("electron") as { shell?: ShellLike };
    return electron?.shell;
  } catch {
    return undefined;
  }
}

const defaultOpn = async (target: string): Promise<void> => {
  await (util as unknown as { opn: (t: string) => Promise<void> }).opn(target);
};

/**
 * Open a web link in the user's browser.
 *
 * Separate from {@link revealInFileManager} because a URL is not a path:
 * Electron exposes `shell.openExternal` for this, and `openPath` will not do
 * it. Same shape otherwise — try the good route, fall back, report.
 *
 * ── Only http(s) ──
 * The URL comes out of a manifest someone else authored, so it is untrusted
 * input, and `shell.openExternal` will happily hand a `file://` — and on
 * Windows historically worse schemes — to the OS to act on. Refusing anything
 * that is not http(s) here means a hostile collection cannot use this button
 * to launch something local. The manifest parser already filters on the way
 * in; this is the same check at the point of use, because that is where the
 * consequence is.
 */
export async function openExternalUrl(
  url: string,
  deps: { shell?: { openExternal?: (u: string) => Promise<void> } | undefined; opn?: (t: string) => Promise<void> } = {},
): Promise<RevealOutcome> {
  const trimmed = url.trim();
  if (!/^https?:\/\/\S+$/i.test(trimmed)) {
    return { kind: "failed", why: `Refusing to open a non-web link: ${trimmed}` };
  }

  const shell =
    deps.shell !== undefined
      ? deps.shell
      : (loadShell() as { openExternal?: (u: string) => Promise<void> } | undefined);
  const opn = deps.opn ?? defaultOpn;

  if (typeof shell?.openExternal === "function") {
    try {
      await shell.openExternal(trimmed);
      return { kind: "revealed", via: "openPath" };
    } catch (err) {
      /* fall through to opn */
      void err;
    }
  }
  try {
    await opn(trimmed);
    return { kind: "revealed", via: "opn" };
  } catch (err) {
    return { kind: "failed", why: describe(err) };
  }
}
