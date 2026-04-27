/**
 * Install ledger — on-disk receipt schema (Phase 3 slice 5b).
 *
 * The ledger is the SINGLE source of truth for "did Event Horizon
 * install this collection on this machine, and which mods did it put
 * there?" Receipts live at:
 *
 *   <appData>/Vortex/event-horizon/installs/<package.id>.json
 *
 * One file per collection package id. Re-installs of the same
 * `package.id` (any version) overwrite the file — only the most
 * recent install of a given collection is tracked.
 *
 * The receipt is the input the action handler reads to populate
 * `UserSideState.previousInstall` and to tag
 * `UserSideState.installedMods[].eventHorizonInstall`. The install
 * driver writes it after a successful install completes.
 *
 * Specs:
 *  - business behavior:  docs/business/INSTALL_LEDGER.md
 *  - lineage policy:     docs/business/INSTALL_PLAN_SCHEMA.md
 *  - design rationale:   docs/PROPOSAL_INSTALLER.md "decision log" entry
 *                        2026-04-27 ("Cross-release lineage via install
 *                        ledger, not Vortex attributes")
 *
 * INVARIANTS:
 *  - This file is type-only. No runtime code. The runtime CRUD lives
 *    in `src/core/installLedger.ts`.
 *  - `packageId` is the manifest's `package.id` at install time.
 *  - `installedAt` is ISO-8601 UTC.
 *  - All `compareKey` strings on `mods[]` mirror what
 *    `manifest.mods[i].compareKey` was at install time. They are the
 *    only authority the resolver uses for orphan detection.
 *  - We NEVER trust Vortex mod attributes for lineage; the receipt is
 *    the only source.
 *  - Schema is additive: future v1.x revisions add fields, never
 *    rename or remove. Breaking changes bump
 *    {@link InstallLedgerSchemaVersion}.
 */

import type { SupportedGameId } from "./ehcoll";

/**
 * Schema version. Bumped only on breaking changes; additive field
 * changes leave this at 1.
 */
export const INSTALL_LEDGER_SCHEMA_VERSION = 1 as const;
export type InstallLedgerSchemaVersion =
  typeof INSTALL_LEDGER_SCHEMA_VERSION;

/**
 * The full on-disk shape. Written by the install driver, read by the
 * userState builder.
 */
export type InstallReceipt = {
  schemaVersion: InstallLedgerSchemaVersion;
  /** Mirrors `manifest.package.id` at install time. UUIDv4. */
  packageId: string;
  /** Mirrors `manifest.package.version` at install time. Semver. */
  packageVersion: string;
  /** Mirrors `manifest.package.name` at install time. UI-only. */
  packageName: string;
  /** Mirrors `manifest.game.id` at install time. */
  gameId: SupportedGameId;
  /** ISO-8601 UTC of when the install completed. */
  installedAt: string;
  /**
   * The Vortex profile id the install lives in. For `current-profile`
   * mode this is the user's active profile at install time; for
   * `fresh-profile` mode it's the new profile the driver created.
   */
  vortexProfileId: string;
  /** UI-only display name of the profile. */
  vortexProfileName: string;
  /**
   * Which mode the driver used. Surfaced for the eventual UI's
   * "installed collections" view ("this collection lives in profile X
   * because we created it for the install").
   */
  installTargetMode: InstallTargetMode;
  /**
   * Per-mod install records. One entry per mod the driver put on
   * disk for this collection release. The list is the resolver's
   * orphan-detection key set.
   */
  mods: InstallReceiptMod[];
  /**
   * Slice 6c — Mod rule + LoadOrder application summary.
   *
   * Optional and additive: receipts written before slice 6c shipped
   * will not have it. Consumers must default to a zero-value record
   * when missing. Used by the post-install summary screen and as a
   * provenance trail when the user later asks "did the collection's
   * rules actually get applied on my machine?"
   */
  rulesApplication?: RulesApplicationReceipt;
  /**
   * Slice 6d — LOOT userlist application summary.
   *
   * Optional and additive: receipts written before slice 6d shipped
   * will not have it. Consumers must default to a zero-value record
   * when missing. The values mirror the
   * `ApplyUserlistResult` returned by `applyUserlist`, with
   * `skippedUserlistEntries` carrying verbose actionable reasons
   * (Vortex's reducer ignored our dispatch, action contract changed,
   * etc.) so the user (and our error reports) can audit which rules
   * landed.
   *
   * Plugin rules are dispatched additively (the reducer dedupes, see
   * `applyUserlist.ts`'s "Conflict policy" header), so this struct
   * does NOT carry an `overwrittenUserlistRuleCount`. The only
   * collection-wins overwrites are at the plugin-group level —
   * tracked separately as `overwrittenGroupAssignmentCount`.
   */
  userlistApplication?: UserlistApplicationReceipt;
};

