/**
 * The check exists to stop a curator shipping a mod nobody else can download.
 *
 * Its most important property is not what it detects — it is what it refuses
 * to claim. A false "this mod is gone" tells a curator to cut something that
 * works, and they have no way to find out the tool was wrong. So most of these
 * tests are about `unknown` staying `unknown`.
 */
import { describe, expect, it, vi } from "vitest";

import {
  checkNexusAvailability,
  classifyFile,
  fileIdOf,
  summarizeAvailability,
  type AvailabilityEntry,
  type AvailabilityFinding,
  type NexusAvailability,
  type NexusFileLike,
} from "./nexusAvailability";

const entry = (
  modId: number,
  fileId: number,
  name = `mod-${modId}`,
): AvailabilityEntry => ({
  compareKey: `nexus:${modId}:${fileId}`,
  name,
  modId,
  fileId,
});

describe("fileIdOf", () => {
  it("reads both spellings", () => {
    // The Nexus REST API is snake_case; Vortex's IFileInfo wrapper could not
    // be verified locally (@nexusmods/nexus-api is a types-only transitive
    // dep and is not installed). Guessing one would have failed as "every
    // file missing" — alarming, and completely wrong.
    expect(fileIdOf({ file_id: 7 })).toBe(7);
    expect(fileIdOf({ fileId: 7 })).toBe(7);
    expect(fileIdOf({})).toBeUndefined();
  });
});

describe("classifyFile", () => {
  const files: NexusFileLike[] = [
    { file_id: 100, category_name: "MAIN" },
    { file_id: 101, category_name: "OLD_VERSION" },
    { file_id: 102, category_name: "ARCHIVED" },
    { file_id: 103, category_name: null },
  ];

  it("finds a live file", () => {
    expect(classifyFile(files, 100).status).toBe("available");
  });

  it("flags old and archived files as fragile rather than fine", () => {
    // The early warning. These download today and are the ones authors delete
    // on their next update — which is exactly how a collection rots.
    expect(classifyFile(files, 101).status).toBe("old-version");
    expect(classifyFile(files, 102).status).toBe("old-version");
  });

  it("treats an uncategorised file as available, not fragile", () => {
    expect(classifyFile(files, 103).status).toBe("available");
  });

  it("reports a file that is no longer listed", () => {
    const r = classifyFile(files, 999);
    expect(r.status).toBe("file-missing");
    expect(r.detail).toContain("999");
  });

  it("refuses to read an empty list as 'everything was deleted'", () => {
    // A mod whose every file vanished is far less likely than a response we
    // did not understand. Calling it file-missing would condemn every file of
    // that mod on the strength of a shape mismatch.
    expect(classifyFile([], 100).status).toBe("unknown");
  });
});

describe("checkNexusAvailability", () => {
  it("makes one call per mod, not one per file", async () => {
    // The whole reason this is affordable: the real collection is 926
    // Nexus-sourced files across 780 unique mods.
    const getModFiles = vi.fn(async () => [{ file_id: 1 }]);
    const r = await checkNexusAvailability(
      [entry(50, 1), entry(50, 1), entry(51, 1)],
      { getModFiles },
    );
    expect(getModFiles).toHaveBeenCalledTimes(2);
    expect(r.findings).toHaveLength(3);
  });

  it("applies one mod's answer to all of its files", async () => {
    const r = await checkNexusAvailability([entry(50, 1), entry(50, 2)], {
      getModFiles: async () => [{ file_id: 1 }],
    });
    expect(r.findings.map((f) => f.status)).toEqual([
      "available",
      "file-missing",
    ]);
  });

  it("calls a rejected lookup mod-missing while the API is otherwise answering", async () => {
    let n = 0;
    const r = await checkNexusAvailability(
      [entry(1, 1), entry(2, 1), entry(3, 1)],
      {
        getModFiles: async () => {
          n += 1;
          if (n === 2) throw new Error("404 not found");
          return [{ file_id: 1 }];
        },
      },
    );
    expect(r.findings.map((f) => f.status)).toEqual([
      "available",
      "mod-missing",
      "available",
    ]);
  });

  it("stops calling mods missing once the API is clearly just refusing", async () => {
    // The install driver's systemic-failure lesson, applied to a read sweep.
    // Eight hundred rejections in a row is the API talking, not eight hundred
    // deleted mods — and reporting them as deleted would be catastrophic
    // advice.
    const entries = Array.from({ length: 20 }, (_, i) => entry(i + 1, 1));
    const r = await checkNexusAvailability(entries, {
      getModFiles: async () => {
        throw new Error("429 rate limited");
      },
      giveUpAfterConsecutiveFailures: 3,
    });
    const statuses = r.findings.map((f) => f.status);
    expect(statuses.slice(0, 2)).toEqual(["mod-missing", "mod-missing"]);
    expect(new Set(statuses.slice(3))).toEqual(new Set(["unknown"]));
    expect(r.gaveUpEarly).toBe(true);
    expect(r.modsChecked).toBeLessThan(entries.length);
  });

  it("does not give up because failures are merely frequent", async () => {
    // Alternating failures are consistent with genuinely deleted mods, which
    // is exactly what the curator needs told. Only a STREAK means systemic.
    let n = 0;
    const r = await checkNexusAvailability(
      Array.from({ length: 8 }, (_, i) => entry(i + 1, 1)),
      {
        getModFiles: async () => {
          n += 1;
          if (n % 2 === 0) throw new Error("404");
          return [{ file_id: 1 }];
        },
        giveUpAfterConsecutiveFailures: 3,
      },
    );
    expect(r.gaveUpEarly).toBe(false);
    expect(r.findings.filter((f) => f.status === "mod-missing")).toHaveLength(4);
  });

  it("reports the remainder as unknown when cancelled", async () => {
    const ac = new AbortController();
    let n = 0;
    const r = await checkNexusAvailability(
      Array.from({ length: 5 }, (_, i) => entry(i + 1, 1)),
      {
        getModFiles: async () => {
          n += 1;
          if (n === 2) ac.abort();
          return [{ file_id: 1 }];
        },
        signal: ac.signal,
      },
    );
    expect(
      r.findings.filter((f) => f.status === "unknown").length,
    ).toBeGreaterThan(0);
    expect(r.gaveUpEarly).toBe(true);
  });

  it("reports progress per mod so a 780-call sweep is not a frozen window", async () => {
    const seen: number[] = [];
    await checkNexusAvailability([entry(1, 1), entry(2, 1), entry(3, 1)], {
      getModFiles: async () => [{ file_id: 1 }],
      onProgress: (done, total) => {
        seen.push(done);
        expect(total).toBe(3);
      },
    });
    expect(seen).toEqual([1, 2, 3]);
  });
});

