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
