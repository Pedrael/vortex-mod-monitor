/**
 * `validateExternalMods` is a WHITELIST: it copies known fields onto a fresh
 * object and silently discards everything else. So a field can be added to the
 * type, written correctly, and saved to disk — and still be gone on the next
 * read, with nothing failing anywhere.
 *
 * That is exactly what happened to `url` and `mode`. The loss then cascaded:
 * a dropped `mode` reset the Source dropdown to Manual, and Manual HIDES the
 * link input, so the curator could not enter a URL at all. One silent discard,
 * three symptoms, none of them pointing at the cause.
 *
 * This round-trips a fully-populated config through a real save and a real
 * load, and asserts field by field that nothing was eaten.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  loadOrCreateCollectionConfig,
  saveCollectionConfig,
} from "./collectionConfig";
import type { CollectionConfig } from "./collectionConfig";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "eh-cfg-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const roundTrip = async (config: CollectionConfig): Promise<CollectionConfig> => {
  await saveCollectionConfig({ configDir: dir, slug: "round-trip", config });
  const { config: loaded } = await loadOrCreateCollectionConfig({
    configDir: dir,
    slug: "round-trip",
  });
  return loaded;
};

const base = (): CollectionConfig =>
  ({
    schemaVersion: 1,
    packageId: "11111111-2222-4333-8444-555555555555",
    externalMods: {},
  }) as CollectionConfig;

describe("collection config round-trip", () => {
  it("keeps every field of an external mod entry", async () => {
    const entry = {
      name: "A Mod",
      bundled: false,
      instructions: "Take the 2K version.",
      url: "https://example.com/mods/42",
      mode: "browse" as const,
    };
    const loaded = await roundTrip({
      ...base(),
      externalMods: { "mod-1": entry },
    });
    // Field by field, so a future whitelist gap names the field it ate.
    expect(loaded.externalMods["mod-1"]).toEqual(entry);
  });

  it("keeps each download mode", async () => {
    for (const mode of ["direct", "browse", "manual"] as const) {
      const loaded = await roundTrip({
        ...base(),
        externalMods: { m: { mode } },
      });
      expect(loaded.externalMods["m"]?.mode, mode).toBe(mode);
    }
  });

  it("keeps every field of a prerequisite entry", async () => {
    const dep = {
      included: false,
      instructions: "Get the NG build.",
      instructionsUrl: "https://f4se.silverlock.org/",
      version: "0.7.2",
    };
    const loaded = await roundTrip({
      ...base(),
      externalDependencies: { f4se: dep },
    } as CollectionConfig);
    expect(loaded.externalDependencies?.["f4se"]).toEqual(dep);
  });

  it("still rejects a mode it does not recognise", async () => {
    // Dropping a bad value is right; dropping a GOOD one was the bug.
    const loaded = await roundTrip({
      ...base(),
      externalMods: { m: { mode: "telepathy" as never, instructions: "kept" } },
    });
    expect(loaded.externalMods["m"]?.mode).toBeUndefined();
    expect(loaded.externalMods["m"]?.instructions).toBe("kept");
  });

  it("keeps the packageId, which is the collection's identity", async () => {
    const loaded = await roundTrip(base());
    expect(loaded.packageId).toBe("11111111-2222-4333-8444-555555555555");
  });
});
