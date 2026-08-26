/**
 * The bug being fixed here was silent and total: a mod the user supplied by
 * hand installed with DEFAULT installer options while the collection promised
 * the curator's. Files all present, all correct, and the wrong ones — which is
 * the same shape as the modType bug and the FOMOD-capture bug before it.
 *
 * The fix routes those installs through `start-install-download`, the only
 * choices-carrying call we have OBSERVED (see adoptLocalArchive's header), and
 * that means copying the archive into Vortex's download folder. So the tests
 * that matter most are about not doing that when it is not needed, and not
 * clobbering a file that happens to share a name.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { adoptLocalArchive, isInside } from "./adoptLocalArchive";
// eslint-disable-next-line import/no-relative-packages
import { __testPaths } from "../../../test/stubs/vortex-api";

let root: string;
let downloads: string;
let elsewhere: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "eh-adopt-"));
  downloads = path.join(root, "downloads");
  elsewhere = path.join(root, "user-downloads");
  fs.mkdirSync(downloads, { recursive: true });
  fs.mkdirSync(elsewhere, { recursive: true });
  __testPaths.downloadPath = downloads;
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const write = (dir: string, name: string, bytes: number): string => {
  const p = path.join(dir, name);
  fs.writeFileSync(p, Buffer.alloc(bytes, 1));
  return p;
};

const fakeApi = () => {
  const dispatched: unknown[] = [];
  return {
    api: {
      getState: () => ({}),
      store: { dispatch: (a: unknown) => dispatched.push(a) },
    } as never,
    dispatched,
  };
};

describe("adoptLocalArchive", () => {
  it("copies a file from outside the download folder and registers it", async () => {
    const src = write(elsewhere, "CoolMod.7z", 1234);
    const { api, dispatched } = fakeApi();

    const out = await adoptLocalArchive(api, {
      gameId: "fallout4",
      archivePath: src,
    });

    expect(out.copied).toBe(true);
    expect(path.dirname(out.localPath)).toBe(downloads);
    expect(fs.existsSync(out.localPath)).toBe(true);
    // The original is left alone — it is the user's file.
    expect(fs.existsSync(src)).toBe(true);
    expect(dispatched).toHaveLength(1);
  });

  it("does NOT copy a file already inside the download folder", async () => {
    // Copying would leave two identical multi-gigabyte archives side by side.
    const src = write(downloads, "Already.7z", 999);
    const { api } = fakeApi();

    const out = await adoptLocalArchive(api, {
      gameId: "fallout4",
      archivePath: src,
    });

    expect(out.copied).toBe(false);
    expect(out.localPath).toBe(src);
    expect(fs.readdirSync(downloads)).toEqual(["Already.7z"]);
  });

  it("gives the same archive the same id twice", async () => {
    // A retry must not accumulate a second download entry pointing at one
    // file. Random ids would.
    const src = write(downloads, "Stable.7z", 42);
    const { api } = fakeApi();
    const a = await adoptLocalArchive(api, { gameId: "fallout4", archivePath: src });
    const b = await adoptLocalArchive(api, { gameId: "fallout4", archivePath: src });
    expect(a.archiveId).toBe(b.archiveId);
  });

  it("does not overwrite an unrelated file with the same name", async () => {
    // Both the user's Downloads and Vortex's are full of "Patch.7z".
    const existing = write(downloads, "Patch.7z", 100);
    const mine = write(elsewhere, "Patch.7z", 5000);
    const { api } = fakeApi();

    const out = await adoptLocalArchive(api, {
      gameId: "fallout4",
      archivePath: mine,
    });

    expect(out.localPath).not.toBe(existing);
    expect(fs.statSync(existing).size).toBe(100);
    expect(fs.statSync(out.localPath).size).toBe(5000);
  });

  it("reuses an identical file already copied in", async () => {
    // Same name AND same size: this is our own earlier copy, not a stranger.
    write(downloads, "Same.7z", 777);
    const mine = write(elsewhere, "Same.7z", 777);
    const { api } = fakeApi();

    const out = await adoptLocalArchive(api, {
      gameId: "fallout4",
      archivePath: mine,
    });

    expect(path.basename(out.localPath)).toBe("Same.7z");
    expect(fs.readdirSync(downloads)).toEqual(["Same.7z"]);
  });

  it("registers a path RELATIVE to the download folder", async () => {
    // Vortex resolves localPath against the download folder; an absolute path
    // produces an entry it can never find again.
    const src = write(elsewhere, "Rel.7z", 10);
    const { api, dispatched } = fakeApi();
    await adoptLocalArchive(api, { gameId: "fallout4", archivePath: src });

    const payload = JSON.stringify(dispatched[0]);
    expect(payload).toContain("Rel.7z");
    expect(payload).not.toContain(downloads.replace(/\\/g, "\\\\"));
  });

  it("fails loudly when the download folder cannot be resolved", async () => {
    __testPaths.downloadPath = "";
    const src = write(elsewhere, "NoFolder.7z", 10);
    const { api } = fakeApi();
    await expect(
      adoptLocalArchive(api, { gameId: "fallout4", archivePath: src }),
    ).rejects.toThrow(/download folder/i);
  });
});

describe("isInside", () => {
  it("recognises containment regardless of case", () => {
    // Windows. The same folder arrives spelled both ways.
    expect(isInside("C:\\Vortex\\downloads", "C:\\vortex\\DOWNLOADS\\a.7z")).toBe(
      true,
    );
  });

  it("is not fooled by a sibling with a shared prefix", () => {
    // "downloads-old" starts with "downloads" as a string but is not inside it.
    expect(
      isInside("C:\\Vortex\\downloads", "C:\\Vortex\\downloads-old\\a.7z"),
    ).toBe(false);
  });

  it("does not call a folder its own child", () => {
    expect(isInside("C:\\Vortex\\downloads", "C:\\Vortex\\downloads")).toBe(false);
  });
});
