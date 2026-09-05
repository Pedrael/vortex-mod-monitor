/**
 * Two vocabularies that look like one.
 *
 * Six files built these strings and four parsed them, none of them together.
 * The cost was not merely repetition: `external:` carried TWO arities from one
 * ternary (`external:<sha>` and `external:staging:<hash>`) while the parser's
 * own comment asserted that prefix was single-segment, and the regex passed
 * the three-segment form by luck rather than intent.
 *
 * ─── THE DISTINCTION THAT MATTERS ──────────────────────────────────────
 * A compareKey names ONE mod. A rule reference may name a mod PAGE
 * (`nexus:<modId>` with no fileId), which can match several installed
 * variants — so `applyModRules` refuses to guess and reports a skip. Treat the
 * two as interchangeable and a conflict rule resolves onto the wrong variant:
 * a wrong answer that looks like the collection simply not working, and one
 * nobody would think to look for.
 *
 * ─── AND WHAT WAS DELIBERATELY LEFT OUT ────────────────────────────────
 * `getModCompareKey` in `utils.ts` is a third thing wearing these prefixes,
 * with machine-local `archive:`/`id:` fallbacks. It is deprecated and
 * superseded by `matchSnapshots`. Folding it in would have made the obsolete
 * conception canonical — the exact hazard of consolidating onto whichever
 * spelling is most widespread rather than onto the current one.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  archiveReference,
  externalArchiveCompareKey,
  externalStagingCompareKey,
  isFullyPinnedReference,
  nexusCompareKey,
  nexusFileReference,
  nexusModIdOfCompareKey,
  nexusModReference,
  parseCompareKey,
  parseModReference,
} from "./compareKey";

const SHA = "a".repeat(64);

describe("compareKey round-trips", () => {
  it("nexus", () => {
    const key = nexusCompareKey(80968, 341868);
    expect(key).toBe("nexus:80968:341868");
    expect(parseCompareKey(key)).toEqual({
      kind: "nexus",
      nexusModId: "80968",
      nexusFileId: "341868",
    });
  });

  it("external, by archive bytes", () => {
    const key = externalArchiveCompareKey(SHA);
    expect(parseCompareKey(key)).toEqual({ kind: "external-archive", sha256: SHA });
  });

  it("external, repacked from staging", () => {
    // Three segments under the `external:` prefix. The parser used to claim
    // this shape did not exist and accepted it anyway.
    const key = externalStagingCompareKey(SHA);
    expect(key).toBe(`external:staging:${SHA}`);
    expect(parseCompareKey(key)).toEqual({
      kind: "external-staging",
      stagingSetHash: SHA,
    });
  });

  it("keeps the two external shapes apart", () => {
    expect(parseCompareKey(externalArchiveCompareKey(SHA)).kind).toBe(
      "external-archive",
    );
    expect(parseCompareKey(externalStagingCompareKey(SHA)).kind).toBe(
      "external-staging",
    );
  });

  it("stringifies ids rather than re-coercing them", () => {
    // buildSession was the only site that ran Number() first, so a
    // non-canonical numeric id would have produced nexus:7 where the manifest
    // wrote nexus:007. Whatever arrives is what gets written.
    expect(nexusCompareKey("007", "08")).toBe("nexus:007:08");
  });

  it("reports an unfamiliar shape rather than guessing", () => {
    expect(parseCompareKey("id:local-thing")).toEqual({
      kind: "unrecognised",
      raw: "id:local-thing",
    });
    expect(parseCompareKey("").kind).toBe("unrecognised");
    expect(parseCompareKey("nexus:80968").kind).toBe("unrecognised");
  });

  it("extracts a nexus mod id, and nothing from the other kinds", () => {
    expect(nexusModIdOfCompareKey("nexus:80968:341868")).toBe("80968");
    expect(nexusModIdOfCompareKey(externalArchiveCompareKey(SHA))).toBeUndefined();
  });
});

describe("references may be partial, and that is the point", () => {
  it("a file reference pins one mod", () => {
    expect(parseModReference(nexusFileReference(1, 2))).toEqual({
      kind: "nexus-file",
      nexusModId: "1",
      nexusFileId: "2",
    });
    expect(isFullyPinnedReference("nexus:1:2")).toBe(true);
  });

  it("a mod-page reference pins nothing", () => {
    // The load-bearing case. Several installed variants can answer to it.
    expect(parseModReference(nexusModReference(999))).toEqual({
      kind: "nexus-mod",
      nexusModId: "999",
    });
    expect(isFullyPinnedReference("nexus:999")).toBe(false);
  });

  it("archive and legacy-id references pin one thing", () => {
    expect(parseModReference(archiveReference("abc")).kind).toBe("archive");
    expect(isFullyPinnedReference("archive:abc")).toBe(true);
    expect(parseModReference("id:local").kind).toBe("legacy-id");
    expect(isFullyPinnedReference("id:local")).toBe(true);
  });

  it("does not accept an unknown prefix as pinned", () => {
    expect(isFullyPinnedReference("mystery:1")).toBe(false);
    expect(parseModReference("mystery:1").kind).toBe("unrecognised");
  });
});

describe("nobody builds or parses these by hand any more", () => {
  const ROOT = join(__dirname, "..", "..");
  const SITES = [
    "core/manifest/buildManifest.ts",
    "core/manifest/collectionScope.ts",
    "core/archiveHashCache.ts",
    "core/manifest/parseManifest.ts",
    "core/doctor/runHeal.ts",
    "core/installer/applyModRules.ts",
    "ui/pages/build/buildSession.ts",
  ];

  it("finds every site it claims to check", () => {
    for (const rel of SITES) {
      expect(readFileSync(join(ROOT, rel), "utf8").length).toBeGreaterThan(0);
    }
  });

  it("has no inline construction left", () => {
    // The pipe-delimited grouping key in collectionScope is NOT a compareKey —
    // it names a mod PAGE plus an install name, for spotting duplicate
    // installs, and is pipe-delimited precisely so it can never be parsed as
    // one. It carries the `nexus:` prefix, so the scan has to tell them apart
    // rather than match on the prefix alone.
    const offenders: string[] = [];
    for (const rel of SITES) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      for (const line of src.split(String.fromCharCode(10))) {
        if (!/`(nexus|external|archive|id):\$\{/.test(line)) continue;
        if (line.includes("|")) continue; // the grouping key
        offenders.push(`${rel}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("has no inline parsing left", () => {
    const offenders = SITES.filter((rel) => {
      const src = readFileSync(join(ROOT, rel), "utf8");
      return /startsWith\("(nexus|external|archive|id):/.test(src) ||
        /\.split\(":"\)/.test(src);
    });
    expect(offenders).toEqual([]);
  });

  it("leaves the deprecated machine-local builder exactly where it is", () => {
    // Consolidating it would have canonicalised the superseded conception.
    const utils = readFileSync(join(ROOT, "utils/utils.ts"), "utf8");
    expect(utils).toContain("@deprecated");
    expect(utils).toContain("getModCompareKey");
    expect(utils).not.toContain("identity/compareKey");
  });
});

describe("the two vocabularies agree where they overlap", () => {
  it("a fully-pinned nexus reference is byte-identical to the compareKey", () => {
    // Not cosmetic. `parseManifest` validates a rule by asking
    // `compareKeys.has(rule.reference)` — a string comparison between a value
    // built by `nexusFileReference` and a set built by `nexusCompareKey`.
    // They are separate function bodies by design, because the vocabularies
    // are allowed to diverge elsewhere; this ONE form is the seam where they
    // must not. If they drift, every fully-pinned rule silently stops
    // matching and the collection loses its conflict resolution.
    for (const [m, f] of [
      [80968, 341868],
      ["007", "08"],
      [1, 2],
    ] as [string | number, string | number][]) {
      expect(nexusFileReference(m, f)).toBe(nexusCompareKey(m, f));
    }
  });

  it("and the partial form is NOT a compareKey", () => {
    // The other half of the seam: a mod-page reference must never collide
    // with a compareKey, or a rule would resolve onto an arbitrary variant.
    expect(parseCompareKey(nexusModReference(80968)).kind).toBe("unrecognised");
  });
});
