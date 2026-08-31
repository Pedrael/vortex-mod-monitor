/**
 * The doctor's diagnosis, tested without a running Vortex — which is the whole
 * reason evaluateHealth is pure.
 *
 * The properties that matter are about honesty:
 *   - "unknown" is never rolled up as a pass
 *   - a weak check says it is weak rather than implying more
 *   - every failure names the pipeline step that repairs it
 */
import { describe, expect, it } from "vitest";

import {
  evaluateHealth,
  healingBlockedReason,
  overallHealth,
  type HealthObservations,
  type HealthReceiptView,
} from "./health";

const receipt = (over: Partial<HealthReceiptView> = {}): HealthReceiptView => ({
  packageName: "Ivy 2",
  packageVersion: "1.0.10",
  vortexProfileId: "prof-1",
  mods: [
    { vortexModId: "m1", compareKey: "nexus:1:1", name: "Alpha" },
    { vortexModId: "m2", compareKey: "nexus:2:2", name: "Beta" },
    { vortexModId: "m3", compareKey: "nexus:3:3", name: "Gamma" },
  ],
  rulesApplication: {
    appliedRuleCount: 291,
    baselinePluginOrder: ["a.esp", "b.esp", "c.esp"],
  },
  userlistApplication: { appliedRuleCount: 29 },
  ...over,
});

const healthy = (over: Partial<HealthObservations> = {}): HealthObservations => ({
  existingProfileIds: ["prof-1"],
  activeProfileId: "prof-1",
  installedModIds: ["m1", "m2", "m3"],
  enabledModIds: ["m1", "m2", "m3"],
  driftedCompareKeys: [],
  currentPluginOrder: ["a.esp", "b.esp", "c.esp"],
  currentModRuleCount: 291,
  currentUserlistRuleCount: 29,
  ...over,
});

const byId = (checks: ReturnType<typeof evaluateHealth>, id: string) =>
  checks.find((c) => c.id === id)!;

describe("evaluateHealth", () => {
  it("reports a fully intact collection as healthy", () => {
    const checks = evaluateHealth(receipt(), healthy());
    expect(checks.every((c) => c.status === "healthy")).toBe(true);
    expect(overallHealth(checks).status).toBe("healthy");
  });

  it("calls missing mods broken, and offers to reinstall exactly those", () => {
    const checks = evaluateHealth(
      receipt(),
      healthy({ installedModIds: ["m1"] }),
    );
    const c = byId(checks, "mods-present");
    expect(c.status).toBe("broken");
    expect(c.affectedCount).toBe(2);
    expect(c.detail).toEqual(["Beta", "Gamma"]);
    expect(c.heal?.action).toBe("reinstall-mods");
    expect(overallHealth(checks).status).toBe("broken");
  });

  it("does not report a missing mod as also disabled", () => {
    // Same fact twice reads as two problems and inflates the count.
    const checks = evaluateHealth(
      receipt(),
      healthy({ installedModIds: ["m1"], enabledModIds: ["m1"] }),
    );
    expect(byId(checks, "mods-enabled").status).toBe("healthy");
    expect(byId(checks, "mods-enabled").affectedCount).toBe(0);
  });

  it("treats a disabled mod as drift, not breakage", () => {
    const checks = evaluateHealth(
      receipt(),
      healthy({ enabledModIds: ["m1", "m2"] }),
    );
    const c = byId(checks, "mods-enabled");
    expect(c.status).toBe("drifted");
    expect(c.heal?.action).toBe("enable-mods");
    expect(overallHealth(checks).status).toBe("drifted");
  });

  it("ignores plugin-order casing, which is not stable across machines", () => {
    const checks = evaluateHealth(
      receipt(),
      healthy({ currentPluginOrder: ["A.esp", "B.ESP", "c.esp"] }),
    );
    // Case-sensitive comparison would report drift on every entry and make
    // this check useless.
    expect(byId(checks, "plugin-order").status).toBe("healthy");
  });

  it("names where the plugin order first diverges", () => {
    const checks = evaluateHealth(
      receipt(),
      healthy({ currentPluginOrder: ["a.esp", "c.esp", "b.esp"] }),
    );
    const c = byId(checks, "plugin-order");
    expect(c.status).toBe("drifted");
    expect(c.summary).toMatch(/position 2/);
    expect(c.heal?.action).toBe("repin-plugin-order");
  });

  it("says a rule count check is only a count", () => {
    // A rule swapped for a different rule keeps the count identical. Claiming
    // more than this can detect is the false-green pattern.
    const checks = evaluateHealth(
      receipt(),
      healthy({ currentModRuleCount: 280 }),
    );
    const c = byId(checks, "mod-rules");
    expect(c.status).toBe("drifted");
    expect(c.summary).toMatch(/11 of 291/);
    expect(c.detail.join(" ")).toMatch(/Counts only/);
  });

  it("reports a vanished profile as broken with no automatic cure", () => {
    const checks = evaluateHealth(
      receipt(),
      healthy({ existingProfileIds: [], activeProfileId: undefined }),
    );
    const c = byId(checks, "profile");
    expect(c.status).toBe("broken");
    // A receipt cannot recreate a profile's mods, so offering a button would
    // be a lie.
    expect(c.heal).toBeUndefined();
  });

  it("offers to switch when the collection is fine but you are elsewhere", () => {
    const checks = evaluateHealth(
      receipt(),
      healthy({ activeProfileId: "other" }),
    );
    const c = byId(checks, "profile");
    expect(c.status).toBe("drifted");
    expect(c.heal?.action).toBe("switch-profile");
  });

  it("marks an unrun deep scan unknown, never healthy", () => {
    const checks = evaluateHealth(
      receipt(),
      healthy({ driftedCompareKeys: undefined }),
    );
    expect(byId(checks, "staging").status).toBe("unknown");
  });

  it("marks a pre-feature receipt unknown rather than passing it", () => {
    const checks = evaluateHealth(
      receipt({ rulesApplication: undefined, userlistApplication: undefined }),
      healthy(),
    );
    expect(byId(checks, "mod-rules").status).toBe("unknown");
    expect(byId(checks, "userlist").status).toBe("unknown");
    expect(byId(checks, "plugin-order").status).toBe("unknown");
  });

  it("truncates a long list without pretending it is complete", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      vortexModId: `m${i}`,
      compareKey: `k${i}`,
      name: `Mod ${i}`,
    }));
    const checks = evaluateHealth(
      receipt({ mods: many }),
      healthy({ installedModIds: [], enabledModIds: [] }),
    );
    const c = byId(checks, "mods-present");
    expect(c.detail).toHaveLength(26);
    expect(c.detail[25]).toMatch(/and 15 more/);
    // The COUNT stays true even though the list is cut.
    expect(c.affectedCount).toBe(40);
  });
});

