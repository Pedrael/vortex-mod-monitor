/**
 * Which identity a mod ships with — the one thing a collection cannot get
 * wrong quietly.
 *
 * A mod built as `nexus:modId:fileId` PROMISES the user a download. When that
 * file has been deleted the promise fails on their machine, hundreds of mods
 * into an install, with the curator nowhere near. Shipping it by hash instead
 * is the only honest option left, and it is what lets the existing
 * external-mod machinery — bundle, link, instructions — apply to it.
 */
import { describe, expect, it } from "vitest";

import { shipsAsExternal } from "./buildManifest";

const nexusMod = (over = {}): never =>
  ({
    id: "m1",
    name: "Unofficial Fallout 4 Patch",
    source: "nexus",
    nexusModId: 4598,
    nexusFileId: 270951,
    archiveSha256: "a".repeat(64),
    ...over,
  }) as never;

const externalMod = (): never =>
  ({ id: "m2", name: "Hand-installed thing", source: "other" }) as never;

describe("shipsAsExternal", () => {
  it("keeps a healthy Nexus mod on its Nexus identity", () => {
    expect(shipsAsExternal(nexusMod(), undefined)).toBe(false);
    expect(shipsAsExternal(nexusMod(), { bundled: true })).toBe(false);
  });

  it("still treats a non-Nexus mod as external", () => {
    expect(shipsAsExternal(externalMod(), undefined)).toBe(true);
  });

  it("overrides valid Nexus ids when the curator says so", () => {
    // The whole feature. UFO4P 2.1.5 has perfectly good ids and a file that no
    // longer exists — the ids are true and useless.
    expect(shipsAsExternal(nexusMod(), { treatAsExternal: true })).toBe(true);
  });

  it("requires an explicit true, not merely a present spec", () => {
    // Every external mod has a spec. If a spec alone flipped the branch, the
    // first curator to type an instruction against a Nexus mod would silently
    // change its identity.
    expect(shipsAsExternal(nexusMod(), { instructions: "grab it here" })).toBe(
      false,
    );
    expect(shipsAsExternal(nexusMod(), { treatAsExternal: false })).toBe(false);
  });

  it("is not fooled by a mod that only half looks like a Nexus mod", () => {
    // A missing fileId means we could never have built a nexus compareKey, so
    // external is right regardless of the flag.
    expect(
      shipsAsExternal(nexusMod({ nexusFileId: undefined }), undefined),
    ).toBe(true);
    expect(shipsAsExternal(nexusMod({ source: "other" }), undefined)).toBe(true);
  });
});
