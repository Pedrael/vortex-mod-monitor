/**
 * A config is written the moment the Build page opens, so abandoned ones
 * accumulate invisibly. They are not inert: a slug IS a collection's identity
 * here, so building under an abandoned name later adopts ITS packageId and
 * release lineage instead of starting fresh.
 */
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  deleteCollectionConfig,
  listNeverBuiltConfigs,
  listPublishedCollections,
} from "./collectionConfig";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "eh-cfg-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

// Real UUIDv4s: the validator requires one, and a fixture that skips that
// requirement tests a config the loader would never accept.
const ids = new Map<string, string>();
const idFor = (slug: string): string => {
  const existing = ids.get(slug);
  if (existing !== undefined) return existing;
  const id = randomUUID();
  ids.set(slug, id);
  return id;
};

const write = (slug: string, extra: Record<string, unknown> = {}): void =>
  fs.writeFileSync(
    path.join(dir, `${slug}.json`),
    JSON.stringify({
      schemaVersion: 1,
      packageId: idFor(slug),
      externalMods: {},
      ...extra,
    }),
  );

describe("listNeverBuiltConfigs", () => {
  it("returns exactly the configs that never produced a package", () => {
    write("scratch");
    write("also-scratch");
    write("real", { lastBuiltAt: "2026-08-25T21:00:00Z", lastBuiltVersion: "1.0.0" });
    return listNeverBuiltConfigs(dir).then((out) => {
      expect(out.map((c) => c.slug)).toEqual(["also-scratch", "scratch"]);
    });
  });

  it("is the exact complement of the published list", async () => {
    // Anything that falls through both lists is a config nobody can see or
    // clean up — invisible state that still owns a slug.
    write("scratch");
    write("real", { lastBuiltAt: "2026-08-25T21:00:00Z" });
    const published = await listPublishedCollections(dir);
    const unbuilt = await listNeverBuiltConfigs(dir);
    const seen = [...published.map((p) => p.slug), ...unbuilt.map((u) => u.slug)].sort();
    expect(seen).toEqual(["real", "scratch"]);
  });

  it("carries the packageId, which is the reason these matter", async () => {
    write("scratch");
    const [only] = await listNeverBuiltConfigs(dir);
    expect(only!.packageId).toBe(idFor("scratch"));
  });

  it("reports an unreadable config instead of dropping it silently", async () => {
    fs.writeFileSync(path.join(dir, "broken.json"), "{ not json");
    const seen: string[] = [];
    const out = await listNeverBuiltConfigs(dir, {
      onError: (filename) => seen.push(filename),
    });
    expect(out).toEqual([]);
    expect(seen).toEqual(["broken.json"]);
  });

  it("returns nothing rather than throwing when the folder is absent", async () => {
    expect(await listNeverBuiltConfigs(path.join(dir, "nope"))).toEqual([]);
  });
});

describe("deleteCollectionConfig", () => {
  it("removes the file and leaves the others alone", async () => {
    write("scratch");
    write("real", { lastBuiltAt: "2026-08-25T21:00:00Z" });
    await deleteCollectionConfig(path.join(dir, "scratch.json"));
    expect(fs.readdirSync(dir)).toEqual(["real.json"]);
  });

  it("is quiet about a file that is already gone", async () => {
    await expect(
      deleteCollectionConfig(path.join(dir, "never-existed.json")),
    ).resolves.toBeUndefined();
  });
});
