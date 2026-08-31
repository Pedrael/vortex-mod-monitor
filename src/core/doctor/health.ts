/**
 * ──────────────────────────────────────────────────────────────────────
 * Collection Doctor — is this collection still what we installed?
 *
 * ─── WHAT "HEALTHY" MEANS, EXACTLY ─────────────────────────────────────
 * Identical to the LAST INSTALL OF THIS COLLECTION, as recorded in its
 * receipt. Not identical to the curator's disk, and not identical to the
 * manifest — the receipt is the only artefact that describes a state this
 * machine actually reached, so it is the only fair thing to be measured
 * against. Anything else reports drift the user never caused.
 *
 * That is the same reference discipline the drift detector already uses, and
 * it is deliberate: a curator's staging folder can be quietly corrupt, and
 * measuring users against it would turn the curator's bad day into everyone's.
 *
 * ─── WHY THE SPLIT ─────────────────────────────────────────────────────
 * {@link evaluateHealth} is pure: receipt + observations in, verdicts out. All
 * the Vortex reads live in the caller. That is what lets every interesting
 * case — a mod deleted, a plugin order rewritten by LOOT, a profile that no
 * longer exists — be tested without a running Vortex, which is the difference
 * between believing this works and knowing it.
 *
 * ─── EVERY FINDING MUST NAME ITS CURE ──────────────────────────────────
 * A diagnosis the user cannot act on is just anxiety. Each check that can fail
 * carries the install-pipeline step that repairs it, so the UI never has to
 * guess and the user never has to reinstall 900 mods to fix a plugin order.
 * ──────────────────────────────────────────────────────────────────────
 */

/** Which aspect of the collection a check covers. */
import type { FomodReplayMode } from "../installer/fomodReplayMode";

export type HealthCheckId =
  | "profile"
  | "mods-present"
  | "mods-enabled"
  | "staging"
  | "plugin-order"
  | "mod-rules"
  | "userlist";

/**
 * Deliberately five states, not "pass/fail".
 *
 * `unknown` is load-bearing and must never be rendered as a pass: a receipt
 * written before a feature existed cannot tell us anything about it, and
 * "we did not check" is not "it is fine".
 */
export type HealthStatus =
  | "healthy"
  | "drifted"
  | "broken"
  | "unknown"
  | "not-applicable";

/** The install-pipeline step that repairs a given finding. */
export type HealAction =
  | "reinstall-mods"
  | "enable-mods"
  | "reapply-rules"
  | "reapply-userlist"
  | "repin-plugin-order"
  | "switch-profile";

export interface HealthCheck {
  id: HealthCheckId;
  /** Short label for the card. */
  title: string;
  status: HealthStatus;
  /** One line, written for a human who has not read any of this. */
  summary: string;
  /** Specifics — mod names, plugin names. Rendered as a list, may be long. */
  detail: string[];
  /** How many things are wrong, for a badge. 0 when healthy. */
  affectedCount: number;
  /** Absent when nothing can be done automatically. */
  heal?: { action: HealAction; label: string };
}

/** Everything the checks need, gathered from Vortex by the caller. */
export interface HealthObservations {
  /** Profile ids that currently exist for this game. */
  existingProfileIds: readonly string[];
  /** The profile Vortex is on right now, if any. */
  activeProfileId: string | undefined;
  /** Vortex mod ids currently installed for this game. */
  installedModIds: readonly string[];
  /** Vortex mod ids enabled in the receipt's profile. */
  enabledModIds: readonly string[];
  /**
   * Mods whose staging folder no longer matches what we installed, by
   * compareKey. Empty when nothing drifted; `undefined` when not checked
   * (the deep scan is opt-in because it hashes real bytes).
   */
  driftedCompareKeys: readonly string[] | undefined;
  /** Current plugins.txt order, or undefined when the game has none. */
  currentPluginOrder: readonly string[] | undefined;
  /** Mod rules currently set for this game, counted. */
  currentModRuleCount: number | undefined;
  /** LOOT userlist rules currently set, counted. */
  currentUserlistRuleCount: number | undefined;
}

