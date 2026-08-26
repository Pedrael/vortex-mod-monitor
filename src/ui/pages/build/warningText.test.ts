/**
 * Ten explanatory paragraphs rendered as ten list items is a wall, and a wall
 * gets skimmed — which loses the one warning that mattered. These are the real
 * warning strings the build produces.
 */
import { describe, expect, it } from "vitest";

import { splitWarning, warningTone } from "./warningText";

describe("splitWarning", () => {
  it("takes the first sentence as the headline and keeps the rest", () => {
    const { headline, detail } = splitWarning(
      "5 mods have no source archive and no Nexus source to fetch one from. " +
        "They still ship — they are identified by the SHA-256 of their deployed files.",
    );
    expect(headline).toBe(
      "5 mods have no source archive and no Nexus source to fetch one from.",
    );
    expect(detail).toMatch(/^They still ship/);
  });

  it("prefers a newline the author already put in", () => {
    // The drift warning separates its summary from its per-mod bullets. That
    // split is better than any sentence heuristic, because the bullets are
    // already a list.
    const { headline, detail } = splitWarning(
      ['4 external mods no longer match the archive they came from.', '  • "A": 1 file', '  • "B": 2 files'].join("\n"),
    );
    expect(headline).toBe("4 external mods no longer match the archive they came from.");
    expect(detail.split("\n")).toHaveLength(2);
  });

  it("does not split inside an abbreviation", () => {
    // "e.g." ends with a full stop and ends no sentence; splitting there
    // leaves the headline a fragment.
    const { headline } = splitWarning(
      'Ivy\'sPantiesSettings is missing 7 files that its archive contains, e.g. BakaScrapHeap.toml. That looks like a lost write.',
    );
    expect(headline).toMatch(/BakaScrapHeap\.toml\.$/);
  });

  it("does not split inside a version number or a filename", () => {
    const { headline } = splitWarning(
      "This collection needs game version 1.10.163.0 exactly. Use a downgrader.",
    );
    expect(headline).toBe("This collection needs game version 1.10.163.0 exactly.");
  });

  it("leaves a single-sentence warning with no detail", () => {
    const { headline, detail } = splitWarning("9 mods could not be checked against their archive.");
    expect(headline).toBe("9 mods could not be checked against their archive.");
    expect(detail).toBe("");
  });

  it("never returns an empty headline for a non-empty warning", () => {
    // A headline is what the curator reads; there is no acceptable input that
    // produces a blank one.
    for (const input of ["short", "...", "A. B.", "no trailing stop"]) {
      expect(splitWarning(input).headline.length).toBeGreaterThan(0);
    }
  });

  it("is empty-safe", () => {
    expect(splitWarning("   ")).toEqual({ headline: "", detail: "" });
  });
});

describe("warningTone", () => {
  it("calls out what did not ship", () => {
    expect(warningTone('"X" is flagged for bundling but could not be packed. It will not ship.')).toBe(
      "blocking",
    );
    expect(warningTone("10 mod(s) could not be checked against their archive.")).toBe("blocking");
  });

  it("flags a difference the curator should look at", () => {
    expect(warningTone("4 external mods no longer match the archive they came from.")).toBe(
      "attention",
    );
    expect(warningTone('"Ivy\'sPantiesSettings" is missing 7 file(s).')).toBe("attention");
  });

  it("treats an explanatory note as a note", () => {
    expect(
      warningTone("104 mod rule(s) reference mods that are not in this collection, so they were dropped."),
    ).toBe("note");
  });
});
