/**
 * A misspelled CSS custom property does not throw, does not warn, and does not
 * show up in a typecheck or in any other test. `var(--eh-nope)` resolves to
 * nothing, and the browser then discards the ENTIRE declaration it appears in
 * — so `border: 1px solid var(--eh-nope)` is not a wrong-coloured border, it is
 * no border at all.
 *
 * That is how BuildPage's "included" and "reverify" toggles came to render
 * identically in both states: `--eh-border` and `--eh-accent` were never
 * defined, so the selected outline that was supposed to distinguish them never
 * drew. Four call sites, two pages, invisible to every check we had.
 *
 * This walks the real source and asserts that every token the UI asks for is
 * one the theme actually ships.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..");
const TOKENS_FILE = join(__dirname, "tokens.ts");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** Tokens the theme declares, e.g. `--eh-cyan: #4cc9f0;`. */
function declaredTokens(): Set<string> {
  const text = readFileSync(TOKENS_FILE, "utf8");
  return new Set(
    [...text.matchAll(/^\s*(--eh-[a-z0-9-]+)\s*:/gm)].map((m) => m[1]),
  );
}

/**
 * A reference is only a bug when it has NO fallback. `var(--x, 64px)` is the
 * legitimate way to read a value set inline on an element (ProgressRing sets
 * `--eh-ring-size` that way), so those are excluded deliberately rather than
 * by accident.
 */
type Reference = { token: string; file: string; line: number };

function referencesWithoutFallback(): Reference[] {
  const found: Reference[] = [];
  for (const file of sourceFiles(SRC)) {
    if (file === TOKENS_FILE || file.endsWith(".test.ts")) continue;
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/var\(\s*(--eh-[a-z0-9-]+)\s*([,)])/g)) {
      if (m[2] === ",") continue; // has a fallback
      found.push({
        token: m[1],
        file: file.slice(SRC.length + 1).split("\\").join("/"),
        line: text.slice(0, m.index).split("\n").length,
      });
    }
  }
  return found;
}

describe("theme tokens", () => {
  it("declares every token the UI reads without a fallback", () => {
    const declared = declaredTokens();
    const undeclared = referencesWithoutFallback().filter(
      (r) => !declared.has(r.token),
    );
    expect(
      undeclared.map((r) => `${r.token} at ${r.file}:${r.line}`),
    ).toEqual([]);
  });

  it("actually finds the tokens and the references", () => {
    // Guards the assertion above from passing because both sides are empty —
    // a regex that silently stops matching would otherwise look like success.
    expect(declaredTokens().size).toBeGreaterThan(50);
    expect(referencesWithoutFallback().length).toBeGreaterThan(50);
  });

  it("catches an undeclared token", () => {
    // The check itself must be able to fail, or it proves nothing.
    const declared = declaredTokens();
    expect(declared.has("--eh-definitely-not-a-token")).toBe(false);
    expect(declared.has("--eh-accent")).toBe(true);
  });
});