/** The minimum of a receipt these checks read. */
export interface HealthReceiptView {
  packageName: string;
  packageVersion: string;
  vortexProfileId: string;
  mods: ReadonlyArray<{ vortexModId: string; compareKey: string; name: string }>;
  rulesApplication?: {
    appliedRuleCount?: number;
    baselinePluginOrder?: readonly string[];
  };
  userlistApplication?: { appliedRuleCount?: number };
  /**
   * How the curator's installer answers were replayed.
   *
   * `"supervised"` means the user could have changed them, which makes drift
   * ambiguous rather than wrong — see the staging check.
   */
  fomodReplayMode?: FomodReplayMode;
}

const MAX_DETAIL = 25;

/** Cap a list for display without pretending it is complete. */
function detailList(names: readonly string[]): string[] {
  if (names.length <= MAX_DETAIL) return [...names];
  return [
    ...names.slice(0, MAX_DETAIL),
    `…and ${names.length - MAX_DETAIL} more`,
  ];
}

/**
 * Compare two plugin orders, ignoring case.
 *
 * plugins.txt casing is not stable across machines or Vortex versions, so a
 * case-sensitive comparison reports drift on every single entry and makes the
 * check useless.
 */
function orderMatches(
  a: readonly string[],
  b: readonly string[],
): { same: boolean; firstDivergence?: number } {
  if (a.length !== b.length) return { same: false, firstDivergence: 0 };
  for (let i = 0; i < a.length; i += 1) {
    if ((a[i] ?? "").toLowerCase() !== (b[i] ?? "").toLowerCase()) {
      return { same: false, firstDivergence: i };
    }
  }
  return { same: true };
}

/**
 * Diagnose. Pure — every Vortex read happens in the caller.
 */
