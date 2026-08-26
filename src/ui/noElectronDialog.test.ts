/**
 * Electron's dialog module is not reachable from a Vortex extension.
 *
 * `electron.remote` was removed in Electron 14, and `dialog` is a MAIN-process
 * module — a renderer never has it. Code reaching for either does not degrade;
 * it throws "Electron dialog is not available" at the moment the user asks for
 * a file, which is the moment they can least afford it.
 *
 * That is exactly how the first alpha attempt failed: a friend running Vortex
 * under Proton could not select the .ehcoll at all, and the "Save report..."
 * button on the resulting error dialog was broken by the same cause — so the
 * one control for getting the failure to someone who could read it was itself
 * a casualty.
 *
 * Vortex exposes `api.selectFile` / `api.saveFile` / `api.selectDir` for this,
 * and they work everywhere Vortex does. `pickJsonFile` had been using
 * `selectFile` correctly the whole time, four lines from a picker that was not.
 *
 * So this walks the real source and fails on any reintroduction.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

/** Ways of reaching Electron's dialog, none of which work in a renderer. */
const FORBIDDEN = [
  /electron\.remote/,
  /\.showOpenDialog\b/,
  /\.showSaveDialog\b/,
];

describe("no Electron dialog usage", () => {
  const files = sourceFiles(SRC);

  it("uses Vortex's pickers, never Electron's dialog", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      // Split on CRLF as well as LF. Splitting on "\n" alone leaves a
      // trailing "\r", and `$` without the `m` flag will not match before a
      // carriage return — so every comment-strip below silently did nothing
      // and the file's own explanatory comments read as violations.
      text.split(/\r?\n/).forEach((line, i) => {
        // A comment explaining why we do NOT use it is not a usage.
        const code = line.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
        if (FORBIDDEN.some((re) => re.test(code))) {
          offenders.push(
            `${file.slice(SRC.length + 1).split("\\").join("/")}:${i + 1}`,
          );
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("actually scans the source", () => {
    // An empty offender list means nothing if the walker found no files.
    expect(files.length).toBeGreaterThan(20);
  });

  it("can recognise a forbidden call", () => {
    // The check must be able to fail, or it proves nothing.
    expect(FORBIDDEN.some((re) => re.test("await dialog.showOpenDialog({})"))).toBe(
      true,
    );
    expect(FORBIDDEN.some((re) => re.test("await api.selectFile({})"))).toBe(false);
  });
});
