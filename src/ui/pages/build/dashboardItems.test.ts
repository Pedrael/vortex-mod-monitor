/**
 * The rule that decides what the Build dashboard lists.
 *
 * It is nine lines and it has produced two user-visible bugs, both of the same
 * shape: information the app HAD, and did not show. That is why it is a pure
 * exported function with tests rather than nine lines inside a `useMemo`.
 */
import { describe, expect, it } from "vitest";

import { pairDraftsWithPublished } from "./BuildDashboard";

const draft = (key: string, linkedPackageId?: string): never =>
  ({
    version: 2,
    savedAt: "2026-09-01T18:00:00.000Z",
    scope: "build",
    key,
    payload: {
      draftId: key,
      gameId: "fallout4",
      ...(linkedPackageId !== undefined
        ? { linkedPackageId, linkedSlug: "ivy-2" }
        : {}),
    },
  }) as never;

const pub = (packageId: string, slug = "ivy-2"): never =>
  ({
    packageId,
    slug,
    lastBuiltVersion: "1.0.11",
    lastBuiltProfileFingerprint: "edcd4cb94558bd50",
  }) as never;

describe("pairDraftsWithPublished", () => {
  it("hides a published collection that an open draft is updating", () => {
    // The draft IS the in-flight update; listing both is noise.
    const items = pairDraftsWithPublished([draft("d1", "p1")], [pub("p1")], "all");
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe("draft");
  });

  it("tells that draft WHICH collection it hid", () => {
    // Bug 1. The published card was the only thing that said "your mods have
    // changed since this was built". Hiding it silently removed the answer
    // along with the question — the dashboard knew, and said nothing.
    const items = pairDraftsWithPublished([draft("d1", "p1")], [pub("p1")], "all");
    const first = items[0] as { superseded?: { lastBuiltVersion?: string } };
    expect(first.superseded?.lastBuiltVersion).toBe("1.0.11");
  });

  it("still shows the collection under the Published filter", () => {
    // Bug 2. The header counted it ("1 draft · 1 published") while the tab
    // rendered nothing, and Edit / Details / Show files / Delete were
    // unreachable for as long as any draft existed.
    const items = pairDraftsWithPublished(
      [draft("d1", "p1")],
      [pub("p1")],
      "published",
    );
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe("published");
  });

  it("shows both when the draft is not linked to that collection", () => {
    const items = pairDraftsWithPublished([draft("d1")], [pub("p1")], "all");
    expect(items.map((i) => i.kind)).toEqual(["draft", "published"]);
  });

  it("does not confuse two published collections", () => {
    // Only the linked one hides. Matching on anything looser would make an
    // unrelated collection vanish because a draft happened to be open.
    const items = pairDraftsWithPublished(
      [draft("d1", "p1")],
      [pub("p1"), pub("p2", "other")],
      "all",
    );
    expect(items.map((i) => i.kind)).toEqual(["draft", "published"]);
    const shown = items[1] as { summary: { packageId: string } };
    expect(shown.summary.packageId).toBe("p2");
  });

  it("marks only the draft that actually supersedes something", () => {
    const items = pairDraftsWithPublished(
      [draft("d1", "p1"), draft("d2")],
      [pub("p1")],
      "all",
    );
    const [a, b] = items as Array<{ superseded?: unknown }>;
    expect(a!.superseded).toBeDefined();
    expect(b!.superseded).toBeUndefined();
  });

  it("returns only drafts under the Drafts filter", () => {
    const items = pairDraftsWithPublished([draft("d1")], [pub("p1")], "drafts");
    expect(items.map((i) => i.kind)).toEqual(["draft"]);
  });

  it("handles having nothing at all", () => {
    expect(pairDraftsWithPublished([], [], "all")).toEqual([]);
  });
});