export function evaluateHealth(
  receipt: HealthReceiptView,
  obs: HealthObservations,
): HealthCheck[] {
  const checks: HealthCheck[] = [];

  // ── profile ──────────────────────────────────────────────────────────
  const profileGone = !obs.existingProfileIds.includes(receipt.vortexProfileId);
  checks.push({
    id: "profile",
    title: "Profile",
    status: profileGone
      ? "broken"
      : obs.activeProfileId === receipt.vortexProfileId
        ? "healthy"
        : "drifted",
    summary: profileGone
      ? "The profile this collection was installed into no longer exists."
      : obs.activeProfileId === receipt.vortexProfileId
        ? "You are on the profile this collection was installed into."
        : "The collection is installed, but you are on a different profile.",
    detail: profileGone ? [`Missing profile: ${receipt.vortexProfileId}`] : [],
    affectedCount: profileGone ? 1 : 0,
    // A profile that is gone cannot be recreated from a receipt — the mods
    // would have to be reinstalled — so only the survivable case offers a fix.
    ...(!profileGone && obs.activeProfileId !== receipt.vortexProfileId
      ? {
          heal: {
            action: "switch-profile" as const,
            label: "Switch to that profile",
          },
        }
      : {}),
  });

  // ── mods present ─────────────────────────────────────────────────────
  const installed = new Set(obs.installedModIds);
  const missing = receipt.mods.filter((m) => !installed.has(m.vortexModId));
  checks.push({
    id: "mods-present",
    title: "Mods installed",
    status: missing.length === 0 ? "healthy" : "broken",
    summary:
      missing.length === 0
        ? `All ${receipt.mods.length} mods are still installed.`
        : `${missing.length} of ${receipt.mods.length} mods are missing.`,
    detail: detailList(missing.map((m) => m.name)),
    affectedCount: missing.length,
    ...(missing.length > 0
      ? {
          heal: {
            action: "reinstall-mods" as const,
            label: `Reinstall ${missing.length} missing mod${missing.length === 1 ? "" : "s"}`,
          },
        }
      : {}),
  });

  // ── mods enabled ─────────────────────────────────────────────────────
  // Only meaningful for mods that are actually present; a missing mod being
  // disabled is the same finding twice.
  const enabled = new Set(obs.enabledModIds);
  const disabled = receipt.mods.filter(
    (m) => installed.has(m.vortexModId) && !enabled.has(m.vortexModId),
  );
  checks.push({
    id: "mods-enabled",
    title: "Mods enabled",
    status: disabled.length === 0 ? "healthy" : "drifted",
    summary:
      disabled.length === 0
        ? "Every installed mod is enabled in the profile."
        : `${disabled.length} installed mod${disabled.length === 1 ? " is" : "s are"} disabled.`,
    detail: detailList(disabled.map((m) => m.name)),
    affectedCount: disabled.length,
    ...(disabled.length > 0
      ? {
          heal: {
            action: "enable-mods" as const,
            label: `Enable ${disabled.length} mod${disabled.length === 1 ? "" : "s"}`,
          },
        }
      : {}),
  });

  // ── staging bytes ────────────────────────────────────────────────────
  if (obs.driftedCompareKeys === undefined) {
    checks.push({
      id: "staging",
      title: "Mod files",
      status: "unknown",
      summary: "Not checked — this one reads every file, so it runs on request.",
      detail: [],
      affectedCount: 0,
    });
  } else {
    const drifted = new Set(obs.driftedCompareKeys);
    const names = receipt.mods
      .filter((m) => drifted.has(m.compareKey))
      .map((m) => m.name);
    checks.push({
      id: "staging",
      title: "Mod files",
      status: names.length === 0 ? "healthy" : "drifted",
      summary:
        names.length === 0
          ? "Every mod's files are exactly as installed."
          : `${names.length} mod${names.length === 1 ? " has" : "s have"} changed on disk since installing.`,
      detail:
        names.length > 0 && receipt.fomodReplayMode === "supervised"
          ? [
              // The receipt records the RESULT, not the answers behind it, so
              // a deliberate deviation and a corrupted staging folder are
              // indistinguishable here. Reinstalling replays the CURATOR's
              // answers, which would undo the former. Say it before they
              // click, not after.
              "Note: you chose to review each installer on this install, so " +
                "some of these differences may be answers you changed on " +
                "purpose. Reinstalling restores the curator's answers.",
              ...detailList(names),
            ]
          : detailList(names),
      affectedCount: names.length,
      ...(names.length > 0
        ? {
            heal: {
              action: "reinstall-mods" as const,
              label: `Reinstall ${names.length} changed mod${names.length === 1 ? "" : "s"}`,
            },
          }
        : {}),
    });
  }

  // ── plugin order ─────────────────────────────────────────────────────
  const baseline = receipt.rulesApplication?.baselinePluginOrder;
  if (baseline === undefined || baseline.length === 0) {
    checks.push({
      id: "plugin-order",
      title: "Plugin order",
      status: "unknown",
      summary:
        "This install did not record a plugin order, so there is nothing to compare against.",
      detail: [],
      affectedCount: 0,
    });
  } else if (obs.currentPluginOrder === undefined) {
    checks.push({
      id: "plugin-order",
      title: "Plugin order",
      status: "not-applicable",
      summary: "This game does not use a plugins.txt.",
      detail: [],
      affectedCount: 0,
    });
  } else {
    const cmp = orderMatches(baseline, obs.currentPluginOrder);
    checks.push({
      id: "plugin-order",
      title: "Plugin order",
      status: cmp.same ? "healthy" : "drifted",
      summary: cmp.same
        ? `All ${baseline.length} plugins are in the order the curator had.`
        : baseline.length !== obs.currentPluginOrder.length
          ? `The order has ${obs.currentPluginOrder.length} plugins; the curator's had ${baseline.length}.`
          : `The order diverges from the curator's at position ${(cmp.firstDivergence ?? 0) + 1}.`,
      detail: cmp.same
        ? []
        : [
            `Curator: …${baseline
              .slice(Math.max(0, (cmp.firstDivergence ?? 0) - 1), (cmp.firstDivergence ?? 0) + 3)
              .join(", ")}…`,
            `Yours:   …${obs.currentPluginOrder
              .slice(Math.max(0, (cmp.firstDivergence ?? 0) - 1), (cmp.firstDivergence ?? 0) + 3)
              .join(", ")}…`,
          ],
      affectedCount: cmp.same ? 0 : 1,
      ...(cmp.same
        ? {}
        : {
            heal: {
              action: "repin-plugin-order" as const,
              label: "Restore the curator's plugin order",
            },
          }),
    });
  }

  // ── mod rules ────────────────────────────────────────────────────────
  const appliedRules = receipt.rulesApplication?.appliedRuleCount;
  checks.push(
    countCheck({
      id: "mod-rules",
      title: "Mod rules",
      applied: appliedRules,
      current: obs.currentModRuleCount,
      noun: "mod rule",
      healAction: "reapply-rules",
      healLabel: "Re-apply the collection's mod rules",
    }),
  );

  // ── userlist ─────────────────────────────────────────────────────────
  checks.push(
    countCheck({
      id: "userlist",
      title: "LOOT rules",
      applied: receipt.userlistApplication?.appliedRuleCount,
      current: obs.currentUserlistRuleCount,
      noun: "LOOT rule",
      healAction: "reapply-userlist",
      healLabel: "Re-apply the collection's LOOT rules",
    }),
  );

  return checks;
}

