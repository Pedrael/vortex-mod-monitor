/**
 * The distinction the panel was missing, and the FOMOD case that makes it hard.
 *
 * `unexplained` meant two things at once: a file the archive does not have
 * (declare it and the user goes without) and a file the archive HAS which the
 * curator edited (declare it and the user gets the archive's copy). One
 * sentence described both, and it was only true of the first.
 */
import { describe, expect, it } from "vitest";

import {
  classifyUnexplained,
  countKinds,
  describeUnexplainedFile,
  formatBytes,
} from "./unexplainedFiles";
import type { ArchiveListing } from "./archiveContents";

const listing = (entries: { path: string; size?: number }[]): ArchiveListing =>
  ({ entries, withCrc: 0, crcCoverage: 0 }) as unknown as ArchiveListing;

describe("added vs changed", () => {
  it("calls a file the archive has never heard of 'added'", () => {
    const [f] = classifyUnexplained(
      [{ path: "ApocalypseSpellsForNPCs_DISTR.ini", size: 900 }],
      listing([{ path: "Data/Something.esp", size: 100 }]),
    );
    expect(f).toEqual({ path: "ApocalypseSpellsForNPCs_DISTR.ini", kind: "added" });
  });

  it("calls a file the archive has 'changed', with the size delta", () => {
    // The real case: a cleaned plugin, 118 bytes smaller than its archive copy.
    const [f] = classifyUnexplained(
      [{ path: "Common Clothes and Armors.esp", size: 167165 }],
      listing([{ path: "Common Clothes and Armors.esp", size: 167283 }]),
    );
    expect(f).toEqual({
      path: "Common Clothes and Armors.esp",
      kind: "changed",
      delta: -118,
    });
  });

  it("reports a positive delta when the curator's copy is bigger", () => {
    const [f] = classifyUnexplained(
      [{ path: "Patched.esp", size: 2000 }],
      listing([{ path: "Patched.esp", size: 1000 }]),
    );
    expect(f!.delta).toBe(1000);
  });
});

describe("the FOMOD case", () => {
  it("matches on file NAME when the path does not line up", () => {
    // A FOMOD installs `<file source="00 Core/x.esp" destination="x.esp">`, so
    // the staged path has no counterpart even though the file is plainly in
    // the archive. Path-only matching would call this "added" and tell the
    // curator their users go without a file they will actually receive.
    const [f] = classifyUnexplained(
      [{ path: "x.esp", size: 50 }],
      listing([{ path: "00 Core/x.esp", size: 70 }]),
    );
    expect(f!.kind).toBe("changed");
    expect(f!.delta).toBe(-20);
  });

  it("prefers the full-path entry over a same-named one elsewhere", () => {
    const [f] = classifyUnexplained(
      [{ path: "a/x.esp", size: 50 }],
      listing([
        { path: "b/x.esp", size: 999 },
        { path: "a/x.esp", size: 70 },
      ]),
    );
    expect(f!.delta).toBe(-20);
  });

  it("does not invent a delta when the archive reported no size", () => {
    const [f] = classifyUnexplained(
      [{ path: "x.esp", size: 50 }],
      listing([{ path: "x.esp" }]),
    );
    expect(f).toEqual({ path: "x.esp", kind: "changed" });
  });

  it("is case- and separator-insensitive", () => {
    const [f] = classifyUnexplained(
      [{ path: "Meshes/Plants/Juniper01.nif", size: 10 }],
      listing([{ path: "meshes\\plants\\juniper01.nif", size: 12 }]),
    );
    expect(f!.kind).toBe("changed");
  });
});

describe("what the curator reads", () => {
  it("names the direction, because only its sign matters", () => {
    expect(describeUnexplainedFile({ path: "a", kind: "changed", delta: 25088 }))
      .toContain("BIGGER");
    expect(describeUnexplainedFile({ path: "a", kind: "changed", delta: -118 }))
      .toContain("smaller");
  });

  it("says plainly when the user gets nothing", () => {
    expect(describeUnexplainedFile({ path: "a", kind: "added" })).toContain(
      "users won't have it",
    );
  });

  it("handles a same-size difference without claiming a direction", () => {
    const s = describeUnexplainedFile({ path: "a", kind: "changed", delta: 0 });
    expect(s).not.toMatch(/bigger|smaller/i);
  });

  it("formats bytes at each scale", () => {
    expect(formatBytes(118)).toBe("118 bytes");
    expect(formatBytes(-25088)).toBe("24.5 KB");
    expect(formatBytes(1110000)).toBe("1.1 MB");
  });
});

describe("counting the kinds", () => {
  it("splits them for the copy that depends on the split", () => {
    expect(
      countKinds([
        { path: "a", kind: "added" },
        { path: "b", kind: "changed", delta: 1 },
        { path: "c", kind: "changed", delta: -1 },
      ]),
    ).toEqual({ added: 1, changed: 2 });
  });

  it("handles an empty set", () => {
    expect(countKinds([])).toEqual({ added: 0, changed: 0 });
  });
});
