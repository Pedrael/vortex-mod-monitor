/**
 * The dangerous outcome here is a CONFIDENT WRONG LINK.
 *
 * An external mod's instructions are followed by someone who does not have the
 * mod and cannot tell whether the link is right. A missing link costs them a
 * search; a wrong one sends them to the wrong file, or to a page the curator
 * never meant to publish, and they have no way to know. So most of these tests
 * are about refusing to guess: no name matching, no local paths, no
 * overwriting anything the curator wrote by hand.
 */
import { describe, expect, it } from "vitest";

import {
  applyHint,
  collectionHints,
  describeUndeclared,
  downloadHint,
  findCollectionHint,
  undeclaredDependencies,
} from "./externalHints";

const collectionMod = (rules: unknown[]) => ({
  "collection-1": { type: "collection", rules },
});

const browseRule = (
  reference: Record<string, unknown>,
  hint: { url?: string; instructions?: string },
) => ({ reference, downloadHint: { mode: "browse", ...hint } });

describe("collectionHints", () => {
  it("reads the curator's own browse-website answers", () => {
    const hints = collectionHints(
      collectionMod([
        browseRule(
          { id: "mod-a", archiveId: "arc-a", logicalFileName: "CoolMod.7z" },
          { url: "https://example.com/coolmod", instructions: "Take the FOMOD." },
        ),
      ]),
    );
    expect(hints).toHaveLength(1);
    expect(hints[0]?.hint).toEqual({
      url: "https://example.com/coolmod",
      instructions: "Take the FOMOD.",
      via: "collection-rule",
      // Vortex's own mode travels with the hint: it is the difference between
      // "find the file on this page" and "this link starts a download".
      mode: "browse",
    });
  });

  it("also reads the older extra.{url,instructions} shape", () => {
    const hints = collectionHints(
      collectionMod([
        { reference: { id: "mod-b" }, extra: { url: "https://e.com/b" } },
      ]),
    );
    expect(hints[0]?.hint.url).toBe("https://e.com/b");
  });

  it("ignores rules that carry no hint at all", () => {
    // Ordering and dependency rules are the overwhelming majority of rules on
    // a collection; none of them say where to download anything.
    const hints = collectionHints(
      collectionMod([
        { reference: { id: "mod-c" }, type: "after" },
        { reference: { id: "mod-d" }, downloadHint: { mode: "direct" } },
      ]),
    );
    expect(hints).toEqual([]);
  });

  it("ignores mods that are not collections", () => {
    const hints = collectionHints({
      "plain-mod": {
        type: "",
        rules: [browseRule({ id: "x" }, { url: "https://e.com/x" })],
      },
    });
    expect(hints).toEqual([]);
  });

  it("survives a state shape it does not recognise", () => {
    expect(collectionHints({})).toEqual([]);
    expect(collectionHints({ a: { type: "collection" } })).toEqual([]);
    expect(collectionHints({ b: { type: "collection", rules: "nope" } })).toEqual(
      [],
    );
  });
});

describe("findCollectionHint", () => {
  const index = collectionHints(
    collectionMod([
      browseRule({ id: "mod-a" }, { url: "https://e.com/by-id" }),
      browseRule({ archiveId: "arc-b" }, { url: "https://e.com/by-archive" }),
      browseRule(
        { logicalFileName: "ByFile.7z" },
        { url: "https://e.com/by-file" },
      ),
    ]),
  );

  it("matches on the Vortex mod id first", () => {
    const got = findCollectionHint({ id: "mod-a", name: "A" }, index);
    expect(got?.url).toBe("https://e.com/by-id");
  });

  it("falls back to the archive id", () => {
    const got = findCollectionHint(
      { id: "unknown", name: "B", archiveId: "arc-b" },
      index,
    );
    expect(got?.url).toBe("https://e.com/by-archive");
  });

  it("falls back to the archive filename, case-insensitively", () => {
    const got = findCollectionHint({ id: "u", name: "C" }, index, "byfile.7z");
    expect(got?.url).toBe("https://e.com/by-file");
  });

  it("does NOT match on display name", () => {
    // Two mods can share a name and names get edited. The cost of being wrong
    // is a user following a link to the wrong mod, so an unmatched mod stays
    // unmatched and the curator types what they type today.
    const named = collectionHints(
      collectionMod([
        { reference: { logicalFileName: "Other.7z" }, extra: { name: "Cool Mod", url: "https://e.com/wrong" } },
      ]),
    );
    expect(findCollectionHint({ id: "x", name: "Cool Mod" }, named)).toBeUndefined();
  });

  it("returns nothing rather than the first hint when nothing matches", () => {
    expect(findCollectionHint({ id: "nope", name: "N" }, index)).toBeUndefined();
  });
});

