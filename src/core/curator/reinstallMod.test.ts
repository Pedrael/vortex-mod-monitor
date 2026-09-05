/**
 * Reinstalling without quietly changing the mod.
 *
 * Uninstall takes the mod's attributes with it — FOMOD answers, modType,
 * enabled state, our freeze. Everything here is about reading those BEFORE
 * they are destroyed and putting them back afterwards, because a mod that
 * comes back as a default install of the same archive is a different mod
 * wearing the same name.
 */
import { describe, expect, it } from "vitest";

import {
  CannotReinstall,
  captureForReinstall,
  reinstallArgs,
  restorationFor,
  type PreservedModState,
} from "./reinstallMod";
import type { types } from "@nexusmods/vortex-api";

const FROZEN = "eventHorizonFrozenAtVersion";

const state = (mod: unknown): types.IState =>
  ({ persistent: { mods: { skyrimse: { m1: mod } } } }) as unknown as types.IState;

const capture = (mod: unknown, enabled: string[] = []) =>
  captureForReinstall(state(mod), "skyrimse", "m1", new Set(enabled), FROZEN);

describe("capturing what the uninstall will destroy", () => {
  it("takes the archive, choices, type, enabled state and freeze", () => {
    const preserved = capture(
      {
        archiveId: "dl-9",
        type: "dinput",
        attributes: {
          installerChoices: { type: "fomod", options: [{ name: "step" }] },
          [FROZEN]: "1.4.2",
        },
      },
      ["m1"],
    );
    expect(preserved).toEqual({
      archiveId: "dl-9",
      installerChoices: { type: "fomod", options: [{ name: "step" }] },
      modType: "dinput",
      enabled: true,
      frozenAtVersion: "1.4.2",
    });
  });

  it("refuses a mod with no archive rather than uninstalling it", () => {
    // Removing something we cannot put back is not a repair.
    expect(() => capture({ attributes: {} })).toThrow(CannotReinstall);
    expect(() => capture({ archiveId: "", attributes: {} })).toThrow(
      /cannot be reinstalled/,
    );
  });

  it("refuses a mod Vortex does not have", () => {
    expect(() =>
      captureForReinstall(
        state({ archiveId: "x" }),
        "skyrimse",
        "missing",
        new Set(),
        FROZEN,
      ),
    ).toThrow(CannotReinstall);
  });

  it("reads enabled from the profile, not from the mod record", () => {
    expect(capture({ archiveId: "d", attributes: {} }, []).enabled).toBe(false);
    expect(capture({ archiveId: "d", attributes: {} }, ["m1"]).enabled).toBe(true);
  });

  it("treats an absent type as Vortex's default, not as undefined", () => {
    expect(capture({ archiveId: "d", attributes: {} }).modType).toBe("");
  });

  it("omits a freeze that is not there", () => {
    const p = capture({ archiveId: "d", attributes: {} });
    expect("frozenAtVersion" in p).toBe(false);
  });
});

describe("what goes back on afterwards", () => {
  const base: PreservedModState = {
    archiveId: "d",
    modType: "dinput",
    enabled: true,
  };

  it("restores a modType the fresh install did not derive", () => {
    // The engine-injector case: Vortex answers "default" with total
    // confidence and the DLLs land in Data where nothing loads them.
    expect(restorationFor(base, { modType: "" }).setModType).toBe("dinput");
  });

  it("does not re-set a type that already matches", () => {
    // Forty pointless state writes on a batch of forty.
    const r = restorationFor(base, { modType: "dinput" });
    expect("setModType" in r).toBe(false);
  });

  it("puts the freeze back", () => {
    expect(
      restorationFor({ ...base, frozenAtVersion: "2.0" }, { modType: "dinput" })
        .setFrozenAtVersion,
    ).toBe("2.0");
  });

  it("always states the enabled decision", () => {
    // A reinstalled mod arrives disabled, so this has to be acted on rather
    // than assumed unchanged.
    expect(restorationFor(base, { modType: "dinput" }).enable).toBe(true);
    expect(
      restorationFor({ ...base, enabled: false }, { modType: "dinput" }).enable,
    ).toBe(false);
  });
});

describe("the install arguments", () => {
  it("replays the curator's answers, unattended", () => {
    // A batch that stops to ask on mod eleven of forty is one the curator has
    // to babysit, and the answers are already known.
    expect(
      reinstallArgs({
        archiveId: "d",
        modType: "",
        enabled: true,
        installerChoices: { type: "fomod" },
      }),
    ).toEqual({ archiveId: "d", choices: { type: "fomod" }, unattended: true });
  });

  it("passes neither field when the mod had no choices", () => {
    // Keeps the no-choices path identical to a plain install.
    const args = reinstallArgs({ archiveId: "d", modType: "", enabled: true });
    expect(args).toEqual({ archiveId: "d" });
    expect("unattended" in args).toBe(false);
  });
});
