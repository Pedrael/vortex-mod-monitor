/**
 * ──────────────────────────────────────────────────────────────────────
 * plugins.txt lives in a folder whose name depends on who sold the game.
 *
 * This is the defect that cost a real curator every Skyrim SE package they
 * had built. Their copy is from GOG, so the game writes to
 * `%LOCALAPPDATA%\\Skyrim Special Edition GOG`; the build looked in
 * `Skyrim Special Edition`, found nothing, and shipped `plugins.order: []`.
 *
 * Nothing failed. No error, no warning — an empty plugin order is also what a
 * game with no plugins.txt legitimately produces, so the two were
 * indistinguishable. Fallout 4 packages from the same machine were correct,
 * which is precisely why it survived: the feature demonstrably worked.
 *
 * The folder names below are copied from Vortex's own overlay in
 * `gamebryo-plugin-management`, which is the authority — the same table it
 * uses to find the file itself.
 * ──────────────────────────────────────────────────────────────────────
 */
import { describe, expect, it } from "vitest";

import {
  discoveredStore,
  pluginsTxtFolderCandidates,
} from "./comparePlugins";

describe("the store decides the folder", () => {
  it("uses the store's folder when Vortex discovered one", () => {
    expect(pluginsTxtFolderCandidates("skyrimse", "gog")).toEqual([
      "Skyrim Special Edition GOG",
    ]);
    expect(pluginsTxtFolderCandidates("skyrimse", "xbox")).toEqual([
      "Skyrim Special Edition MS",
    ]);
    expect(pluginsTxtFolderCandidates("skyrimse", "epic")).toEqual([
      "Skyrim Special Edition EPIC",
    ]);
    expect(pluginsTxtFolderCandidates("fallout4", "xbox")).toEqual([
      "Fallout4 MS",
    ]);
  });

  it("is case-insensitive about the store name", () => {
    expect(pluginsTxtFolderCandidates("skyrimse", "GOG")).toEqual([
      "Skyrim Special Edition GOG",
    ]);
  });

  it("falls back to the Steam folder for a store with no override", () => {
    // Steam itself, and any store Vortex knows that does not relocate the
    // folder. One candidate, because the store is known.
    expect(pluginsTxtFolderCandidates("skyrimse", "steam")).toEqual([
      "Skyrim Special Edition",
    ]);
  });

  it("offers EVERY variant when the store is unknown", () => {
    /**
     * The important case. Guessing Steam is what produced an empty package;
     * offering all of them lets the resolver find the folder that actually
     * exists instead of reporting a profile with no plugins.
     */
    const candidates = pluginsTxtFolderCandidates("skyrimse");
    expect(candidates[0]).toBe("Skyrim Special Edition");
    expect(candidates).toContain("Skyrim Special Edition GOG");
    expect(candidates).toContain("Skyrim Special Edition MS");
    expect(candidates).toContain("Skyrim Special Edition EPIC");
  });

  it("has nothing to offer for a game it does not know", () => {
    expect(pluginsTxtFolderCandidates("morrowind")).toEqual([]);
    expect(pluginsTxtFolderCandidates("morrowind", "gog")).toEqual([]);
  });
});

describe("reading the store out of Vortex's discovery", () => {
  const stateWith = (store: unknown): unknown => ({
    settings: { gameMode: { discovered: { skyrimse: { store } } } },
  });

  it("returns what Vortex recorded", () => {
    expect(discoveredStore(stateWith("gog"), "skyrimse")).toBe("gog");
  });

  it("returns undefined — never a default — when it recorded nothing", () => {
    // "Unknown" and "Steam" are different answers: the first means look, the
    // second means trust one path. Collapsing them is the original bug.
    expect(discoveredStore(stateWith(undefined), "skyrimse")).toBeUndefined();
    expect(discoveredStore(stateWith(""), "skyrimse")).toBeUndefined();
    expect(discoveredStore({}, "skyrimse")).toBeUndefined();
    expect(discoveredStore(undefined, "skyrimse")).toBeUndefined();
    expect(discoveredStore(stateWith("gog"), "fallout4")).toBeUndefined();
  });
});
