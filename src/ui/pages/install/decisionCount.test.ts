/**
 * The friend installing a 954-mod collection meets a Continue button that is
 * disabled, with the reason in a `title` tooltip on the disabled element —
 * which browsers frequently do not render. So the honest description of the
 * old behaviour is: they cannot proceed and nothing tells them why.
 *
 * The count has to agree with `canProceedFromDecisions` exactly. A count of
 * zero beside a disabled button, or a count of three beside an enabled one,
 * is worse than the tooltip was.
 */
import { describe, expect, it } from "vitest";

import {
  canProceedFromDecisions,
  countUndecidedConflicts,
} from "./state";
import type { PreviewBundle } from "./state";
import type { ConflictChoice } from "../../../types/installDriver";

/**
 * `external-prompt-user` is the arm with NO default — the user must pick a
 * file or skip. `nexus-version-diverged` has one, so it never blocks.
 */
const bundleWith = (kinds: readonly string[]): PreviewBundle =>
  ({
    plan: {
      modResolutions: kinds.map((kind, i) => ({
        compareKey: `k${i}`,
        name: `Mod ${i}`,
        sourceKind: kind.startsWith("nexus") ? "nexus" : "external",
        decision: { kind, expectedFilename: "f.7z" },
      })),
      orphanedMods: [],
    },
  }) as unknown as PreviewBundle;

const pick = (): ConflictChoice =>
  ({ kind: "use-local-file", localPath: "C:/tmp/f.7z" }) as ConflictChoice;

describe("countUndecidedConflicts", () => {
  it("counts only conflicts with no safe default", () => {
    // Including defaulted ones would report two hundred items outstanding on a
    // collection where three actually need the user.
    const bundle = bundleWith([
      "external-prompt-user",
      "external-prompt-user",
      "nexus-version-diverged",
    ]);
    expect(countUndecidedConflicts(bundle, {})).toBe(2);
  });

  it("drops to zero as the user answers", () => {
    const bundle = bundleWith(["external-prompt-user", "external-prompt-user"]);
    expect(countUndecidedConflicts(bundle, { k0: pick() })).toBe(1);
    expect(countUndecidedConflicts(bundle, { k0: pick(), k1: pick() })).toBe(0);
  });

  it("is zero for a plan with nothing to resolve", () => {
    expect(countUndecidedConflicts(bundleWith([]), {})).toBe(0);
  });

  it("agrees with canProceedFromDecisions at every step", () => {
    // The invariant that matters: a non-zero count means blocked, and zero
    // means not. Either half disagreeing puts a number next to a button that
    // contradicts it.
    const bundle = bundleWith([
      "external-prompt-user",
      "nexus-version-diverged",
      "external-prompt-user",
    ]);
    const states: Record<string, ConflictChoice>[] = [
      {},
      { k0: pick() },
      { k0: pick(), k2: pick() },
      { k2: pick() },
    ];
    for (const choices of states) {
      const n = countUndecidedConflicts(bundle, choices);
      expect(canProceedFromDecisions(bundle, choices), JSON.stringify(choices)).toBe(
        n === 0,
      );
    }
  });
});
