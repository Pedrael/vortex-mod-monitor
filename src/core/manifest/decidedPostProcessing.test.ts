/**
 * ──────────────────────────────────────────────────────────────────────
 * "It prompts me about the same mods every build."
 *
 * It did, and only for two of the three buttons. `postProcessed` closed the
 * question; `mirrored` and `bundled` wrote a config entry, said "saved", and
 * came back next build — the answer stuck everywhere except in the one place
 * that decides whether to ask.
 *
 * The other half is the opposite risk: an answer that never expires. "These
 * files are mine, users don't need them" is a statement about the files that
 * were there. Drop a patch into the same folder afterwards and the old answer
 * withholds it silently, with nothing to see in any report. So an answer is
 * recorded against a fingerprint of what it was about, and the question
 * reopens exactly when that moves.
 * ──────────────────────────────────────────────────────────────────────
 */
import { describe, expect, it } from "vitest";

import { decidedPostProcessing, modsNewlyBundled } from "./collectionConfig";
import { findPostProcessingCandidates } from "./runSelfChecks";
import { fingerprintUnexplained } from "./unexplainedFiles";
import type { CollectionConfig } from "./collectionConfig";
import type { SelfCheckReport } from "./selfCheckMod";

const config = (
  externalMods: CollectionConfig["externalMods"],
): CollectionConfig => ({ externalMods }) as CollectionConfig;

const report = (
  modId: string,
  over: Partial<SelfCheckReport> = {},
): SelfCheckReport =>
  ({
    modId,
    modName: modId,
    depth: "compared",
    notes: [],
    missing: [],
    unexplained: 3,
    unexplainedExamples: [],
    omissionLeads: [],
    stagedCount: 10,
    expectedCount: 10,
    unexplainedFingerprint: "fp-original",
    ...over,
  }) as SelfCheckReport;

describe("which answers count as answers", () => {
  it("counts all three buttons, not just declare", () => {
    // The bug, stated. Only `postProcessed` used to reach this.
    const decided = decidedPostProcessing(
      config({
        declared: { postProcessed: true },
        mirroredMod: { mirrored: true },
        bundledMod: { bundled: true },
      }),
    );
    expect([...decided.keys()].sort()).toEqual([
      "bundledMod",
      "declared",
      "mirroredMod",
    ]);
  });

  it("ignores an entry that carries no decision", () => {
    // A URL or instructions typed on the build form are not an answer to
    // "what happens to your diverged files".
    const decided = decidedPostProcessing(
      config({ justAUrl: { url: "https://example.invalid" } }),
    );
    expect(decided.size).toBe(0);
  });

  it("carries the fingerprint the answer was given against", () => {
    const decided = decidedPostProcessing(
      config({ m: { mirrored: true, postProcessingDecidedFor: "fp-original" } }),
    );
    expect(decided.get("m")).toBe("fp-original");
  });
});

describe("whether the question comes back", () => {
  it("stays shut for a mirrored mod whose files have not changed", () => {
    // The exact case the curator hit: every card answered "Reproduce my
    // version", every card asked again on the next build.
    const decided = decidedPostProcessing(
      config({ m: { mirrored: true, postProcessingDecidedFor: "fp-original" } }),
    );
    expect(findPostProcessingCandidates([report("m")], decided)).toEqual([]);
  });

  it("stays shut for a bundled mod too", () => {
    const decided = decidedPostProcessing(
      config({ m: { bundled: true, postProcessingDecidedFor: "fp-original" } }),
    );
    expect(findPostProcessingCandidates([report("m")], decided)).toEqual([]);
  });

  it("REOPENS when the diverged files have changed since", () => {
    // A file added to the same folder after the answer. Reapplying "users
    // don't need them" here would withhold it with nothing to see.
    const decided = decidedPostProcessing(
      config({ m: { postProcessed: true, postProcessingDecidedFor: "fp-original" } }),
    );
    const found = findPostProcessingCandidates(
      [report("m", { unexplainedFingerprint: "fp-something-else" })],
      decided,
    );
    expect(found).toHaveLength(1);
    expect(found[0]!.reopened).toBe(true);
  });

  it("marks a first-time question as NOT a re-ask", () => {
    const found = findPostProcessingCandidates([report("m")], new Map());
    expect(found).toHaveLength(1);
    expect(found[0]!.reopened).toBe(false);
  });

  it("honours an answer written before fingerprints existed", () => {
    // Upgrading must not re-open every decision the curator ever made. An
    // answer with nothing recorded about it simply never expires.
    const decided = decidedPostProcessing(config({ m: { mirrored: true } }));
    expect(findPostProcessingCandidates([report("m")], decided)).toEqual([]);
  });

  it("honours an answer when the report cannot produce a fingerprint", () => {
    const decided = decidedPostProcessing(
      config({ m: { mirrored: true, postProcessingDecidedFor: "fp-original" } }),
    );
    const noFp = report("m", {});
    delete (noFp as { unexplainedFingerprint?: string }).unexplainedFingerprint;
    expect(findPostProcessingCandidates([noFp], decided)).toEqual([]);
  });

  it("hands the current fingerprint to the UI, so the answer records it", () => {
    const [candidate] = findPostProcessingCandidates([report("m")], new Map());
    expect(candidate!.fingerprint).toBe("fp-original");
  });

  it("says nothing about a mod with no diverged files at all", () => {
    expect(
      findPostProcessingCandidates([report("m", { unexplained: 0 })], new Map()),
    ).toEqual([]);
  });
});

