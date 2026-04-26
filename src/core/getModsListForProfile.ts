import { selectors } from "vortex-api";
import type { types } from "vortex-api";

export type FomodSelectedChoice = {
  name: string;
  idx?: number;
};

export type FomodSelectionGroup = {
  name: string;
  choices: FomodSelectedChoice[];
};

export type FomodSelectionStep = {
  name: string;
  groups: FomodSelectionGroup[];
};

export type AuditorMod = {
  id: string;
  name: string;
  version?: string;
  enabled: boolean;
  source?: string;
  nexusModId?: number | string;
  nexusFileId?: number | string;
  archiveId?: string;
  collectionIds?: string[];

  installerType?: string;
  hasInstallerChoices: boolean;
  hasDetailedInstallerChoices: boolean;

  /**
   * FOMOD selected options grouped by installer step/page.
   *
   * Example:
   * [
   *   {
   *     name: "Animations Support",
   *     groups: [
   *       {
   *         name: "Select Your Anims",
   *         choices: [
   *           { name: "Atomic Lust", idx: 1 },
   *           { name: "BP70 Animation Pack", idx: 2 }
   *         ]
   *       }
   *     ]
   *   }
   * ]
   */
  fomodSelections: FomodSelectionStep[];
};

export function getActiveGameId(state: types.IState): string | undefined {
  const id = selectors.activeGameId(state);
  return id?.length ? id : undefined;
}

export function getActiveProfileId(state: types.IState): string | undefined {
  const gameId = getActiveGameId(state);

  if (!gameId) {
    return undefined;
  }

  return getActiveProfileIdFromState(state, gameId);
}

export function getActiveProfileIdFromState(
  state: types.IState | any,
  gameId: string,
): string | undefined {
  const profiles = state?.persistent?.profiles ?? {};

  for (const [profileId, profile] of Object.entries(profiles)) {
    const p = profile as any;

    if (p?.gameId === gameId && p?.active === true) {
      return profileId;
    }
  }

  for (const [profileId, profile] of Object.entries(profiles)) {
    const p = profile as any;

    if (p?.gameId === gameId) {
      return profileId;
    }
  }

  return undefined;
}

function pickInstallerChoices(attributes: Record<string, unknown>): any {
  return (
    attributes.installerChoices ??
    attributes.installerChoicesData ??
    attributes.fomodChoices ??
    attributes.fomod ??
    attributes.choices ??
    attributes.installChoices ??
    attributes.installerOptions ??
    undefined
  );
}

function normalizeCollectionIds(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map(String);
  }

  return [String(value)];
}

function normalizeFomodSelections(installerChoices: any): FomodSelectionStep[] {
  const options = installerChoices?.options;

  if (!Array.isArray(options)) {
    return [];
  }

  return options.map((step: any): FomodSelectionStep => {
    const groups = Array.isArray(step?.groups) ? step.groups : [];

    return {
      name: String(step?.name ?? ""),
      groups: groups.map((group: any): FomodSelectionGroup => {
        const choices = Array.isArray(group?.choices) ? group.choices : [];

        return {
          name: String(group?.name ?? ""),
          choices: choices.map((choice: any): FomodSelectedChoice => {
            const normalizedChoice: FomodSelectedChoice = {
              name: String(choice?.name ?? ""),
            };

            if (choice?.idx !== undefined && choice?.idx !== null) {
              normalizedChoice.idx = Number(choice.idx);
            }

            return normalizedChoice;
          }),
        };
      }),
    };
  });
}

function hasAnySelectedFomodChoices(steps: FomodSelectionStep[]): boolean {
  return steps.some((step) =>
    step.groups.some((group) => group.choices.length > 0),
  );
}

export function getModsForProfile(
  state: types.IState,
  gameId: string,
  profileId: string,
): AuditorMod[] {
  const modsByGame = (state as any)?.persistent?.mods?.[gameId] ?? {};
  const profile = (state as any)?.persistent?.profiles?.[profileId];

  const enabledMods = profile?.modState ?? {};

  return Object.entries(modsByGame).map(([modId, rawMod]) => {
    const mod = rawMod as any;
    const attributes = (mod?.attributes ?? {}) as Record<string, unknown>;

    const installerChoices = pickInstallerChoices(attributes);
    const fomodSelections = normalizeFomodSelections(installerChoices);

    const rawCollectionIds =
      attributes.collectionIds ??
      attributes.collections ??
      attributes.collection;

    return {
      id: modId,
      name: String(attributes.name ?? mod?.id ?? modId),
      version:
        attributes.version !== undefined
          ? String(attributes.version)
          : undefined,
      enabled: enabledMods?.[modId]?.enabled === true,
      source:
        attributes.source !== undefined ? String(attributes.source) : undefined,
      nexusModId:
        (attributes.modId as string | number | undefined) ??
        (attributes.nexusId as string | number | undefined),
      nexusFileId: attributes.fileId as string | number | undefined,
      archiveId: mod?.archiveId,
      collectionIds: normalizeCollectionIds(rawCollectionIds),

      installerType:
        installerChoices?.type !== undefined
          ? String(installerChoices.type)
          : undefined,
      hasInstallerChoices: installerChoices !== undefined,
      hasDetailedInstallerChoices: hasAnySelectedFomodChoices(fomodSelections),
      fomodSelections,
    };
  });
}
