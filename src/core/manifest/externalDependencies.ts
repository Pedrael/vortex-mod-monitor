/**
 * ──────────────────────────────────────────────────────────────────────
 * Prerequisites that are NOT Vortex mods.
 *
 * A script extender, ENB, a plugin preloader — these live in the game folder,
 * Vortex does not manage them, and no amount of installing mods produces them.
 * A collection that silently assumes they are present reproduces on the
 * curator's machine and nowhere else.
 *
 * The manifest has carried `externalDependencies` since the schema was written,
 * and the whole read side exists: the parser validates them, the resolver
 * verifies each declared file against the user's game folder, and the install
 * UI reports what is missing. The BUILD side has been emitting `[]` the entire
 * time — `externalDependencies: []`, hard-coded. The feature was plumbed end to
 * end except for the end that produces the data.
 *
 * ## Detected, not typed
 *
 * The contract wants a sha256 per file, which is not something a curator can
 * reasonably hand-write. They already have these things installed, so the
 * honest source is their own game folder: find the files, hash them, record
 * what was actually there. The version and the download URL are the only parts
 * a human has to supply, and even the URL has an obvious default per tool.
 *
 * ## Detection is evidence-based, never a guess
 *
 * A lone `d3d11.dll` could be ENB, ReShade, or a dozen other wrappers, so a
 * dependency is only reported when a CORROBORATING file is present too —
 * `enbseries.ini` beside the dll, the extender's own dll beside its loader.
 * Anything that cannot be identified confidently is left out rather than
 * declared, because a wrong prerequisite sends every user of the collection
 * chasing something the curator never had.
 *
 * ## A file the COLLECTION installs is not a prerequisite
 *
 * This is the rule that decides whether the feature helps or actively harms.
 * Finding `f4se_loader.exe` in the game folder does not mean the user must go
 * and install F4SE by hand — on the curator's own profile that file is
 * deployed by a Vortex mod, "Fallout 4 Script Extender (F4SE)-42147-...",
 * which the collection already ships. Declaring it external would send every
 * single user to silverlock.org to hand-install something they were about to
 * receive anyway.
 *
 * So a probe is skipped when any mod in the collection stages one of its
 * required files. What remains is the genuine article: things sitting in the
 * game folder that no mod accounts for.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as fsp from "fs/promises";
import * as path from "path";

import { hashFileSha256 } from "../archiveHashing";
import type {
  EhcollExternalDependency,
  ExternalDependencyFile,
} from "../../types/ehcoll";

/** One thing we know how to recognise in a game folder. */
type DependencyProbe = {
  id: string;
  name: string;
  category: string;
  /** Games this applies to; empty means all supported games. */
  gameIds: string[];
  /**
   * Every file listed must exist for the dependency to be reported. This is
   * the corroboration rule: one ambiguous file is never enough.
   */
  required: string[];
  /** Recorded when present, but their absence does not disprove anything. */
  optional?: string[];
  instructionsUrl: string;
  instructions: string;
  /** Pull a version out of the files found, when the naming encodes one. */
  version?: (found: string[]) => string | undefined;
};

/**
 * Script-extender loaders are named per game, and the companion dll encodes
 * the GAME version it was built against (`f4se_1_10_163.dll`) — which is
 * exactly the thing a user needs to match, so it is worth capturing.
 */
const SCRIPT_EXTENDER_VERSION = (found: string[]): string | undefined => {
  for (const f of found) {
    const m = /_(\d+)_(\d+)_(\d+)\.dll$/i.exec(f);
    if (m !== null) return `${m[1]}.${m[2]}.${m[3]}`;
  }
  return undefined;
};

