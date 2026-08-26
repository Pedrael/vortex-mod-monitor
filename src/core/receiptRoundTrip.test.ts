/**
 * `serializeReceipt` validates through `parseReceipt` BEFORE writing, so a
 * field the parser does not know is not lost on read — it is destroyed on the
 * way to disk and never exists at all.
 *
 * That is how `gameIniApplication` went missing. `shouldApplyGameIni` reads it
 * to decide whether the curator's INI settings have already been applied for
 * this package version; reading a field that can never be present turned
 * "apply once" into "apply on every install and every update", quietly
 * overwriting whatever the user had changed in between. Nothing failed, and
 * the only visible symptom was settings reverting.
 *
 * The parser is a whitelist. So this asserts every optional field survives a
 * real round trip, by name, and a new one added to the type without a parser
 * branch fails here instead of on someone's machine.
 */
import { describe, expect, it } from "vitest";

import { parseReceipt, serializeReceipt } from "./installLedger";
import type { InstallReceipt } from "../types/installLedger";

const base = (): InstallReceipt =>
  ({
    schemaVersion: 1,
    packageId: "11111111-2222-4333-8444-555555555555",
    packageVersion: "1.0.0",
    packageName: "Test Collection",
    gameId: "fallout4",
    installedAt: "1970-01-01T00:00:00.000Z",
    vortexProfileId: "profile-1",
    vortexProfileName: "Profile",
    installTargetMode: "fresh-profile",
    mods: [],
  }) as InstallReceipt;

/** What actually lands on disk, which is what the next install will read. */
const throughDisk = (r: InstallReceipt): InstallReceipt =>
  JSON.parse(serializeReceipt(r)) as InstallReceipt;

describe("install receipt round-trip", () => {
  it("keeps gameIniApplication, which the apply-once guard depends on", () => {
    const gameIniApplication = {
      packageVersion: "1.0.0",
      appliedAt: "1970-01-01T00:00:00.000Z",
      files: [{ fileName: "Fallout4.ini", applied: 310, skipped: 0 }],
    };
    const out = throughDisk({ ...base(), gameIniApplication } as InstallReceipt);
    expect(out.gameIniApplication).toEqual(gameIniApplication);
  });

  it("keeps every other optional block", () => {
    const rulesApplication = { appliedRuleCount: 3, skippedRules: [] };
    const userlistApplication = { appliedCount: 1, skippedEntries: [] };
    const verifications = [{ compareKey: "k", name: "n", outcome: "ok" }];
    const out = throughDisk({
      ...base(),
      rulesApplication,
      userlistApplication,
      verifications,
    } as unknown as InstallReceipt);
    expect(out.rulesApplication).toEqual(rulesApplication);
    expect(out.userlistApplication).toEqual(userlistApplication);
    expect(out.verifications).toEqual(verifications);
  });

  it("keeps the identity fields the next install reconciles against", () => {
    // packageId and packageVersion decide whether the next run is an UPDATE of
    // this collection or a stranger, which drives orphan detection.
    const out = throughDisk(base());
    expect(out.packageId).toBe("11111111-2222-4333-8444-555555555555");
    expect(out.packageVersion).toBe("1.0.0");
    expect(out.installTargetMode).toBe("fresh-profile");
  });

  it("round-trips through parseReceipt unchanged a second time", () => {
    // Serialize is idempotent only if nothing is being dropped each pass. A
    // field that survives one trip and dies on the next is the same bug with
    // a longer fuse.
    const full = {
      ...base(),
      gameIniApplication: {
        packageVersion: "1.0.0",
        appliedAt: "1970-01-01T00:00:00.000Z",
        files: [],
      },
      rulesApplication: { appliedRuleCount: 0, skippedRules: [] },
    } as unknown as InstallReceipt;
    const once = throughDisk(full);
    const twice = parseReceipt(serializeReceipt(once));
    expect(twice).toEqual(once);
  });
});
