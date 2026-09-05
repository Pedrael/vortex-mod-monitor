/**
 * ──────────────────────────────────────────────────────────────────────
 * Reinstall a mod from the archive it came from, and put back what was on it.
 *
 * The repair for what bulk update's verification finds. A mod that lost files
 * during install has a folder Vortex wrote wrongly; the archive is intact and
 * reinstalling from it is the fix. It is also what a curator wants after any
 * edit they regret — the only way back to "exactly what the author shipped".
 *
 * ─── REINSTALLING IS DESTRUCTIVE, SO WHAT IT DESTROYS IS READ FIRST ────
 * Vortex's uninstall removes the mod entry, and the mod's `attributes` go with
 * it: its FOMOD answers, its modType, its enabled state, and the freeze this
 * project stores there. Reading them AFTER the uninstall reads nothing, and
 * the mod would come back as a default install of the same archive — silently
 * different from what the curator had, which is the exact failure this whole
 * project exists to prevent.
 *
 * So everything is captured up front, and restored afterwards.
 *
 * ─── AND THE FOMOD ANSWERS ARE THE PART THAT CANNOT BE GUESSED ─────────
 * Vortex records `attributes.installerChoices` verbatim, and passing them back
 * makes the reinstall unattended and identical. Without them a mod with a
 * branching installer either stops and asks — in the middle of a batch of
 * forty — or silently takes the defaults, which is a different mod wearing the
 * same name.
 *
 * A mod with no archive on disk is refused rather than uninstalled. Removing
 * something we cannot then put back is not a repair.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { types } from "@nexusmods/vortex-api";

/** The pieces of a mod that do not survive an uninstall. */
export type PreservedModState = {
  archiveId: string;
  /** Vortex's own recorded FOMOD answers, passed straight back. */
  installerChoices?: unknown;
  /** Empty string is Vortex's default type. */
  modType: string;
  enabled: boolean;
  /** Our freeze marker, if the curator set one. */
  frozenAtVersion?: string;
};

export class CannotReinstall extends Error {}

/**
 * Read everything that must outlive the uninstall.
 *
 * Pure apart from the state read, and separate from the doing so the ordering
 * — capture, then destroy — is visible rather than implied.
 */
export function captureForReinstall(
  state: types.IState,
  gameId: string,
  vortexModId: string,
  enabledModIds: ReadonlySet<string>,
  frozenAttribute: string,
): PreservedModState {
  const mod = (
    state as unknown as {
      persistent?: {
        mods?: Record<
          string,
          Record<string, { archiveId?: string; type?: string; attributes?: Record<string, unknown> }>
        >;
      };
    }
  )?.persistent?.mods?.[gameId]?.[vortexModId];

  if (mod === undefined) {
    throw new CannotReinstall(`Vortex has no mod "${vortexModId}" for ${gameId}`);
  }
  if (typeof mod.archiveId !== "string" || mod.archiveId === "") {
    // Without the archive there is nothing to reinstall FROM, and uninstalling
    // first would destroy the only copy.
    throw new CannotReinstall(
      "Vortex has no download recorded for this mod, so it cannot be " +
        "reinstalled — re-download it first",
    );
  }

  const attributes = mod.attributes ?? {};
  const frozen = attributes[frozenAttribute];
  return {
    archiveId: mod.archiveId,
    ...(attributes.installerChoices !== undefined
      ? { installerChoices: attributes.installerChoices }
      : {}),
    modType: typeof mod.type === "string" ? mod.type : "",
    enabled: enabledModIds.has(vortexModId),
    ...(typeof frozen === "string" && frozen !== ""
      ? { frozenAtVersion: frozen }
      : {}),
  };
}

/**
 * What has to be put back on the new mod, given what the old one had.
 *
 * Returned as data rather than dispatched so the decision is testable and the
 * Vortex calls stay at the edge. Only differences are listed: re-setting a
 * modType that is already right dispatches an action for nothing, and on a
 * batch of forty that is forty pointless state writes.
 */
export function restorationFor(
  preserved: PreservedModState,
  fresh: { modType: string },
): {
  setModType?: string;
  setFrozenAtVersion?: string;
  enable: boolean;
} {
  return {
    ...(preserved.modType !== fresh.modType
      ? { setModType: preserved.modType }
      : {}),
    ...(preserved.frozenAtVersion !== undefined
      ? { setFrozenAtVersion: preserved.frozenAtVersion }
      : {}),
    // Always stated. A reinstalled mod arrives disabled in the profile, so
    // "it was enabled" has to be acted on rather than assumed unchanged.
    enable: preserved.enabled,
  };
}

/** The install arguments that reproduce the curator's original answers. */
export function reinstallArgs(preserved: PreservedModState): {
  archiveId: string;
  choices?: unknown;
  unattended?: boolean;
} {
  if (preserved.installerChoices === undefined) {
    return { archiveId: preserved.archiveId };
  }
  // Unattended: a batch that stops to ask on mod eleven of forty is a batch
  // the curator has to babysit, and the answers are already known.
  return {
    archiveId: preserved.archiveId,
    choices: preserved.installerChoices,
    unattended: true,
  };
}