describe("downloadHint", () => {
  it("prefers the mod page over the file URL", () => {
    // A direct file URL is frequently signed or expiring — accurate about the
    // past and useless as an instruction to someone else.
    const got = downloadHint({
      sourceURI: "https://cdn.example.com/tmp/abc123?token=xyz",
      details: { homepage: "https://example.com/mods/42" },
    });
    expect(got).toEqual({ url: "https://example.com/mods/42", via: "homepage" });
  });

  it("uses the file URL when there is no page", () => {
    const got = downloadHint({ sourceURI: "https://example.com/file.7z" });
    expect(got).toEqual({ url: "https://example.com/file.7z", via: "download-uri" });
  });

  it("takes homepage from mod attributes when the download has none", () => {
    const got = downloadHint(undefined, { homepage: "https://example.com/p" });
    expect(got?.url).toBe("https://example.com/p");
  });

  it("refuses a local path", () => {
    // The curator's own disk. Meaningless on another machine, and it would
    // publish their directory layout.
    expect(
      downloadHint({ sourceURI: "C:\\Users\\someone\\Downloads\\mod.7z" }),
    ).toBeUndefined();
    expect(downloadHint({ sourceURI: "/home/someone/mod.7z" })).toBeUndefined();
  });

  it("refuses an nxm link", () => {
    // Vortex's own protocol. Not something a person can open in a browser.
    expect(
      downloadHint({ sourceURI: "nxm://fallout4/mods/42/files/99" }),
    ).toBeUndefined();
  });

  it("refuses empty and missing values", () => {
    expect(downloadHint(undefined)).toBeUndefined();
    expect(downloadHint({ sourceURI: "   " })).toBeUndefined();
    expect(downloadHint({ sourceURI: 42 })).toBeUndefined();
  });
});

describe("applyHint", () => {
  it("fills only what the curator left empty", () => {
    const out = applyHint(
      { instructions: "Get the 2K version." },
      { url: "https://e.com/m", instructions: "Take the FOMOD.", via: "collection-rule" },
    );
    // Their words survive; they gain the link they did not have.
    expect(out.instructions).toBe("Get the 2K version.");
    expect(out.url).toBe("https://e.com/m");
    expect(out.filledFrom).toBe("collection-rule");
  });

  it("never overwrites a curator-supplied value", () => {
    const out = applyHint(
      { url: "https://curator.example/right", instructions: "Mine." },
      { url: "https://scraped.example/wrong", instructions: "Scraped.", via: "download-uri" },
    );
    expect(out.url).toBe("https://curator.example/right");
    expect(out.instructions).toBe("Mine.");
    // Nothing was filled, so nothing claims to have been.
    expect(out.filledFrom).toBeUndefined();
  });

  it("is a no-op when there is no hint", () => {
    expect(applyHint({ instructions: "Mine." }, undefined)).toEqual({
      instructions: "Mine.",
    });
  });

  it("reports which source filled the gap", () => {
    // The curator should be able to tell an answer they wrote from one the
    // tool guessed, and judge it accordingly.
    const out = applyHint({}, { url: "https://e.com/x", via: "homepage" });
    expect(out.filledFrom).toBe("homepage");
  });
});

describe("download mode", () => {
  it("keeps Vortex's own mode, which is a statement of intent", () => {
    const direct = collectionHints(
      collectionMod([
        {
          reference: { id: "m" },
          downloadHint: { mode: "direct", url: "https://e.com/f.7z" },
        },
      ]),
    );
    expect(direct[0]?.hint.mode).toBe("direct");
  });

  it("drops a mode Vortex does not define", () => {
    const odd = collectionHints(
      collectionMod([
        {
          reference: { id: "m" },
          downloadHint: { mode: "telepathy", url: "https://e.com/x" },
        },
      ]),
    );
    expect(odd[0]?.hint.url).toBe("https://e.com/x");
    expect(odd[0]?.hint.mode).toBeUndefined();
  });

  it("infers no mode for a scraped URL", () => {
    // A homepage attribute is page-shaped and a sourceURI is file-shaped, but
    // neither is the curator saying what kind of link it is. Guessing on top
    // of a guess is how confident wrong instructions get produced.
    expect(
      downloadHint({ details: { homepage: "https://e.com/p" } })?.mode,
    ).toBeUndefined();
    expect(downloadHint({ sourceURI: "https://e.com/f.7z" })?.mode).toBeUndefined();
  });

  it("never lets a scraped hint overwrite the curator's mode", () => {
    const out = applyHint(
      { mode: "manual" },
      { url: "https://e.com/x", mode: "direct", via: "collection-rule" },
    );
    expect(out.mode).toBe("manual");
  });
});