const PROBES: DependencyProbe[] = [
  {
    id: "f4se",
    name: "Fallout 4 Script Extender (F4SE)",
    category: "script-extender",
    gameIds: ["fallout4"],
    required: ["f4se_loader.exe"],
    optional: ["f4se_1_10_163.dll", "f4se_1_10_984.dll", "f4se_steam_loader.dll"],
    instructionsUrl: "https://f4se.silverlock.org/",
    instructions:
      "Download the F4SE build that matches your Fallout 4 version and extract " +
      "its files into the game folder, next to Fallout4.exe. Launch the game " +
      "through f4se_loader.exe — mods that need it will not load otherwise.",
    version: SCRIPT_EXTENDER_VERSION,
  },
  {
    id: "skse64",
    name: "Skyrim Script Extender (SKSE64)",
    category: "script-extender",
    gameIds: ["skyrimse"],
    required: ["skse64_loader.exe"],
    optional: ["skse64_steam_loader.dll"],
    instructionsUrl: "https://skse.silverlock.org/",
    instructions:
      "Download the SKSE64 build matching your Skyrim Special Edition version " +
      "and extract it into the game folder. Launch through skse64_loader.exe.",
    version: SCRIPT_EXTENDER_VERSION,
  },
  {
    id: "sfse",
    name: "Starfield Script Extender (SFSE)",
    category: "script-extender",
    gameIds: ["starfield"],
    required: ["sfse_loader.exe"],
    instructionsUrl: "https://github.com/ianpatt/sfse",
    instructions:
      "Download the SFSE build matching your Starfield version and extract it " +
      "into the game folder. Launch through sfse_loader.exe.",
    version: SCRIPT_EXTENDER_VERSION,
  },
  {
    id: "nvse",
    name: "New Vegas Script Extender (NVSE)",
    category: "script-extender",
    gameIds: ["falloutnv"],
    required: ["nvse_loader.exe"],
    instructionsUrl: "https://github.com/xNVSE/NVSE",
    instructions:
      "Extract NVSE into the game folder and launch through nvse_loader.exe.",
    version: SCRIPT_EXTENDER_VERSION,
  },
  {
    id: "fose",
    name: "Fallout Script Extender (FOSE)",
    category: "script-extender",
    gameIds: ["fallout3"],
    required: ["fose_loader.exe"],
    instructionsUrl: "https://fose.silverlock.org/",
    instructions:
      "Extract FOSE into the game folder and launch through fose_loader.exe.",
    version: SCRIPT_EXTENDER_VERSION,
  },
  {
    id: "enb",
    name: "ENBSeries",
    category: "enb",
    gameIds: [],
    // d3d11.dll alone proves nothing — ReShade and other wrappers use the same
    // name. The .ini beside it is what makes this ENB.
    required: ["d3d11.dll", "enbseries.ini"],
    optional: ["enblocal.ini", "enbhost.exe"],
    instructionsUrl: "http://enbdev.com/",
    instructions:
      "Download the ENBSeries binaries for this game from enbdev.com and copy " +
      "d3d11.dll and d3dcompiler_46e.dll into the game folder, then add the " +
      "preset's files. ENB is a graphics wrapper, not a mod — Vortex does not " +
      "install it.",
  },
  {
    id: "xse-plugin-preloader",
    name: "xSE PluginPreloader",
    category: "loader",
    gameIds: [],
    required: ["IpHlpAPI.dll", "xSE PluginPreloader.xml"],
    instructionsUrl: "https://www.nexusmods.com/fallout4/mods/33946",
    instructions:
      "Copy IpHlpAPI.dll and xSE PluginPreloader.xml into the game folder. " +
      "Some F4SE plugins will not load without it.",
  },
];

/**
 * The game's install root, from Vortex's own discovery record.
 *
 * Reads state only. Returns undefined when the game was never discovered,
 * which is a "cannot check" and must not be reported as "nothing installed".
 */
export function getGameDirectory(
  state: unknown,
  gameId: string,
): string | undefined {
  const discovered = (
    state as {
      settings?: { gameMode?: { discovered?: Record<string, { path?: string }> } };
    }
  )?.settings?.gameMode?.discovered?.[gameId];
  const p = discovered?.path;
  return typeof p === "string" && p.length > 0 ? p : undefined;
}

async function findFile(
  gameDir: string,
  relPath: string,
): Promise<string | undefined> {
  try {
    const full = path.join(gameDir, relPath);
    const stat = await fsp.stat(full);
    return stat.isFile() ? full : undefined;
  } catch {
    return undefined;
  }
}

export type DetectOptions = {
  signal?: AbortSignal;
  /** Reported per dependency so a slow hash is not a silent hang. */
  onProgress?: (name: string) => void;
  /**
   * Lower-cased basenames the collection's own mods install. A probe whose
   * required file appears here is a managed mod, not a prerequisite, and is
   * skipped. See the docblock — this is the rule that keeps the feature from
   * doing harm.
   */
  providedByMods?: ReadonlySet<string>;
};

/**
 * Every file a MOD deployed into the game folder, by lower-cased basename.
 *
 * Vortex's own deployment manifest answers "which mod owns this file" directly
 * and in one read, which beats walking 955 staging folders and is authoritative
 * rather than inferred — it also accounts for merged files. Preferred over
 * {@link filesProvidedByMods} wherever the manifests are available, which is
 * everywhere the build looks, and early enough that the curator can see the
 * result before starting a build.
 */
