/**
 * A small, REAL Vortex world on disk, for end-to-end tests.
 *
 * Every bug that reached the curator this cycle survived a green unit suite:
 * the hash cache that shipped as a no-op, the fingerprint that could not see a
 * mod update, the game version recorded as `"unknown"` and then enforced
 * exactly. Each was covered — at the level below the one where it broke.
 * What none of them faced was the whole chain: profile in, package out, plan
 * back.
 *
 * So this builds an actual staging folder with actual bytes. Files are hashed
 * for real, `stagingSetHash` is computed over real content, and the manifest
 * that comes out is the manifest a curator would ship. The only pretence is
 * the zip container (see `fakeSevenZip`) — the data path is genuine, and the
 * data path is where the reproduction promise lives.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { __testPaths } from "../stubs/vortex-api";
import {
  getModsForProfile,
  type AuditorMod,
} from "../../src/core/getModsListForProfile";

export type WorldMod = {
  id: string;
  name?: string;
  enabled?: boolean;
  modType?: string;
  version?: string;
  /** Relative path → contents. Written to the mod's staging folder for real. */
  files: Record<string, string>;
  /** Present ⇒ a Nexus mod. Absent ⇒ external. */
  nexus?: { modId: number; fileId: number };
  /** Archive sha256 the build would have computed. Absent ⇒ archive-less. */
  archiveSha256?: string;
  installOrder?: number;
  /**
   * Vortex's `attributes.installerChoices`, verbatim — `{ type, options }`.
   * Written into state exactly as Vortex stores it so the capture path is
   * exercised rather than bypassed.
   */
  installerChoices?: { type: string; options: unknown };
};

export type World = {
  root: string;
  stagingRoot: string;
  downloadRoot: string;
  /**
   * Where the driver writes receipts and caches, per world.
   *
   * These tests used a hardcoded `C:/nowhere/appdata`, which was neither
   * nowhere nor harmless: the driver creates its directories, so the suite
   * wrote real files to the DRIVE ROOT. Worse, every e2e file shares one
   * package id, so parallel test files raced on the same
   * `<packageId>.json.tmp` → rename. Whichever renamed second got ENOENT and
   * the install reported `failed` at `writing-receipt` — a flake that looked
   * like a driver bug and was pure test collision.
   */
  appDataPath: string;
  gameId: string;
  profileId: string;
  mods: AuditorMod[];
  /** Vortex-shaped state, enough for the code under test. */
  state: unknown;
  cleanup: () => void;
};

/**
 * Build the world and point the vortex-api stub at it.
 *
 * The stub reports `installPath` globally, so a test must create its world
 * before touching anything that reads staging, and call `cleanup` after.
 */
export function makeWorld(args: {
  gameId?: string;
  profileId?: string;
  mods: WorldMod[];
}): World {
  const gameId = args.gameId ?? "fallout4";
  const profileId = args.profileId ?? "profile-1";
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eh-e2e-"));
  const stagingRoot = path.join(root, "staging");
  const downloadRoot = path.join(root, "downloads");
  const appDataPath = path.join(root, "appdata");
  fs.mkdirSync(stagingRoot, { recursive: true });
  fs.mkdirSync(downloadRoot, { recursive: true });
  fs.mkdirSync(appDataPath, { recursive: true });

  const previous = { ...__testPaths };
  __testPaths.installPath = stagingRoot;
  __testPaths.downloadPath = downloadRoot;

  const modState: Record<string, { enabled: boolean }> = {};
  const persistentMods: Record<string, unknown> = {};

  args.mods.forEach((spec, index) => {
    const dir = path.join(stagingRoot, spec.id);
    for (const [rel, contents] of Object.entries(spec.files)) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, contents);
    }

    modState[spec.id] = { enabled: spec.enabled ?? true };
    persistentMods[spec.id] = {
      id: spec.id,
      installationPath: spec.id,
      installOrder: spec.installOrder ?? index,
      type: spec.modType ?? "",
      attributes: {
        name: spec.name ?? spec.id,
        version: spec.version ?? "1.0.0",
        installTime: new Date(2026, 0, 1 + index).toISOString(),
        ...(spec.installerChoices !== undefined
          ? { installerChoices: spec.installerChoices }
          : {}),
        ...(spec.archiveSha256 !== undefined
          ? { archiveSha256: spec.archiveSha256 }
          : {}),
        ...(spec.nexus !== undefined
          ? { modId: spec.nexus.modId, fileId: spec.nexus.fileId, source: "nexus" }
          : {}),
      },
    };
  });

  const state = {
    settings: {
      profiles: { activeProfileId: profileId, activeGameId: gameId },
      gameMode: { discovered: { [gameId]: { path: path.join(root, "game") } } },
      mods: { activator: { [gameId]: "hardlink_activator" } },
    },
    persistent: {
      profiles: { [profileId]: { gameId, modState } },
      mods: { [gameId]: persistentMods },
    },
    app: { appVersion: "2.6.0" },
  };

  // Derived by the SAME function the build uses, not hand-assembled. An
  // earlier version of this harness filled AuditorMod fields directly and so
  // could not have caught a capture bug — it skipped the code that captures.
  const mods = getModsForProfile(state as never, gameId, profileId).map((m) => ({
    ...m,
    ...(args.mods.find((spec) => spec.id === m.id)?.archiveSha256 !== undefined
      ? { archiveSha256: args.mods.find((spec) => spec.id === m.id)!.archiveSha256 }
      : {}),
  })) as AuditorMod[];

  return {
    root,
    stagingRoot,
    downloadRoot,
    appDataPath,
    gameId,
    profileId,
    mods,
    state,
    cleanup: (): void => {
      __testPaths.installPath = previous.installPath;
      __testPaths.downloadPath = previous.downloadPath;
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

/** sha256 of a string, for expressing expectations about real bytes. */
export function sha256(text: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(text).digest("hex");
}
