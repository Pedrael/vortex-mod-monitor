import { describe, expect, it } from "vitest";

import type { ArchiveListing } from "./archiveContents";
import { classifyVerification } from "./classifyVerification";

function archive(entries: Array<{ path: string; size?: number; crc?: string }>): ArchiveListing {
  const withCrc = entries.filter((e) => e.crc !== undefined).length;
  return { entries, withCrc, crcCoverage: entries.length ? withCrc / entries.length : 1 };
}

describe("classifyVerification", () => {
  it("reports ok when the user matches the curator", () => {
    const r = classifyVerification(
      [{ path: "a.esp", size: 10, crc: "aaaaaaaa" }],
      [{ path: "a.esp", size: 10, crc: "aaaaaaaa" }],
      archive([{ path: "a.esp", size: 10, crc: "aaaaaaaa" }]),
    );
    expect(r.ok).toBe(1);
    expect(r.reinstallWarranted).toBe(false);
  });

  it("blames the CURATOR when the user matches the archive and the curator does not", () => {
    // The real case: curator repacked the BA2 after installing. The user's
    // fresh install is the archive's bytes and is correct.
    const r = classifyVerification(
      [{ path: "T.ba2", size: 91398814, crc: "44b193f9" }], // curator, optimised
      [{ path: "T.ba2", size: 122430936, crc: "4eef1d22" }], // user, from archive
      archive([{ path: "T.ba2", size: 122430936, crc: "4eef1d22" }]),
    );
    expect(r.curatorDiverged).toBe(1);
    expect(r.unexplained).toBe(0);
  });

  it("does NOT warrant a reinstall for curator divergence", () => {
    // Reinstalling reproduces the archive bytes — exactly what the user has.
    // Triggering one would cost a full re-extract per optimised mod and fail
    // again, which is the bug this whole module exists to prevent.
    const r = classifyVerification(
      [{ path: "T.ba2", size: 1, crc: "11111111" }],
      [{ path: "T.ba2", size: 2, crc: "22222222" }],
      archive([{ path: "T.ba2", size: 2, crc: "22222222" }]),
    );
    expect(r.curatorDiverged).toBe(1);
    expect(r.reinstallWarranted).toBe(false);
  });

  it("reports unexplained when the file matches NEITHER reference", () => {
    const r = classifyVerification(
      [{ path: "a", size: 1, crc: "11111111" }],
      [{ path: "a", size: 3, crc: "33333333" }],
      archive([{ path: "a", size: 2, crc: "22222222" }]),
    );
    expect(r.unexplained).toBe(1);
    expect(r.reinstallWarranted).toBe(true);
  });

  it("treats a missing file as missing even when the curator's content was mutated", () => {
    // Presence is unaffected by mutation, so the curator's file SET stays the
    // right reference for omission — the half Vortex actually loses.
    const r = classifyVerification(
      [
        { path: "kept.esp", size: 1, crc: "11111111" },
        { path: "lost.esp", size: 2, crc: "22222222" },
      ],
      [{ path: "kept.esp", size: 1, crc: "11111111" }],
      archive([{ path: "lost.esp", size: 2, crc: "22222222" }]),
    );
    expect(r.missing).toBe(1);
    expect(r.reinstallWarranted).toBe(true);
  });

  it("matches the archive by CONTENT, not by path (FOMOD renames)", () => {
    const r = classifyVerification(
      [{ path: "Textures/a.dds", size: 5, crc: "aaaaaaaa" }],
      [{ path: "Textures/a.dds", size: 9, crc: "bbbbbbbb" }],
      archive([{ path: "optional/hi-res/a.dds", size: 9, crc: "bbbbbbbb" }]),
    );
    expect(r.curatorDiverged).toBe(1);
  });

  it("degrades to unexplained when no archive listing is available", () => {
    // No second opinion ⇒ we cannot exonerate the user. Callers must present
    // this as a degraded result, not a confident one.
    const r = classifyVerification(
      [{ path: "a", size: 1, crc: "11111111" }],
      [{ path: "a", size: 2, crc: "22222222" }],
      undefined,
    );
    expect(r.unexplained).toBe(1);
    expect(r.curatorDiverged).toBe(0);
  });

  it("counts files the curator never recorded as extra, not as errors", () => {
    // Legitimate when the user picks different FOMOD options.
    const r = classifyVerification(
      [{ path: "a", size: 1, crc: "11111111" }],
      [
        { path: "a", size: 1, crc: "11111111" },
        { path: "user-only.txt", size: 7, crc: "77777777" },
      ],
      archive([]),
    );
    expect(r.extra).toBe(1);
    expect(r.reinstallWarranted).toBe(false);
  });

  it("does not treat a size agreement with unknown crc as a contradiction", () => {
    const r = classifyVerification(
      [{ path: "a", size: 10 }],
      [{ path: "a", size: 10, crc: "aaaaaaaa" }],
      archive([]),
    );
    expect(r.ok).toBe(1);
  });

  it("still flags a size mismatch when crcs are unavailable", () => {
    const r = classifyVerification(
      [{ path: "a", size: 10 }],
      [{ path: "a", size: 11 }],
      archive([{ path: "a", size: 11 }]),
    );
    expect(r.curatorDiverged).toBe(1);
  });
});