describe("the fingerprint itself", () => {
  const files = [
    { path: "b.esp", sha256: "bbb" },
    { path: "a/x.nif", sha256: "aaa" },
  ];

  it("does not change when the files come back in another order", () => {
    // The walk's order is an implementation detail. Reporting it as a change
    // would reopen every question on every build.
    expect(fingerprintUnexplained(files)).toBe(
      fingerprintUnexplained([...files].reverse()),
    );
  });

  it("changes when a file is added", () => {
    expect(
      fingerprintUnexplained([...files, { path: "c.esp", sha256: "ccc" }]),
    ).not.toBe(fingerprintUnexplained(files));
  });

  it("changes when a file's CONTENT changes under the same path", () => {
    // The case a path list cannot see, and the one that matters most: an
    // edit in place to a file the curator already answered about.
    const edited = [{ path: "b.esp", sha256: "different" }, files[1]!];
    expect(fingerprintUnexplained(edited)).not.toBe(
      fingerprintUnexplained(files),
    );
  });

  it("falls back to size when a file has no hash", () => {
    expect(fingerprintUnexplained([{ path: "a", size: 1 }])).not.toBe(
      fingerprintUnexplained([{ path: "a", size: 2 }]),
    );
  });

  it("is empty-stable", () => {
    expect(fingerprintUnexplained([])).toBe(fingerprintUnexplained([]));
  });
});


describe("an answer given while the build is paused", () => {
  // Bundling runs BEFORE the self-check, because a bundled mod's archive IS
  // its staging and comparing them is meaningless. So "ship my copy" —
  // the right answer for LOD output — arrives after its own repack has
  // already gone by, and needs a second pass to land in this build.
  it("names a mod that just gained the bundle flag", () => {
    expect(
      modsNewlyBundled(
        config({ lods: { postProcessed: true } }),
        config({ lods: { bundled: true } }),
      ),
    ).toEqual(["lods"]);
  });

  it("names a mod that had no entry at all before", () => {
    expect(modsNewlyBundled(config({}), config({ lods: { bundled: true } }))).toEqual([
      "lods",
    ]);
  });

  it("does NOT re-pack a mod that was already bundled", () => {
    // It was packed on the first pass. Repacking it would be minutes of
    // 7z for a file that already exists.
    expect(
      modsNewlyBundled(
        config({ m: { bundled: true } }),
        config({ m: { bundled: true } }),
      ),
    ).toEqual([]);
  });

  it("ignores answers that need no repack", () => {
    // `mirrored` and `postProcessed` are consumed after this point, so they
    // land in the same build with no extra work.
    expect(
      modsNewlyBundled(
        config({}),
        config({ a: { mirrored: true }, b: { postProcessed: true } }),
      ),
    ).toEqual([]);
  });

  it("returns them in a stable order", () => {
    expect(
      modsNewlyBundled(
        config({}),
        config({ zeta: { bundled: true }, alpha: { bundled: true } }),
      ),
    ).toEqual(["alpha", "zeta"]);
  });

  it("survives a config with no external mods at all", () => {
    expect(modsNewlyBundled({} as never, {} as never)).toEqual([]);
  });
});