describe("overallHealth", () => {
  it("never reports 'all good' while a check has not run", () => {
    // The whole point of the five-state model: unknown is not a pass.
    const checks = evaluateHealth(
      receipt(),
      healthy({ driftedCompareKeys: undefined }),
    );
    const overall = overallHealth(checks);
    expect(overall.status).toBe("unknown");
    expect(overall.headline).toMatch(/have not run/);
  });

  it("lets broken outrank drifted", () => {
    const checks = evaluateHealth(
      receipt(),
      healthy({ installedModIds: ["m1"], enabledModIds: ["m1"], currentModRuleCount: 1 }),
    );
    expect(overallHealth(checks).status).toBe("broken");
    expect(overallHealth(checks).problems).toBeGreaterThan(1);
  });
});

describe("healingBlockedReason", () => {
  it("blocks while the driver is installing", () => {
    // Every heal re-runs a pipeline step that mutates Vortex. Two of them
    // writing at once corrupts a collection in a way neither half's own
    // verification would catch, because each looks individually correct.
    const why = healingBlockedReason({ kind: "installing" });
    expect(why).toBeDefined();
    expect(why).toMatch(/install is running/i);
  });

  it("allows healing during read-only phases", () => {
    // Blocking these would be superstition: nothing is being written.
    for (const kind of ["pick", "loading", "preview", "decisions", "confirm", "done"]) {
      expect(healingBlockedReason({ kind })).toBeUndefined();
    }
  });

  it("allows healing when there is no install session at all", () => {
    expect(healingBlockedReason(undefined)).toBeUndefined();
  });

  it("blocks when it cannot tell, rather than assuming safety", () => {
    // If we do not know what the installer is doing, the safe answer is not to
    // also start writing.
    expect(healingBlockedReason({} as { kind?: unknown })).toBeDefined();
    expect(healingBlockedReason({ kind: 42 } as { kind?: unknown })).toBeDefined();
  });
});

describe("a supervised install makes drift ambiguous", () => {
  // The Doctor diagnoses against the receipt but repairs from the collection.
  // Those two references agree perfectly until the user changes an installer
  // answer on purpose — and then "reinstall" quietly restores the curator's.
  // The user was warned at install time; they are warned again at the moment
  // it would actually happen.
  const drifted = () => healthy({ driftedCompareKeys: ["nexus:1:1"] });

  it("says a difference may be deliberate when the user drove the installers", () => {
    const checks = evaluateHealth(
      receipt({ fomodReplayMode: "supervised" }),
      drifted(),
    );
    const staging = byId(checks, "staging");
    expect(staging.detail.join(" ").toLowerCase()).toContain("on purpose");
    expect(staging.detail.join(" ").toLowerCase()).toContain("curator");
  });

  it("still offers the repair rather than hiding it behind the caveat", () => {
    // A caveat is not a reason to withhold the fix. Most drift after a
    // supervised install is still ordinary drift.
    const checks = evaluateHealth(
      receipt({ fomodReplayMode: "supervised" }),
      drifted(),
    );
    expect(byId(checks, "staging").heal?.action).toBe("reinstall-mods");
  });

  it("says nothing of the sort after a silent install", () => {
    // Nothing could have deviated, so the note would be noise — and worse,
    // it would suggest the user's own change caused corruption they did not
    // cause.
    const checks = evaluateHealth(
      receipt({ fomodReplayMode: "silent" }),
      drifted(),
    );
    expect(byId(checks, "staging").detail.join(" ")).not.toContain("on purpose");
  });

  it("says nothing of the sort on an old receipt that never recorded it", () => {
    // Absent means "not recorded", not "supervised". Guessing would put a
    // speculative excuse on real corruption.
    const checks = evaluateHealth(receipt(), drifted());
    expect(byId(checks, "staging").detail.join(" ")).not.toContain("on purpose");
  });

  it("keeps the drifted mod names, caveat or not", () => {
    // The caveat is prepended to the list. Prepending must not replace it.
    const checks = evaluateHealth(
      receipt({ fomodReplayMode: "supervised" }),
      drifted(),
    );
    expect(byId(checks, "staging").detail).toContain("Alpha");
    expect(byId(checks, "staging").affectedCount).toBe(1);
  });
});