/**
 * On-disk summary of what `applyModRules` + `applyLoadOrder` did. The
 * driver writes this at receipt time; the post-install summary surfaces
 * it. None of the fields drive future-release resolution — they exist
 * purely so the user (and our error reports) can audit slice 6c
 * outcomes after the fact.
 *
 * INVARIANT: this struct describes the *attempted* application, not
 * the current Vortex state. Re-running LOOT or the user dragging
 * plugins around in Vortex's UI does NOT update the receipt; the
 * receipt is a write-once record of what we dispatched.
 */
export type RulesApplicationReceipt = {
  /** Mod rules from the manifest the driver successfully dispatched. */
  appliedRuleCount: number;
  /**
   * Pre-existing user rules the driver removed because of the
   * collection-wins conflict policy. UI-only; surfaced so the user
   * understands why their custom rules may have changed.
   */
  overwrittenUserRuleCount: number;
  /**
   * Rules the driver could not apply (unresolvable compareKey,
   * curator-ignored, Vortex rejected dispatch). Each carries a
   * short reason for the post-install report.
   */
  skippedRules: ReceiptSkippedRule[];
  /** LoadOrder entries the driver successfully dispatched. */
  appliedLoadOrderCount: number;
  /** LoadOrder entries the driver dropped (unresolved compareKey). */
  skippedLoadOrderEntries: ReceiptSkippedLoadOrderEntry[];
  /**
   * Snapshot of the plugins.txt order we wrote at install time.
   * Used for the drift-detection helper that surfaces "your current
   * plugin order does not match what this collection installed" in
   * the post-install summary. Empty when the install was current-
   * profile-mode and we did not write plugins.txt, or when the game
   * does not use plugins.txt.
   */
  baselinePluginOrder: ReceiptPluginEntry[];
};

/**
 * On-disk summary of what `applyUserlist` did. Same audit-trail role
 * as `RulesApplicationReceipt` but for the LOOT userlist (plugin-to-
 * plugin rules + groups).
 *
 * Same write-once invariant: this struct describes the dispatches we
 * issued at install time, not the current state. Subsequent user
 * edits to userlist (drag-drop in Plugins tab, manual `userlist.yaml`
 * edits, etc.) do NOT update this record.
 */
export type UserlistApplicationReceipt = {
  /** ADD_USERLIST_RULE dispatches we verified landed in state. */
  appliedRuleCount: number;
  /** SET_PLUGIN_GROUP dispatches we verified landed in state. */
  appliedGroupAssignmentCount: number;
  /**
   * SET_PLUGIN_GROUP dispatches that overwrote a different
   * pre-existing user group assignment for the same plugin. Subset
   * of `appliedGroupAssignmentCount` (not in addition to it).
   */
  overwrittenGroupAssignmentCount: number;
  /** ADD_PLUGIN_GROUP dispatches that created a new group. */
  appliedNewGroupCount: number;
  /** ADD_GROUP_RULE dispatches we verified landed in state. */
  appliedGroupRuleCount: number;
  /**
   * Manifest userlist entries we couldn't apply, with a verbose
   * actionable reason. See `SkippedUserlistEntry` in
   * `applyUserlist.ts` for shape semantics.
   */
  skippedUserlistEntries: ReceiptSkippedUserlistEntry[];
};

export type ReceiptSkippedUserlistEntry = {
  /** What kind of manifest entry we were trying to apply. */
  kind:
    | "plugin-rule"
    | "plugin-group"
    | "group-definition"
    | "group-rule";
  /** Human-readable identifier (plugin or group name). */
  subject: string;
  /** Optional: rule kind for plugin rules. */
  ruleKind?: "after" | "req" | "inc";
  /** Optional: reference (other plugin / other group) for plugin and group rules. */
  reference?: string;
  /** Verbose actionable explanation. */
  reason: string;
};

export type ReceiptSkippedRule = {
  ruleType: string;
  source: string;
  reference: string;
  reason: string;
};

export type ReceiptSkippedLoadOrderEntry = {
  compareKey: string;
  pos: number;
  reason: string;
};

export type ReceiptPluginEntry = {
  name: string;
  enabled: boolean;
};

export type InstallTargetMode = "current-profile" | "fresh-profile";

/**
 * A single mod the driver installed (or marked as already-installed
 * and re-used) as part of this collection release.
 *
 * The shape is deliberately narrow — only what the resolver and the
 * eventual UI need. The full mod state lives on the Vortex side; the
 * receipt only carries the lineage tag.
 */
export type InstallReceiptMod = {
  /**
   * Vortex's internal mod id at install time. Stable per-machine;
   * the resolver uses this to find the matching `InstalledMod` in
   * Vortex state.
   */
  vortexModId: string;
  /**
   * The `compareKey` the manifest used at install time. The resolver
   * cross-checks this against the new manifest's compareKeys to
   * detect orphans.
   */
  compareKey: string;
  /** Mirrors `manifest.mods[i].source.kind`. UI-only. */
  source: "nexus" | "external";
  /** UI-only snapshot of the mod's display name at install time. */
  name: string;
  /** ISO-8601 UTC of when this specific mod was installed. */
  installedAt: string;
};
