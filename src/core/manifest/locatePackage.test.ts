/**
 * One definition of "which package does this collection come from".
 *
 * Two features start from a receipt and need the `.ehcoll` behind it: the
 * Doctor repairs by re-running steps that read the manifest, and My
 * Collections' "check and continue" hands the package back to the installer.
 *
 * The Doctor grew the lookup inline first. A second hand-rolled copy in My
 * Collections is how two callers start disagreeing about which file belongs to
 * a collection — and this session already paid for that shape of bug once,
 * when `treatAsExternal` reached the manifest and neither of the two bundling
 * gates that had never heard of it.
 *
 * A unit test cannot catch a caller that stops calling, so this reads the
 * source, exactly like `bundleGateWiring.test.ts`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

const CALLERS = [
  join(ROOT, "ui", "pages", "doctor", "DoctorPage.tsx"),
  join(ROOT, "ui", "pages", "CollectionsPage.tsx"),
];

describe("locating a collection's package", () => {
  const sources = CALLERS.map((file) => ({
    file,
    text: readFileSync(file, "utf8"),
  }));

  it("finds the files it claims to check", () => {
    // An empty offender list must not be able to look like success.
    for (const s of sources) {
      expect(s.text.length).toBeGreaterThan(0);
      expect(s.text).toContain("packageVersion");
    }
  });

  it("routes both callers through locateCollectionPackage", () => {
    const offenders = sources
      .filter((s) => !s.text.includes("locateCollectionPackage"))
      .map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  it("has neither caller scanning the collections folder itself", () => {
    // The specific regression: re-deriving the filename instead of asking.
    const offenders: string[] = [];
    for (const { file, text } of sources) {
      if (text.includes("getCollectionsDir")) {
        offenders.push(`${file}: reads the collections dir directly`);
      }
      if (text.includes("matchEhcollFile")) {
        offenders.push(`${file}: matches the filename itself`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
