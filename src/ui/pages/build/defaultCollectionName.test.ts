/**
 * The curator built "ivy", opened a fresh draft, and the form said
 * "My Collection" again. Not just a label: the name picks the slug, the slug
 * picks the config, and the config carries the packageId, the README, the
 * bundle ticks and the prerequisites. A wrong default silently puts a
 * different collection's settings on screen.
 */
import { describe, expect, it } from "vitest";

import { FALLBACK_COLLECTION_NAME, pickDefaultCollectionName } from "./engine";
import type { PublishedCollectionSummary } from "../../../core/manifest/collectionConfig";

const pub = (over: Partial<PublishedCollectionSummary>): PublishedCollectionSummary =>
  ({
    slug: "s",
    packageId: "p",
    configPath: "c",
    ...over,
  }) as PublishedCollectionSummary;

describe("pickDefaultCollectionName", () => {
  it("continues the collection built most recently", () => {
    const name = pickDefaultCollectionName(
      [
        pub({ slug: "my-collection", lastBuiltName: "My Collection", lastBuiltAt: "2026-08-25T21:55:50Z" }),
        pub({ slug: "ivy", lastBuiltName: "ivy", lastBuiltAt: "2026-08-25T22:45:43Z" }),
      ],
      "fallout4",
    );
    expect(name).toBe("ivy");
  });

  it("ignores collections built for another game", () => {
    // Building a Skyrim collection must not rename the Fallout draft.
    const name = pickDefaultCollectionName(
      [
        pub({ slug: "sky", lastBuiltName: "Sky", lastBuiltAt: "2026-08-26T10:00:00Z", gameId: "skyrimse" }),
        pub({ slug: "ivy", lastBuiltName: "ivy", lastBuiltAt: "2026-08-25T22:45:43Z", gameId: "fallout4" }),
      ],
      "fallout4",
    );
    expect(name).toBe("ivy");
  });

  it("ignores a config that was never built", () => {
    // Configs exist from abandoned attempts; they name nothing worth restoring.
    const name = pickDefaultCollectionName(
      [
        pub({ slug: "abandoned", lastBuiltName: undefined, lastBuiltAt: undefined }),
        pub({ slug: "ivy", lastBuiltName: "ivy", lastBuiltAt: "2026-08-25T22:45:43Z" }),
      ],
      "fallout4",
    );
    expect(name).toBe("ivy");
  });

  it("falls back to the slug when the name was never recorded", () => {
    const name = pickDefaultCollectionName(
      [pub({ slug: "legacy-thing", lastBuiltAt: "2026-08-25T22:45:43Z" })],
      "fallout4",
    );
    expect(name).toBe("legacy-thing");
  });

  it("falls back to the constant on a first run", () => {
    expect(pickDefaultCollectionName([], "fallout4")).toBe(FALLBACK_COLLECTION_NAME);
  });

  it("keeps a collection whose game was never recorded", () => {
    // Older configs predate the gameId field; excluding them would hide a
    // curator's only collection.
    const name = pickDefaultCollectionName(
      [pub({ slug: "old", lastBuiltName: "Old", lastBuiltAt: "2026-08-25T22:45:43Z" })],
      "fallout4",
    );
    expect(name).toBe("Old");
  });
});
