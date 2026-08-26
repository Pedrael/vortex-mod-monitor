/**
 * The bug this file exists to prevent is a button that reports success and
 * opened nothing.
 *
 * `shell.openPath` resolves with an ERROR STRING instead of rejecting — empty
 * means it worked, non-empty means it did not. Awaiting it and carrying on
 * treats every failure as a success, which is the same shape as the bundled 7z
 * call that resolves on a failed run. So the ladder is tested at each rung,
 * including the rung that lies.
 */
import { describe, expect, it, vi } from "vitest";

import { revealInFileManager } from "./revealPath";

const FOLDER = "C:\\Users\\x\\AppData\\Roaming\\Vortex\\event-horizon\\collections";
const FILE = `${FOLDER}\\my-collection-1.2.0.ehcoll`;

describe("revealInFileManager", () => {
  it("highlights the package when it can", async () => {
    const showItemInFolder = vi.fn();
    const openPath = vi.fn();
    const opn = vi.fn();
    const out = await revealInFileManager(
      { filePath: FILE, folderPath: FOLDER },
      { shell: { showItemInFolder, openPath }, opn },
    );
    expect(out).toEqual({ kind: "revealed", via: "showItemInFolder" });
    expect(showItemInFolder).toHaveBeenCalledWith(FILE);
    // The better rung worked, so nothing below it should have run.
    expect(openPath).not.toHaveBeenCalled();
    expect(opn).not.toHaveBeenCalled();
  });

  it("opens the folder when there is no specific file to point at", async () => {
    const showItemInFolder = vi.fn();
    const openPath = vi.fn(async () => "");
    const out = await revealInFileManager(
      { folderPath: FOLDER },
      { shell: { showItemInFolder, openPath }, opn: vi.fn() },
    );
    expect(out).toEqual({ kind: "revealed", via: "openPath" });
    expect(showItemInFolder).not.toHaveBeenCalled();
    expect(openPath).toHaveBeenCalledWith(FOLDER);
  });

  it("treats a resolved error string from openPath as a FAILURE", async () => {
    // The whole point. openPath resolves either way; only the string says
    // which happened, and a caller that ignores it reports success forever.
    const opn = vi.fn(async () => undefined);
    const out = await revealInFileManager(
      { folderPath: FOLDER },
      {
        shell: { openPath: async () => "Failed to open path" },
        opn,
      },
    );
    // It fell through to the next rung rather than claiming success.
    expect(out).toEqual({ kind: "revealed", via: "opn" });
    expect(opn).toHaveBeenCalledWith(FOLDER);
  });

  it("falls back to opn when Electron is not there at all", async () => {
    const opn = vi.fn(async () => undefined);
    const out = await revealInFileManager(
      { filePath: FILE, folderPath: FOLDER },
      { shell: undefined, opn },
    );
    expect(out).toEqual({ kind: "revealed", via: "opn" });
    expect(opn).toHaveBeenCalledWith(FOLDER);
  });

  it("moves down the ladder when a rung throws", async () => {
    const opn = vi.fn(async () => undefined);
    const out = await revealInFileManager(
      { filePath: FILE, folderPath: FOLDER },
      {
        shell: {
          showItemInFolder: () => {
            throw new Error("no window");
          },
          openPath: async () => {
            throw new Error("nope");
          },
        },
        opn,
      },
    );
    expect(out).toEqual({ kind: "revealed", via: "opn" });
  });

  it("reports why when every rung failed, instead of failing silently", async () => {
    const out = await revealInFileManager(
      { filePath: FILE, folderPath: FOLDER },
      {
        shell: { openPath: async () => "access denied" },
        opn: async () => {
          throw new Error("opn unavailable");
        },
      },
    );
    expect(out.kind).toBe("failed");
    if (out.kind !== "failed") throw new Error("unreachable");
    // Both reasons survive — a button that does nothing needs to say which
    // part of the chain gave up.
    expect(out.why).toMatch(/access denied/);
    expect(out.why).toMatch(/opn unavailable/);
  });

  it("never throws, whatever the host does", async () => {
    await expect(
      revealInFileManager(
        { folderPath: FOLDER },
        {
          shell: {
            openPath: () => {
              throw new Error("sync throw from a promise-typed API");
            },
          },
          opn: async () => {
            throw new Error("also broken");
          },
        },
      ),
    ).resolves.toMatchObject({ kind: "failed" });
  });
});