/**
 * Rules and userlist share a shape: a count we applied against a count that is
 * there now.
 *
 * Counting is a WEAK check and the wording says so rather than implying a
 * byte-level comparison. A rule swapped for a different rule keeps the count
 * identical, so this catches removal and addition, not substitution. Claiming
 * more than that would be the kind of false green this project keeps finding.
 */
function countCheck(args: {
  id: HealthCheckId;
  title: string;
  applied: number | undefined;
  current: number | undefined;
  noun: string;
  healAction: HealAction;
  healLabel: string;
}): HealthCheck {
  const { applied, current } = args;
  if (applied === undefined) {
    return {
      id: args.id,
      title: args.title,
      status: "unknown",
      summary: `This install did not record ${args.noun}s, so there is nothing to compare against.`,
      detail: [],
      affectedCount: 0,
    };
  }
  if (current === undefined) {
    return {
      id: args.id,
      title: args.title,
      status: "unknown",
      summary: `Could not read the current ${args.noun}s.`,
      detail: [],
      affectedCount: 0,
    };
  }
  if (current === applied) {
    return {
      id: args.id,
      title: args.title,
      status: "healthy",
      summary: `All ${applied} ${args.noun}s the collection applied are still set.`,
      detail: [],
      affectedCount: 0,
    };
  }
  const lost = applied - current;
  return {
    id: args.id,
    title: args.title,
    status: "drifted",
    summary:
      lost > 0
        ? `${lost} of ${applied} ${args.noun}s are gone.`
        : `${-lost} ${args.noun}s have been added since installing.`,
    detail: [
      `Applied at install: ${applied}`,
      `Set right now: ${current}`,
      "Counts only — a rule replaced by a different rule would look unchanged.",
    ],
    affectedCount: Math.abs(lost),
    heal: { action: args.healAction, label: args.healLabel },
  };
}

/** Roll the checks up into one verdict for the header. */
export function overallHealth(checks: readonly HealthCheck[]): {
  status: HealthStatus;
  headline: string;
  problems: number;
} {
  const problems = checks.filter(
    (c) => c.status === "broken" || c.status === "drifted",
  );
  if (problems.some((c) => c.status === "broken")) {
    return {
      status: "broken",
      headline: "This collection is not intact",
      problems: problems.length,
    };
  }
  if (problems.length > 0) {
    return {
      status: "drifted",
      headline: "Mostly intact, with drift",
      problems: problems.length,
    };
  }
  // "Everything we CHECKED is fine" — an unknown is not a pass, and saying so
  // is the difference between a health check and a reassurance machine.
  if (checks.some((c) => c.status === "unknown")) {
    return {
      status: "unknown",
      headline: "Healthy so far — some checks have not run",
      problems: 0,
    };
  }
  return {
    status: "healthy",
    headline: "Identical to the day it was installed",
    problems: 0,
  };
}

/**
 * Why healing must not run right now, or `undefined` when it may.
 *
 * Every heal action re-runs a step of the install pipeline, and those steps
 * mutate Vortex: they install mods, flip enabled state, clear and rewrite the
 * user's rules, rewrite the plugin order. Doing that WHILE the driver is doing
 * the same thing is how a collection gets corrupted in a way no verification
 * would catch afterwards, because both halves would look individually correct.
 *
 * Only the `installing` phase is mutating. Loading, previewing and choosing
 * are read-only, so blocking those would be superstition rather than safety.
 *
 * Deliberately fails to BLOCKED on an unrecognised shape: if we cannot tell
 * what the installer is doing, the safe answer is not to also start writing.
 */
export function healingBlockedReason(
  installState: { kind?: unknown } | undefined,
): string | undefined {
  if (installState === undefined) return undefined;
  const kind = installState.kind;
  if (typeof kind !== "string") {
    return "Cannot tell whether an install is running, so healing is paused.";
  }
  if (kind === "installing") {
    return (
      "An install is running right now. Healing re-runs steps of the same " +
      "pipeline, and two of them writing at once is how a collection gets " +
      "quietly corrupted — wait for it to finish."
    );
  }
  return undefined;
}