describe("undeclaredDependencies", () => {
  const withRules = (rules: unknown[]) => collectionMod(rules);

  it("reports a declared download this collection does not ship", () => {
    // The catalogue is seven known tools found by their files. It cannot know
    // about a Buffout or a custom ENB — but the curator's own collection does.
    const out = undeclaredDependencies({
      modsInState: withRules([
        browseRule(
          { logicalFileName: "Buffout4.7z" },
          { url: "https://example.com/buffout", instructions: "Grab the NG build." },
        ),
      ]),
      includedMods: [{ id: "mine-1", name: "Something Else" }],
    });
    expect(out).toEqual([
      {
        name: "Buffout4.7z",
        url: "https://example.com/buffout",
        instructions: "Grab the NG build.",
      },
    ]);
  });

  it("says nothing about a dependency the collection already ships", () => {
    // Reporting a mod we install as missing would train the curator to ignore
    // this warning entirely.
    const out = undeclaredDependencies({
      modsInState: withRules([
        browseRule({ id: "mine-1" }, { url: "https://e.com/x" }),
      ]),
      includedMods: [{ id: "mine-1", name: "Shipped" }],
    });
    expect(out).toEqual([]);
  });

  it("matches a shipped mod by archive id and by archive filename", () => {
    const byArchiveId = undeclaredDependencies({
      modsInState: withRules([
        browseRule({ archiveId: "arc-9" }, { url: "https://e.com/a" }),
      ]),
      includedMods: [{ id: "m", name: "M", archiveId: "arc-9" }],
    });
    expect(byArchiveId).toEqual([]);

    const byFileName = undeclaredDependencies({
      modsInState: withRules([
        browseRule({ logicalFileName: "Mine.7z" }, { url: "https://e.com/b" }),
      ]),
      includedMods: [{ id: "m", name: "M" }],
      archiveNames: new Map([["m", "mine.7z"]]),
    });
    expect(byFileName).toEqual([]);
  });

  it("ignores rules with no download hint", () => {
    // Ordering rules are most of what a collection carries and declare nothing
    // about where to get anything.
    const out = undeclaredDependencies({
      modsInState: withRules([{ reference: { id: "x" }, type: "after" }]),
      includedMods: [],
    });
    expect(out).toEqual([]);
  });

  it("does not report the same download twice", () => {
    const out = undeclaredDependencies({
      modsInState: withRules([
        browseRule({ logicalFileName: "Dup.7z" }, { url: "https://e.com/d" }),
        browseRule({ logicalFileName: "Dup.7z" }, { url: "https://e.com/d" }),
      ]),
      includedMods: [],
    });
    expect(out).toHaveLength(1);
  });

  it("skips anything it cannot name, rather than warning about nothing", () => {
    const out = undeclaredDependencies({
      modsInState: withRules([
        { reference: { md5Hint: "abc" }, downloadHint: { mode: "manual", instructions: "ask me" } },
      ]),
      includedMods: [],
    });
    expect(out).toEqual([]);
  });
});

describe("describeUndeclared", () => {
  it("says nothing when there is nothing", () => {
    expect(describeUndeclared([])).toEqual([]);
  });

  it("frames it as what happens to the person installing", () => {
    // The curator knows what their collection contains. What they cannot see
    // is that the other end gets none of it.
    const said = describeUndeclared([
      { name: "Buffout4.7z", url: "https://e.com/b" },
    ]).join(" ");
    expect(said).toMatch(/will not be told they need them/);
    expect(said).toMatch(/Buffout4\.7z/);
    expect(said).toMatch(/https:\/\/e\.com\/b/);
    expect(said).toMatch(/README/);
  });
});
