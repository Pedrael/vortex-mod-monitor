/**
 * One vocabulary across the dashboard's cards.
 *
 * A draft card and a published card sit in the same list and offer the same
 * two acts: go into this collection, and get rid of it. They said different
 * words for the first ("Open" vs "Edit") and shouted at different volumes for
 * it — a full-size amber block beside a small ghost button. A reader who sees
 * one act named two ways has to stop and work out whether they are actually
 * different things.
 *
 * The amber is the part that carries meaning and it is easy to spend by
 * accident. It does not mean "there is a draft here"; it means there is
 * something to ACT on — mods moved since the last build. That is exactly when
 * the published card turns its Edit into an Update, so the draft now does the
 * same, from the same fact (`linkedPublished.profileChanged`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const src = readFileSync(join(__dirname, "BuildDashboard.tsx"), "utf8");

const between = (from: string, to: string): string => {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a + 1);
  expect(a).toBeGreaterThan(-1);
  expect(b).toBeGreaterThan(a);
  return src.slice(a, b);
};

const draftCard = (): string => between("function DraftCard", "function DetailRow");
const publishedCard = (): string =>
  between("export function PublishedCard", "function DraftsRootHint");

describe("the two cards say the same words for the same act", () => {
  it("finds both components", () => {
    expect(draftCard().length).toBeGreaterThan(0);
    expect(publishedCard().length).toBeGreaterThan(0);
  });

  it("has no card calling it 'Open'", () => {
    // The word that was unique to the draft card, for the act the published
    // card calls Edit.
    expect(draftCard()).not.toMatch(/>\s*Open\s*</);
  });

  it("uses Edit and Update on both", () => {
    for (const [name, body] of [
      ["draft", draftCard()],
      ["published", publishedCard()],
    ] as const) {
      // JSX text or a ternary branch — either way the word is on a button.
      // JSX text sits on its own line, so allow whitespace either side.
      expect(body, `${name} lost "Edit"`).toMatch(/[>"\s]Edit[<"\s]/);
      expect(body, `${name} lost "Update"`).toMatch(/[>"\s]Update[<"\s]/);
    }
  });
});

describe("amber marks something to act on, not merely something that exists", () => {
  it("the draft's primary is conditional, never unconditional", () => {
    const body = draftCard();
    // `intent="primary"` with no condition is how the amber gets spent on a
    // card that has nothing to say.
    expect(body).toContain('intent={hasUnbuiltChanges ? "primary" : "ghost"}');
    expect(body).not.toMatch(/intent="primary"/);
  });

  it("reads the same fact the published card reads", () => {
    // Two cards deciding "is there anything to do" from different sources is
    // how they start disagreeing on screen.
    expect(draftCard()).toContain("linkedPublished?.profileChanged === true");
  });

  it("keeps Discard ghost, because danger belongs to Delete collection", () => {
    // Settled earlier and unchanged: discarding a draft loses typing on one
    // machine; deleting a collection ends a release lineage and reaches
    // everyone who installed it.
    expect(draftCard()).toContain(
      '<Button intent="ghost" size="sm" onClick={props.onDiscard}>',
    );
    // A danger BUTTON, specifically. The draft card also renders an error
    // Pill with the danger intent, and that is a status rather than an act —
    // the distinction the published card's own comment already draws.
    expect(draftCard()).not.toMatch(/<Button[^>]*intent="danger"/);
    expect(publishedCard()).toMatch(/<Button intent="danger"/);
  });

  it("sizes every action the same", () => {
    // The original complaint. A full-size button beside small ones reads as
    // more important than it is.
    const buttons = draftCard().match(/<Button[\s\S]*?>/g) ?? [];
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) {
      expect(b, `un-sized button in DraftCard: ${b.slice(0, 60)}`).toContain(
        'size="sm"',
      );
    }
  });
});

describe("the banner points at the button it means", () => {
  it("names Update rather than a verb no button carries", () => {
    // It said "open this draft and build" while the button now says Update.
    // Prose naming a control that is not on screen is its own small bug.
    expect(draftCard()).toContain("press Update and build to include them");
    expect(draftCard()).not.toContain("open this draft and build");
  });
});
