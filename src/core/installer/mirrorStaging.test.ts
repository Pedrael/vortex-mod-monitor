/**
 * The mirror plan, and the deletion guard that stops it destroying anything.
 *
 * Restoring a file is recoverable. Deleting one the curator actually had —
 * because our record of their folder had a hole in it — is not. Most of what
 * follows is about that asymmetry.
 */
import { describe, expect, it } from "vitest";

import {
  describeMirrorPlan,
  filesNeedingPayload,
  mirrorProvesTarget,
  planMirror,
} from "./mirrorStaging";
import type { EhcollStagingFile } from "../../types/ehcoll";

const f = (path: string, sha256?: string, size = 10): EhcollStagingFile =>
  ({ path, size, ...(sha256 !== undefined ? { sha256 } : {}) });

const A = "a".repeat(64);
const B = "b".repeat(64);

describe("reconciling this machine against the curator's folder", () => {
  it("restores a file the user does not have", () => {
    const plan = planMirror({ target: [f("x.esp", A)], current: [] });
    expect(plan.restore).toEqual([
      { path: "x.esp", sha256: A, size: 10, reason: "missing" },
    ]);
    expect(plan.remove).toEqual([]);
  });

  it("replaces a file whose bytes differ", () => {
    // The cleaned plugin: present on both sides, different content.
    const plan = planMirror({
      target: [f("Common Clothes and Armors.esp", A)],
      current: [f("Common Clothes and Armors.esp", B)],
    });
    expect(plan.restore[0]).toMatchObject({ reason: "different", sha256: A });
  });

  it("leaves an identical file alone", () => {
    const plan = planMirror({ target: [f("x.esp", A)], current: [f("x.esp", A)] });
    expect(plan.restore).toEqual([]);
    expect(plan.matched).toBe(1);
  });

  it("deletes a file the curator does not have", () => {
    const plan = planMirror({
      target: [f("x.esp", A)],
      current: [f("x.esp", A), f("leftover.esp", B)],
    });
    expect(plan.remove).toEqual(["leftover.esp"]);
  });

  it("matches paths across case and separator", () => {
    // Vortex staging on Windows; the curator's casing is what gets written.
    const plan = planMirror({
      target: [f("Meshes/Plants/Juniper01.nif", A)],
      current: [f("meshes\\plants\\juniper01.nif", A)],
    });
    expect(plan.matched).toBe(1);
    expect(plan.remove).toEqual([]);
  });

  it("treats an unhashable local file as wrong, not as the same", () => {
    // A file this machine could not hash is UNKNOWN. The curator's recorded
    // bytes are the only known-good ones, so it gets rewritten.
    const plan = planMirror({
      target: [f("x.esp", A)],
      current: [f("x.esp", undefined)],
    });
    expect(plan.restore[0]).toMatchObject({ reason: "different" });
  });
});

describe("the deletion guard", () => {
  it("withholds every deletion when any target file lacks a hash", () => {
    // One hole in the curator's listing and "extra" becomes unprovable: an
    // unrecorded file and a genuinely extra one look identical from here.
    const plan = planMirror({
      target: [f("x.esp", A), f("unreadable.dds", undefined)],
      current: [f("x.esp", A), f("leftover.esp", B)],
    });
    expect(plan.remove).toEqual([]);
    expect(plan.removalWithheld?.count).toBe(1);
    expect(plan.removalWithheld?.why).toContain("without a checksum");
    expect(plan.unverifiable).toEqual(["unreadable.dds"]);
  });

  it("still restores what it can while withholding deletion", () => {
    const plan = planMirror({
      target: [f("x.esp", A), f("unreadable.dds", undefined)],
      current: [f("leftover.esp", B)],
    });
    expect(plan.restore.map((r) => r.path)).toEqual(["x.esp"]);
    expect(plan.remove).toEqual([]);
  });

  it("never empties a folder because the capture did not run", () => {
    // An empty target means "not captured", never "the folder was empty".
    const plan = planMirror({
      target: [],
      current: [f("everything.esp", A), f("else.bsa", B)],
    });
    expect(plan.remove).toEqual([]);
    expect(plan.removalWithheld?.count).toBe(2);
  });

  it("does not leave a file unverifiable when it simply is not here yet", () => {
    // Absent locally is not the same as unhashable: we have the bytes.
    const plan = planMirror({ target: [f("x.esp", A)], current: [] });
    expect(plan.unverifiable).toEqual([]);
  });
});

describe("what the user is told", () => {
  it("says nothing when the folder already matches", () => {
    expect(
      describeMirrorPlan("Mod", planMirror({ target: [f("x", A)], current: [f("x", A)] })),
    ).toBeUndefined();
  });

  it("separates restored from replaced, because they mean different things", () => {
    const line = describeMirrorPlan(
      "Apocalypse",
      planMirror({
        target: [f("a", A), f("b", A)],
        current: [f("b", B)],
      }),
    );
    expect(line).toContain("1 file(s) restored");
    expect(line).toContain("1 file(s) replaced with yours");
  });

  it("reports withheld deletions rather than staying silent about them", () => {
    const line = describeMirrorPlan(
      "Mod",
      planMirror({
        target: [f("x", A), f("no-hash", undefined)],
        current: [f("x", A), f("extra", B)],
      }),
    );
    expect(line).toContain("1 extra file(s) left in place");
  });
});

describe("what the package has to carry", () => {
  it("skips files the archive can already produce", () => {
    const need = filesNeedingPayload(
      [f("FromArchive.esp", A), f("MyEdit.esp", B)],
      new Set(["fromarchive.esp"]),
    );
    expect(need.map((n) => n.path)).toEqual(["MyEdit.esp"]);
  });

  it("never carries a file it has no hash for", () => {
    // Shipping bytes we cannot verify on arrival defeats the point.
    const need = filesNeedingPayload([f("NoHash.esp", undefined)], new Set());
    expect(need).toEqual([]);
  });
});

describe("when a mirror proves the folder matches", () => {
  const clean = () =>
    planMirror({ target: [f("x.esp", A)], current: [f("x.esp", B)] });
  const ok = { failures: [] as unknown[] };

  it("proves it when everything was checked, written and cleaned up", () => {
    expect(mirrorProvesTarget(clean(), ok)).toBe(true);
  });

  it("refuses when a file could not be written", () => {
    // The folder is nearer the target, not equal to it. A drift reference
    // here would make every future check compare against a fiction.
    expect(mirrorProvesTarget(clean(), { failures: ["x.esp"] })).toBe(false);
  });

  it("refuses when a target file had no hash to check", () => {
    const plan = planMirror({
      target: [f("x.esp", A), f("nohash.dds", undefined)],
      current: [],
    });
    expect(mirrorProvesTarget(plan, ok)).toBe(false);
  });

  it("refuses when extra files were left in place", () => {
    const plan = planMirror({
      target: [f("x.esp", A), f("nohash.dds", undefined)],
      current: [f("x.esp", A), f("extra.esp", B)],
    });
    expect(plan.removalWithheld).toBeDefined();
    expect(mirrorProvesTarget(plan, ok)).toBe(false);
  });

  it("proves it for a folder that already matched", () => {
    // Nothing to do is still a proof: every file was hash-compared.
    const plan = planMirror({ target: [f("x.esp", A)], current: [f("x.esp", A)] });
    expect(mirrorProvesTarget(plan, ok)).toBe(true);
  });
});
