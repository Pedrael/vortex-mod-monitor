/**
 * Rule application decides which mod wins a file conflict, so a rule landing
 * on the wrong mod is not a cosmetic error — it resolves conflicts in the
 * wrong direction and the collection looks like it simply does not work.
 */
import { describe, expect, it } from "vitest";

import { applyModRules } from "./applyModRules";

describe("ambiguous partial Nexus pins", () => {
  /**
   * The comment this replaces asserted that a profile holds at most one
   * fileId per Nexus modId, "so this is unambiguous in practice". Measured on
   * the curator's real 954-mod profile: 104 Nexus modIds are installed more
   * than once, one of them five times. Two variants of a mod — different FOMOD
   * answers, a patch kept alongside the base — is ordinary practice.
   *
   * Guessing there applies a conflict rule to the wrong variant, which
   * resolves file conflicts in the wrong direction: a wrong answer that looks
   * like the collection simply does not work, and that nobody would think to
   * look for. A reported skip is recoverable.
   */
  const rule = {
    type: "after" as const,
    source: "nexus:1:1",
    reference: "nexus:999",
  };

  const baseInput = () => ({
    api: { store: { dispatch: (): void => {} } } as never,
    gameId: "fallout4",
    rules: [rule] as never,
    modIdByCompareKey: new Map([["nexus:1:1", "local-source"]]),
    modIdByNexusModId: new Map([["999", "local-variant-b"]]),
  });

  it("skips rather than guessing when several variants are installed", () => {
    const out = applyModRules({
      ...baseInput(),
      ambiguousNexusModIds: new Set(["999"]),
    } as never);
    expect(out.applied).toBe(0);
    expect(out.skipped).toHaveLength(1);
    expect(out.skipped[0]?.reason).toMatch(/more than one installed mod/);
    // The reason has to distinguish this from "not installed" — the fixes are
    // opposite, and one message for both sends the curator hunting a mod that
    // is actually present twice.
    expect(out.skipped[0]?.reason).toMatch(/999/);
  });

  it("still resolves a partial pin when there is exactly one candidate", () => {
    const out = applyModRules(baseInput() as never);
    expect(out.applied).toBe(1);
    expect(out.skipped).toEqual([]);
  });

  it("treats an absent ambiguity set as no known ambiguity", () => {
    // Callers that predate this must keep working unchanged.
    const out = applyModRules({
      ...baseInput(),
      ambiguousNexusModIds: undefined,
    } as never);
    expect(out.applied).toBe(1);
  });

  it("says 'not installed' when that is the actual problem", () => {
    const out = applyModRules({
      ...baseInput(),
      modIdByNexusModId: new Map(),
    } as never);
    expect(out.skipped[0]?.reason).toMatch(/did not match any installed mod/);
  });
});
