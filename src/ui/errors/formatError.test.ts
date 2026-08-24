/**
 * The manifest failure the curator actually sees.
 *
 * Their real build produced 221 problems — 220 mods with no source archive and
 * one duplicate identity — and the dialog led with "Couldn't assemble a
 * manifest from your current Vortex state" plus two hints about profiles and
 * load order, neither of which had anything to do with it. The count lived in
 * `BuildManifestError.message` and the classifier discarded it.
 */
import { describe, expect, it } from "vitest";

import { BuildManifestError } from "../../core/manifest/buildManifest";
import { formatError } from "./formatError";

const missingArchive = (id: string): string =>
  `Mod "${id}" has no archiveSha256. A Nexus mod is identified by ` +
  `(modId, fileId, sha256), and the sha256 can only be computed from the ` +
  `source archive — which Vortex no longer has. Re-download it, or rescan ` +
  `Downloads if the file is still on disk.`;

const duplicate =
  `Duplicate compareKey "external:fcd9eca2" for mods "Ivy'sPantiesSettings" ` +
  `and "Ivy'sPantiesSettings-SteamDeck". Two mods cannot share an identity ` +
  `in the same package.`;

describe("formatError — BuildManifestError", () => {
  it("leads with the count and the shape of the failure", () => {
    const errors = [
      ...Array.from({ length: 220 }, (_, i) => missingArchive(`mod-${i}`)),
      duplicate,
    ];
    const out = formatError(new BuildManifestError(errors));

    expect(out.message).toContain("221 problems");
    expect(out.message).toContain("220 Nexus mods whose source archive Vortex no longer has");
    expect(out.message).toContain("1 pair of mods sharing one identity");
    // Every problem still reaches the details list; the dialog scrolls.
    expect(out.details).toHaveLength(221);
  });

  it("gives advice that matches the problems actually present", () => {
    const out = formatError(new BuildManifestError([missingArchive("a")]));
    const hints = out.hints.join(" ");
    expect(hints).toMatch(/re-download/i);
    expect(hints).toMatch(/rescan the Downloads tab/i);
    // The old hints were generic and wrong for this failure.
    expect(hints).not.toMatch(/load order/i);
    expect(hints).not.toMatch(/profile is active/i);
  });

  it("does not offer archive advice when that is not the problem", () => {
    const out = formatError(new BuildManifestError([duplicate, duplicate]));
    const hints = out.hints.join(" ");
    expect(hints).toMatch(/installed twice/i);
    expect(hints).not.toMatch(/Re-download from Nexus/i);
  });

  it("counts anything it does not recognise rather than dropping it", () => {
    const out = formatError(
      new BuildManifestError([missingArchive("a"), "Something entirely new."]),
    );
    expect(out.message).toContain("1 other");
  });

  it("keeps the plain sentence for a single problem", () => {
    const out = formatError(new BuildManifestError([missingArchive("a")]));
    expect(out.message).toBe(
      "Couldn't assemble a manifest from your current Vortex state.",
    );
  });
});
