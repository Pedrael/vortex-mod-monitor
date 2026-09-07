/**
 * ──────────────────────────────────────────────────────────────────────
 * The bundled entry is found by its SHA, not by a guessed extension.
 *
 * A tester's install died on `Could not extract
 * "bundled/6653e7…20f37.1" … contains no entry named …`. The package held
 * `bundled/6653e7…20f37.zip`.
 *
 * Two sides derived the same name from different strings. The packager names
 * the entry after the archive it actually wrote — always the repacked `.zip`
 * (`packageZip.ts`). The resolver rebuilt the name from the mod's
 * `expectedFilename` (`resolveInstallPlan.bundledZipPath`). Those agree only
 * by luck, and they stop agreeing the moment Vortex has had to disambiguate a
 * mod name, because it appends `.1`, `.2`… The mod here is
 * "IDE WHITERUN-149724-1-1746902603.1", so the resolver asked for `.1`.
 *
 * On a large profile there is almost always such a mod, and the install dies
 * on the first one — after the download.
 *
 * The sha is the identity; that is why the file is named after it. So the
 * lookup falls back to it, and only the EXTENSION is forgiven — a wrong sha
 * still fails, or the recovery could hand over a different archive entirely.
 * ──────────────────────────────────────────────────────────────────────
 */
import { describe, expect, it, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { extractBundledFromEhcoll } from "./modInstall";
import { makeZip } from "../../../test/makeZip";

const SHA = "6653e7a9fecfa3bd75993a878a56204fe2bb02cdd48afe5cd1c660da3ab20f37";

let dir: string | undefined;
afterEach(() => {
  if (dir !== undefined) fs.rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

/** A package holding one bundled archive under the given entry name. */
function packageWith(entryName: string): string {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "eh-bundled-"));
  const zip = path.join(dir, "pkg.ehcoll");
  fs.writeFileSync(
    zip,
    makeZip([{ name: entryName, data: Buffer.from("ARCHIVE BYTES", "utf8") }]),
  );
  return zip;
}

describe("recovering a bundled entry whose extension was guessed wrong", () => {
  it("finds it by sha when the asked-for extension is wrong", async () => {
    // The tester's exact failure: asked for `.1`, package holds `.zip`.
    const zip = packageWith(`bundled/${SHA}.zip`);
    const got = await extractBundledFromEhcoll(zip, `bundled/${SHA}.1`);
    expect(fs.readFileSync(got.extractedPath, "utf8")).toBe("ARCHIVE BYTES");
    fs.rmSync(got.tempDir, { recursive: true, force: true });
  });

  it("finds it when the package has no extension at all", async () => {
    // The packager writes a bare sha when the source archive had no
    // extension, so this is a real shape rather than a hypothetical.
    const zip = packageWith(`bundled/${SHA}`);
    const got = await extractBundledFromEhcoll(zip, `bundled/${SHA}.zip`);
    expect(fs.readFileSync(got.extractedPath, "utf8")).toBe("ARCHIVE BYTES");
    fs.rmSync(got.tempDir, { recursive: true, force: true });
  });

  it("still uses the exact entry when it IS there", async () => {
    // The recovery must not change the ordinary path.
    const zip = packageWith(`bundled/${SHA}.7z`);
    const got = await extractBundledFromEhcoll(zip, `bundled/${SHA}.7z`);
    expect(fs.readFileSync(got.extractedPath, "utf8")).toBe("ARCHIVE BYTES");
    fs.rmSync(got.tempDir, { recursive: true, force: true });
  });

  it("REFUSES a different sha — only the extension is forgiven", async () => {
    /**
     * The line that keeps this a recovery rather than a guess. Handing over
     * an archive whose contents are not what the manifest promised would be
     * far worse than the error it replaces: the mod would install, verify
     * against the wrong bytes, and be wrong in a way nothing downstream
     * could catch.
     */
    const other = "a".repeat(64);
    const zip = packageWith(`bundled/${other}.zip`);
    await expect(
      extractBundledFromEhcoll(zip, `bundled/${SHA}.1`),
    ).rejects.toThrow(/Could not extract/);
  });

  it("does not mistake a longer sha that starts with the same characters", async () => {
    // `bundled/<sha>` must not match `bundled/<sha>abc.zip`. The separator
    // has to be there.
    const zip = packageWith(`bundled/${SHA}deadbeef.zip`);
    await expect(
      extractBundledFromEhcoll(zip, `bundled/${SHA}.1`),
    ).rejects.toThrow(/Could not extract/);
  });

  it("reports honestly when the archive genuinely is not in the package", async () => {
    const zip = packageWith("manifest.json");
    await expect(
      extractBundledFromEhcoll(zip, `bundled/${SHA}.zip`),
    ).rejects.toThrow(/Could not extract/);
  });
});
