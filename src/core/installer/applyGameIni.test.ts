/**
 * Writing into someone's game configuration. The merge has to leave everything
 * it was not asked to change exactly as it found it — comments, ordering, the
 * user's own hand-tuned keys — because a collection states a starting
 * configuration, it does not own the file.
 */
import { describe, expect, it } from "vitest";

import { describeIniChanges, mergeIniText } from "./applyGameIni";

const lf = (...lines: string[]) => lines.join("\n");

describe("mergeIniText", () => {
  it("changes the value in place and reports before → after", () => {
    const out = mergeIniText(lf("[General]", "uGridsToLoad=5"), [
      { section: "General", key: "uGridsToLoad", value: "7" },
    ]);
    expect(out.text).toBe(lf("[General]", "uGridsToLoad=7"));
    expect(out.changed).toEqual([
      { section: "General", key: "uGridsToLoad", before: "5", after: "7" },
    ]);
  });

  it("leaves comments, blank lines and unrelated keys untouched", () => {
    // The reason this is a merge and not a rewrite: a parsed model round-trip
    // would silently discard every one of these.
    const original = lf(
      "; hand-tuned, do not lose me",
      "[General]",
      "uGridsToLoad=5",
      "",
      "; my own note",
      "sMyOwnSetting=keep",
    );
    const out = mergeIniText(original, [
      { section: "General", key: "uGridsToLoad", value: "7" },
    ]);
    expect(out.text).toBe(original.replace("uGridsToLoad=5", "uGridsToLoad=7"));
  });

  it("reports a key already at the wanted value as unchanged, not as applied", () => {
    const out = mergeIniText(lf("[A]", "k=v"), [{ section: "A", key: "k", value: "v" }]);
    expect(out.changed).toEqual([]);
    expect(out.unchanged).toBe(1);
  });

  it("appends a missing key under its existing section", () => {
    const out = mergeIniText(lf("[General]", "existing=1", "[Display]", "other=2"), [
      { section: "General", key: "added", value: "9" },
    ]);
    expect(out.text).toBe(
      lf("[General]", "existing=1", "added=9", "[Display]", "other=2"),
    );
    expect(out.changed).toEqual([
      { section: "General", key: "added", after: "9" },
    ]);
  });

  it("creates a section that does not exist at all", () => {
    const out = mergeIniText(lf("[General]", "k=v"), [
      { section: "Papyrus", key: "iMinMemoryPageSize", value: "256" },
    ]);
    expect(out.text).toBe(
      lf("[General]", "k=v", "", "[Papyrus]", "iMinMemoryPageSize=256"),
    );
  });

  it("rewrites the LAST duplicate — the one the game reads", () => {
    // Rewriting an earlier duplicate changes nothing while reporting that it
    // did, which is the worst of both.
    const out = mergeIniText(lf("[A]", "k=1", "k=2"), [
      { section: "A", key: "k", value: "9" },
    ]);
    expect(out.text).toBe(lf("[A]", "k=1", "k=9"));
    expect(out.changed[0]!.before).toBe("2");
  });

  it("matches section and key case-insensitively, keeping the user's spelling", () => {
    const out = mergeIniText(lf("[display]", "iSize W = 1920"), [
      { section: "Display", key: "isize w", value: "2560" },
    ]);
    // The user wrote the key with that spacing; only the value moves.
    expect(out.text).toBe(lf("[display]", "iSize W = 2560"));
  });

  it("preserves CRLF line endings", () => {
    // Windows INI files are CRLF, and rewriting them as LF makes every line
    // of a diff look changed.
    const out = mergeIniText("[A]\r\nk=1\r\n", [{ section: "A", key: "k", value: "2" }]);
    expect(out.text).toContain("\r\n");
    expect(out.text).not.toMatch(/[^\r]\n/);
  });

  it("does not touch a key of the same name in a different section", () => {
    const out = mergeIniText(lf("[A]", "k=1", "[B]", "k=2"), [
      { section: "B", key: "k", value: "9" },
    ]);
    expect(out.text).toBe(lf("[A]", "k=1", "[B]", "k=9"));
  });

  it("applies several sections in one pass without corrupting offsets", () => {
    const out = mergeIniText(
      lf("[A]", "a=1", "[B]", "b=1", "[C]", "c=1"),
      [
        { section: "A", key: "newA", value: "x" },
        { section: "C", key: "newC", value: "z" },
        { section: "B", key: "b", value: "9" },
      ],
    );
    expect(out.text).toBe(
      lf("[A]", "a=1", "newA=x", "[B]", "b=9", "[C]", "c=1", "newC=z"),
    );
  });

  it("does nothing to a file when there is nothing to assign", () => {
    const original = lf("[A]", "k=v");
    expect(mergeIniText(original, []).text).toBe(original);
  });
});

describe("describeIniChanges", () => {
  it("says what changed and what was added, per file", () => {
    const said = describeIniChanges("Fallout4Custom.ini", [
      { section: "General", key: "uGridsToLoad", before: "5", after: "7" },
      { section: "Papyrus", key: "iMinMemoryPageSize", after: "256" },
    ]);
    expect(said[0]).toBe("Fallout4Custom.ini [General] uGridsToLoad: 5 → 7");
    expect(said[1]).toBe("Fallout4Custom.ini [Papyrus] iMinMemoryPageSize = 256 (added)");
  });
});
