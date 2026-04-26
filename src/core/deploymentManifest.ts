import { util } from "vortex-api";
import type { types } from "vortex-api";

/**
 * One entry in our captured deployment manifest. Strips Vortex's local
 * absolute paths (staging/target) so the snapshot is portable across
 * machines; we keep only what the future installer needs to plan
 * reconciliation: the relative path, who won deployment, and any merge
 * sources.
 */
export type CapturedDeploymentEntry = {
  /** Path relative to the deployment target (the game's data/mods dir). */
  relPath: string;
  /** Source mod that won deployment for this file (Vortex mod folder name). */
  source: string;
  /** When set, this file was synthesized by merging multiple mods. */
  merged?: string[];
  /**
   * Output sub-directory within the deployment target. Empty/undefined for
   * games where Vortex deploys all mods to the same directory.
   */
  target?: string;
};

/**
 * Per-modtype deployment manifest captured at export time.
 *
 * Mirrors `IDeploymentManifest` minus the absolute paths (`stagingPath`,
 * `targetPath`) and the Vortex instance UUID. `entryCount` is redundant
 * with `files.length` but cheap and convenient for diff summaries.
 */
export type CapturedDeploymentManifest = {
  /**
   * The modtype this manifest covers. Empty string is the default modtype.
   * Examples: "" (default), "collection", "dinput", "enb".
   */
  modType: string;
  /** "hardlink" / "symlink" / "move" — captured for reconciler hint. */
  deploymentMethod?: string;
  /** Unix-millis timestamp from Vortex's manifest. Informational only. */
  deploymentTime?: number;
  /** files.length, for cheap diff summaries. */
  entryCount: number;
  /** Sorted by relPath for stable cross-machine diffs. */
  files: CapturedDeploymentEntry[];
};

/**
 * Walk Vortex state and return the set of distinct mod-type strings present
 * for the given game. Always includes `""` (default modtype) so we capture
 * the primary deployment manifest even when no mods declare a non-default
 * type.
 */
export function collectDistinctModTypes(
  state: types.IState,
  gameId: string,
): string[] {
  const modsByGame = (state as any)?.persistent?.mods?.[gameId] ?? {};
  const types = new Set<string>([""]);

  for (const mod of Object.values(modsByGame)) {
    const t = (mod as any)?.type;
    if (typeof t === "string") {
      types.add(t);
    }
  }

  return Array.from(types).sort();
}

/**
 * Normalize one Vortex `IDeploymentManifest` into our portable shape.
 */
function normalizeManifest(
  modType: string,
  manifest: any,
): CapturedDeploymentManifest {
  const rawFiles = Array.isArray(manifest?.files) ? manifest.files : [];

  const files: CapturedDeploymentEntry[] = [];

  for (const f of rawFiles) {
    if (!f || typeof f.relPath !== "string" || typeof f.source !== "string") {
      continue;
    }

    const entry: CapturedDeploymentEntry = {
      relPath: f.relPath,
      source: f.source,
    };

    if (Array.isArray(f.merged) && f.merged.length > 0) {
      entry.merged = f.merged.filter((m: unknown) => typeof m === "string");
    }

    if (typeof f.target === "string" && f.target.length > 0) {
      entry.target = f.target;
    }

    files.push(entry);
  }

  files.sort((a, b) =>
    a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0,
  );

  const captured: CapturedDeploymentManifest = {
    modType,
    entryCount: files.length,
    files,
  };

  if (typeof manifest?.deploymentMethod === "string") {
    captured.deploymentMethod = manifest.deploymentMethod;
  }

  if (typeof manifest?.deploymentTime === "number") {
    captured.deploymentTime = manifest.deploymentTime;
  }

  return captured;
}

/**
 * Capture deployment manifests for every modtype the curator has mods for.
 *
 * One manifest per modtype: we ask `util.getManifest` for each, normalize
 * to our portable shape, and return the set sorted by modtype name.
 *
 * INVARIANT: This function never throws. Per-modtype failures are logged
 * to console and that modtype is skipped — partial capture beats no
 * capture, and the future installer can warn on missing types.
 */
export async function captureDeploymentManifests(
  api: types.IExtensionApi,
  state: types.IState,
  gameId: string,
): Promise<CapturedDeploymentManifest[]> {
  const modTypes = collectDistinctModTypes(state, gameId);
  const captured: CapturedDeploymentManifest[] = [];

  for (const modType of modTypes) {
    try {
      const manifest = await util.getManifest(api, modType, gameId);

      if (!manifest) {
        continue;
      }

      const normalized = normalizeManifest(modType, manifest);

      if (normalized.entryCount > 0 || modType === "") {
        captured.push(normalized);
      }
    } catch (err) {
      console.warn(
        `[Vortex Mod Monitor] Failed to read deployment manifest | gameId=${gameId} modType=${JSON.stringify(modType)}:`,
        err,
      );
    }
  }

  return captured;
}
