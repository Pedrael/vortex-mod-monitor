import { describe, it, expect } from "vitest";

import type { AuditorMod } from "../getModsListForProfile";
import {
  matchSnapshots,
  normalizeModName,
  normalizeVersion,
} from "./modIdentity";

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

function makeMod(partial: Partial<AuditorMod> & { id: string }): AuditorMod {
  return {
    name: partial.id,
    enabled: true,
    hasInstallerChoices: false,
    hasDetailedInstallerChoices: false,
    rules: [],
    modType: "",
    fileOverrides: [],
    enabledINITweaks: [],
    fomodSelections: [],
    installOrder: 0,
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

describe("normalizeVersion", () => {
  it("lowercases, strips leading v, unifies separators", () => {
    expect(normalizeVersion("V1.1.1")).toBe("1.1.1");
    expect(normalizeVersion("v.2-0")).toBe("2.0");
    expect(normalizeVersion("  1_15 ")).toBe("1.15");
    expect(normalizeVersion(undefined)).toBe("");
    expect(normalizeVersion("")).toBe("");
  });
});

describe("normalizeModName", () => {
  it("strips the Vortex install pin (modId + dashed version + timestamp)", () => {
    const mod = makeMod({
      id: "(Main Files) C.H.A.K. Animation Pack-63246-1-15-1681659565",
      name: "(Main Files) C.H.A.K. Animation Pack-63246-1-15-1681659565",
    });
    expect(normalizeModName(mod)).toBe("mainfileschakanimationpack");
  });

  it("collapses separators to a lowercase alphanumeric core", () => {
    expect(normalizeModName(makeMod({ id: "AAF_SEU_V1.19" }), false)).toBe(
      "aafseuv119",
    );
  });

  it("removes version tokens when stripVersion=true", () => {
    const a = normalizeModName(makeMod({ id: "Some Mod v1.2.3" }), true);
    const b = normalizeModName(makeMod({ id: "Some Mod v2.0.0" }), true);
    expect(a).toBe(b);
    expect(a).toBe("somemod");
  });
});

// ---------------------------------------------------------------------------
// Tier ladder
// ---------------------------------------------------------------------------

describe("matchSnapshots tiers", () => {
  it("nexus-file: equal modId + fileId (confidence 1.0)", () => {
    const ref = [makeMod({ id: "r", name: "X", nexusModId: 1, nexusFileId: 10 })];
    const cur = [makeMod({ id: "c", name: "Y", nexusModId: 1, nexusFileId: 10 })];
    const res = matchSnapshots(ref, cur);
    expect(res.matches).toHaveLength(1);
    expect(res.matches[0].tier).toBe("nexus-file");
    expect(res.matches[0].confidence).toBe(1);
    expect(res.onlyInReference).toHaveLength(0);
    expect(res.onlyInCurrent).toHaveLength(0);
  });

  it("archive-sha: identical archive bytes, different names", () => {
    const ref = [makeMod({ id: "r", name: "Display A", archiveSha256: "a".repeat(64) })];
    const cur = [makeMod({ id: "c", name: "Display B", archiveSha256: "a".repeat(64) })];
    const res = matchSnapshots(ref, cur);
    expect(res.matches).toHaveLength(1);
    expect(res.matches[0].tier).toBe("archive-sha");
  });

  it("staging-set: identical deployed file set when no archive sha", () => {
    const ref = [makeMod({ id: "r", name: "Alpha", stagingSetHash: "b".repeat(64) })];
    const cur = [makeMod({ id: "c", name: "Beta", stagingSetHash: "b".repeat(64) })];
    const res = matchSnapshots(ref, cur);
    expect(res.matches).toHaveLength(1);
    expect(res.matches[0].tier).toBe("staging-set");
  });

  it("nexus-mod: same modId, different fileId = version drift (0.95)", () => {
    const ref = [makeMod({ id: "r", name: "M", nexusModId: 5, nexusFileId: 100 })];
    const cur = [makeMod({ id: "c", name: "M", nexusModId: 5, nexusFileId: 200 })];
    const res = matchSnapshots(ref, cur);
    expect(res.matches).toHaveLength(1);
    expect(res.matches[0].tier).toBe("nexus-mod");
    expect(res.matches[0].confidence).toBeCloseTo(0.95);
  });

  it("fuzzy-name-version: same normalized name + version, no hashes", () => {
    const ref = [makeMod({ id: "local-ref-1", name: "AAF SEU", version: "1.19", archiveId: "refArch" })];
    const cur = [makeMod({ id: "local-cur-9", name: "AAF_SEU", version: "1.19", archiveId: "curArch" })];
    const res = matchSnapshots(ref, cur);
    expect(res.matches).toHaveLength(1);
    expect(res.matches[0].tier).toBe("fuzzy-name-version");
    expect(res.matches[0].confidence).toBeCloseTo(0.9);
  });

  it("fuzzy-name: same name, different version", () => {
    const ref = [makeMod({ id: "r", name: "Some External Mod", version: "1.0" })];
    const cur = [makeMod({ id: "c", name: "Some External Mod", version: "2.0" })];
    const res = matchSnapshots(ref, cur);
    expect(res.matches).toHaveLength(1);
    expect(res.matches[0].tier).toBe("fuzzy-name");
    expect(res.matches[0].confidence).toBeCloseTo(0.75);
  });

  it("fuzzy-similar: token overlap above threshold, mutual best", () => {
    const ref = [makeMod({ id: "r", name: "alpha beta gamma delta" })];
    const cur = [makeMod({ id: "c", name: "alpha beta gamma delta epsilon" })];
    const res = matchSnapshots(ref, cur);
    expect(res.matches).toHaveLength(1);
    expect(res.matches[0].tier).toBe("fuzzy-similar");
    expect(res.matches[0].confidence).toBeGreaterThanOrEqual(0.85);
  });
});

// ---------------------------------------------------------------------------
// Real-world regression: cross-machine false split
// ---------------------------------------------------------------------------

describe("cross-machine false split (the headline bug)", () => {
  it("matches an external mod with machine-local id/archiveId and asymmetric sha", () => {
    // Curator side: has an archive sha. User side: archive purged, no sha.
    // Both carry machine-local ids/archiveIds that never match across machines.
    const ref = [
      makeMod({
        id: "AAF_SEU_V1.19",
        name: "AAF_SEU_V1.19",
        source: "unknown",
        archiveId: "ref-arch-123",
        archiveSha256: "c".repeat(64),
      }),
    ];
    const cur = [
      makeMod({
        id: "AAF_SEU_V1.19",
        name: "AAF_SEU_V1.19",
        archiveId: "cur-arch-999",
      }),
    ];
    const res = matchSnapshots(ref, cur);
    expect(res.matches).toHaveLength(1);
    expect(res.matches[0].tier).toBe("fuzzy-name-version");
    expect(res.onlyInReference).toHaveLength(0);
    expect(res.onlyInCurrent).toHaveLength(0);
  });

  it("keeps genuinely different mods apart", () => {
    const ref = [makeMod({ id: "r", name: "Totally Different Mod A" })];
    const cur = [makeMod({ id: "c", name: "Completely Unrelated Thing B" })];
    const res = matchSnapshots(ref, cur);
    expect(res.matches).toHaveLength(0);
    expect(res.onlyInReference).toHaveLength(1);
    expect(res.onlyInCurrent).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Safety: 1:1 ambiguity guard + confidence threshold
// ---------------------------------------------------------------------------

describe("1:1 ambiguity guard", () => {
  it("leaves colliding fuzzy keys unmatched rather than guessing", () => {
    const ref = [
      makeMod({ id: "a", name: "Duplicate Name", version: "1" }),
      makeMod({ id: "b", name: "Duplicate Name", version: "1" }),
    ];
    const cur = [makeMod({ id: "c", name: "Duplicate Name", version: "1" })];
    // Disable similarity so we test the keyed-tier guard in isolation.
    const res = matchSnapshots(ref, cur, { enableSimilarity: false });
    expect(res.matches).toHaveLength(0);
    expect(res.onlyInReference).toHaveLength(2);
    expect(res.onlyInCurrent).toHaveLength(1);
  });
});

describe("confidence threshold", () => {
  const ref = [makeMod({ id: "r", name: "Some External Mod", version: "1.0" })];
  const cur = [makeMod({ id: "c", name: "Some External Mod", version: "2.0" })];

  it("matches via fuzzy-name at the default threshold (0.7)", () => {
    const res = matchSnapshots(ref, cur, { enableSimilarity: false });
    expect(res.matches).toHaveLength(1);
    expect(res.matches[0].tier).toBe("fuzzy-name");
  });

  it("disables fuzzy-name when the threshold exceeds its confidence", () => {
    const res = matchSnapshots(ref, cur, {
      fuzzyThreshold: 0.8,
      enableSimilarity: false,
    });
    expect(res.matches).toHaveLength(0);
    expect(res.onlyInReference).toHaveLength(1);
    expect(res.onlyInCurrent).toHaveLength(1);
  });
});