describe("summarizeAvailability", () => {
  const f = (status: NexusAvailability, n = 1): AvailabilityFinding[] =>
    Array.from({ length: n }, (_, i) => ({
      ...entry(i + 1, 1),
      status,
    }));

  it("leads with what users cannot download", () => {
    const s = summarizeAvailability([
      ...f("file-missing", 2),
      ...f("available", 900),
    ]);
    expect(s.clean).toBe(false);
    expect(s.lines[0]).toContain("2 mods");
    expect(s.lines[0]).toContain("cannot be downloaded");
  });

  it("says the curator's own copy still works, because it does", () => {
    // Without this the curator reasonably concludes their build is broken and
    // goes looking for a fault on their machine, where there is none.
    const s = summarizeAvailability(f("file-missing", 1));
    expect(s.lines[0]!.toLowerCase()).toContain("your copy still works");
  });

  it("counts old versions separately from problems", () => {
    const s = summarizeAvailability([
      ...f("old-version", 40),
      ...f("available", 5),
    ]);
    // Fragile, not broken: the collection installs fine today.
    expect(s.clean).toBe(true);
    expect(s.oldVersion).toBe(40);
    expect(s.lines.join(" ")).toContain("40 files are");
  });

  it("never folds unknown in with the problems", () => {
    // The load-bearing rule. "Could not check" must not read as "broken".
    const s = summarizeAvailability([...f("unknown", 12), ...f("available", 5)]);
    expect(s.clean).toBe(true);
    expect(s.fileMissing).toBe(0);
    expect(s.lines.join(" ")).toContain("could not be checked");
    expect(s.lines.join(" ")).toContain("not a problem with");
  });

  it("does not call a clean result a permanent guarantee", () => {
    // A file alive today can be deleted next week; saying "all fine" full stop
    // would be true and still leave the curator uninformed.
    const s = summarizeAvailability(f("available", 900));
    expect(s.clean).toBe(true);
    expect(s.lines[0]!.toLowerCase()).toContain("today, not");
  });
});

describe("telling the two kinds of 'gone' apart", () => {
  // They produce the identical download failure and mean opposite things, and
  // the difference is the curator's whole decision about what to do next:
  //
  //   file-missing  the page is up, this version was tidied away after an
  //                 update — benign, and a newer file probably exists
  //   mod-missing   the page itself is gone — usually an author pulling their
  //                 work or a moderation action, i.e. removed ON PURPOSE
  //
  // Reporting them as one number ("2 mods cannot be downloaded") hides the
  // only signal that separates "grab the new version" from "leave it alone".
  const f = (status: NexusAvailability, n = 1): AvailabilityFinding[] =>
    Array.from({ length: n }, (_, i) => ({
      ...entry(i + 1, 1),
      status,
    }));

  it("says an old version was probably just cleaned up after an update", () => {
    const lines = summarizeAvailability(f("file-missing", 3)).lines.join(" ");
    expect(lines).toContain("mod page is still up");
    expect(lines.toLowerCase()).toContain("not the one you tested");
  });

  it("says a vanished page is probably deliberate", () => {
    const lines = summarizeAvailability(f("mod-missing", 2)).lines.join(" ");
    expect(lines.toLowerCase()).toContain("deliberate");
    expect(lines.toLowerCase()).toContain("removed on purpose");
  });

  it("keeps the combined headline and then breaks it down", () => {
    const s = summarizeAvailability([...f("file-missing", 3), ...f("mod-missing", 2)]);
    expect(s.lines[0]).toContain("5 mods");
    expect(s.lines.join(" ")).toContain("3 of those");
    expect(s.lines.join(" ")).toContain("2 of those");
  });

  it("says nothing about a kind that did not occur", () => {
    const lines = summarizeAvailability(f("file-missing", 1)).lines.join(" ");
    expect(lines.toLowerCase()).not.toContain("deliberate");
  });
});