export function filesProvidedByDeployment(
  manifests: ReadonlyArray<{
    files: ReadonlyArray<{ relPath: string; source?: string }>;
  }>,
): Set<string> {
  const out = new Set<string>();
  for (const manifest of manifests) {
    for (const entry of manifest.files) {
      const norm = entry.relPath.split("\\").join("/");
      const slash = norm.lastIndexOf("/");
      out.add((slash === -1 ? norm : norm.slice(slash + 1)).toLowerCase());
    }
  }
  return out;
}

/**
 * Every file the collection itself installs, by lower-cased basename.
 *
 * Basename rather than full path on purpose: a prerequisite is identified by
 * the file the game loads (`f4se_loader.exe`), and a mod may stage it at a
 * different relative depth than the game folder expects.
 */
export function filesProvidedByMods(
  mods: ReadonlyArray<{ stagingFiles?: ReadonlyArray<{ path: string }> }>,
): Set<string> {
  const out = new Set<string>();
  for (const mod of mods) {
    for (const file of mod.stagingFiles ?? []) {
      const slash = file.path.lastIndexOf("/");
      out.add((slash === -1 ? file.path : file.path.slice(slash + 1)).toLowerCase());
    }
  }
  return out;
}

/**
 * Look for known prerequisites in the curator's game folder and describe what
 * is actually there, with real hashes.
 *
 * Never throws for a per-probe problem: an unreadable file drops that file, and
 * a probe whose required set is incomplete is simply not reported.
 */
export async function detectExternalDependencies(
  gameDir: string,
  gameId: string,
  options: DetectOptions = {},
): Promise<EhcollExternalDependency[]> {
  const out: EhcollExternalDependency[] = [];

  for (const probe of PROBES) {
    if (options.signal?.aborted === true) break;
    if (probe.gameIds.length > 0 && !probe.gameIds.includes(gameId)) continue;

    // The collection already installs it -> not a prerequisite.
    if (
      probe.required.some((rel) =>
        options.providedByMods?.has(path.basename(rel).toLowerCase()) === true,
      )
    ) {
      continue;
    }

    const requiredPaths = await Promise.all(
      probe.required.map(async (rel) => ({ rel, full: await findFile(gameDir, rel) })),
    );
    if (requiredPaths.some((r) => r.full === undefined)) continue;

    options.onProgress?.(probe.name);

    const optionalPaths = await Promise.all(
      (probe.optional ?? []).map(async (rel) => ({
        rel,
        full: await findFile(gameDir, rel),
      })),
    );

    const files: ExternalDependencyFile[] = [];
    for (const entry of [...requiredPaths, ...optionalPaths]) {
      if (entry.full === undefined) continue;
      try {
        files.push({
          relPath: entry.rel,
          sha256: await hashFileSha256(entry.full, options.signal),
        });
      } catch {
        // A file we cannot read is a file we cannot vouch for. Recording it
        // without a hash is not an option — the type requires one — and
        // guessing is worse than omitting.
      }
    }
    if (files.length === 0) continue;

    const version = probe.version?.(files.map((f) => f.relPath)) ?? "unknown";
    out.push({
      id: probe.id,
      name: probe.name,
      category: probe.category,
      version,
      destination: "<gameDir>",
      files,
      instructionsUrl: probe.instructionsUrl,
      instructions: probe.instructions,
    });
  }

  return out;
}

/**
 * Apply the curator's decisions to what was detected.
 *
 * Detection proposes; the curator disposes. An entry they excluded is dropped,
 * and instructions they wrote replace the generic default — theirs will say
 * which build to get, which the default cannot know.
 */
export type ExternalDependencyOverride = {
  included?: boolean;
  instructions?: string;
  instructionsUrl?: string;
  version?: string;
};

export function applyDependencyOverrides(
  detected: EhcollExternalDependency[],
  overrides: Record<string, ExternalDependencyOverride> | undefined,
): EhcollExternalDependency[] {
  if (overrides === undefined) return detected;
  const out: EhcollExternalDependency[] = [];
  for (const dep of detected) {
    const o = overrides[dep.id];
    if (o?.included === false) continue;
    out.push({
      ...dep,
      ...(o?.version !== undefined && o.version.length > 0
        ? { version: o.version }
        : {}),
      ...(o?.instructions !== undefined && o.instructions.trim().length > 0
        ? { instructions: o.instructions }
        : {}),
      ...(o?.instructionsUrl !== undefined && o.instructionsUrl.trim().length > 0
        ? { instructionsUrl: o.instructionsUrl }
        : {}),
    });
  }
  return out;
}
