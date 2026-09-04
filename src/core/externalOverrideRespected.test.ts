/**
 * A mod the curator marked "ships as external" must stop being a problem.
 *
 * The reported case: High Poly Head's Nexus page is gone, so the curator did
 * the correct thing and marked it external — it ships keyed by the SHA-256 of
 * its deployed files, and `buildManifest` accepts it without an archive. Every
 * build then still said:
 *
 *   "1 Nexus mod cannot be packaged: … the archive is not in Vortex's
 *    download cache"
 *   "1 archive(s) could not be re-downloaded (e.g. High_Poly_Head…): Nexus
 *    returned no download id"
 *
 * while the availability panel on the SAME SCREEN labelled that mod "ships as
 * an external mod". Two answers to one question, three inches apart.
 *
 * The re-download is the worse half. The usual reason to mark a mod external
 * is that its page is GONE, so the offer is to fetch something that cannot be
 * fetched — it fails every time and leaves a warning about failing.
 */
import { describe, expect, it } from "vitest";

import { findRecoverableMods } from "./archiveRecovery";
import { shipsAsExternal } from "./manifest/shipsAsExternal";
import type { AuditorMod } from "./getModsListForProfile";
import type { ExternalModConfigEntry } from "./manifest/collectionConfig";

const mod = (id: string, over: Partial<AuditorMod> = {}): AuditorMod =>
  ({
    id,
    name: id,
    enabled: true,
    nexusModId: 80968,
    nexusFileId: 341868,
    ...over,
  }) as unknown as AuditorMod;

/** The predicate both UI callers build from their live overrides. */
const predicate =
  (overrides: Record<string, ExternalModConfigEntry>) =>
  (m: AuditorMod): boolean =>
    shipsAsExternal(
      typeof m.nexusModId === "number" && typeof m.nexusFileId === "number",
      overrides[m.id],
    );

describe("re-download offers", () => {
  it("skips a mod the curator marked external", () => {
    const mods = [mod("high-poly-head")];
    const { recoverable } = findRecoverableMods(mods, {
      shipsAsExternal: predicate({
        "high-poly-head": { treatAsExternal: true },
      }),
    });
    expect(recoverable).toEqual([]);
  });

  it("still offers one that is genuinely just missing its archive", () => {
    const { recoverable } = findRecoverableMods([mod("ordinary")], {
      shipsAsExternal: predicate({}),
    });
    expect(recoverable).toHaveLength(1);
    expect(recoverable[0]!.nexusModId).toBe(80968);
  });

  it("keeps the old behaviour when no predicate is supplied", () => {
    // The pure question — "which mods lack a hash" — still has a caller-free
    // answer, so this cannot silently change for a caller that never opted in.
    expect(findRecoverableMods([mod("x")]).recoverable).toHaveLength(1);
  });

  it("does not confuse 'external' with 'already hashed'", () => {
    const { recoverable, unattemptable } = findRecoverableMods(
      [mod("has-hash", { archiveSha256: "a".repeat(64) })],
      { shipsAsExternal: predicate({}) },
    );
    expect(recoverable).toEqual([]);
    expect(unattemptable).toEqual([]);
  });
});

describe("the build form and the availability panel agree", () => {
  // The specific inconsistency: `loadBuildContext` computed `unidentified`
  // with a bare `archiveSha256 === undefined`, while buildManifest and the
  // availability panel both routed through shipsAsExternal.
  const src = (): string =>
    require("node:fs").readFileSync(
      require("node:path").join(__dirname, "..", "ui", "pages", "build", "engine.ts"),
      "utf8",
    ) as string;

  it("computes 'unidentified' through shipsAsExternal", () => {
    // The filter moved into `findUnidentifiedMods`, which takes the config as
    // an argument — because as a closure it read `collectionConfig` before
    // that variable existed and threw on every build-form open. Behaviour is
    // the same; what changed is that TypeScript can now see the ordering.
    const body = src();
    const at = body.indexOf("export function findUnidentifiedMods(");
    expect(at).toBeGreaterThan(-1);
    expect(body.slice(at, at + 400)).toContain("shipsAsExternal");
  });

  it("calls it rather than re-deriving the set inline", () => {
    expect(src()).toContain("findUnidentifiedMods(mods, collectionConfig)");
  });

  it("has no bare archiveSha256-only test left in that decision", () => {
    expect(src()).not.toContain(
      "const unidentified = mods.filter((m) => m.archiveSha256 === undefined);",
    );
  });
});
