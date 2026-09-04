/**
 * Re-reading the machine without destroying what was typed.
 *
 * The build form is a snapshot taken when it opened, and acting on what it
 * says usually means LEAVING it: the form reports a missing prerequisite, the
 * curator goes to Vortex and installs it, comes back — and is looking at the
 * scan from before they fixed it. Until now the only way to retake the
 * snapshot was to discard the draft, which threw away the typing with it.
 *
 * So the whole risk of this feature is that it feels like it undid their work.
 * These tests are about that, not about the re-read itself:
 *
 *   - the name, version, readme and per-mod overrides survive;
 *   - overrides come from MEMORY, not a re-read of the config, because a
 *     decision made on the form and not yet persisted must not vanish;
 *   - keystrokes made WHILE the re-read is in flight are not rolled back;
 *   - a failed re-read leaves the old scan rather than blanking the form.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const loadBuildContext = vi.fn();
vi.mock("./engine", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, loadBuildContext: (...a: unknown[]) => loadBuildContext(...a) };
});

import { BuildSession } from "./buildSession";

const ctx = (tag: string): Record<string, unknown> => ({
  tag,
  gameId: "skyrimse",
  profileId: "p1",
  mods: [{ id: "m1" }],
  scopeWarnings: [],
  rootFolderReview: [],
  detectedDependencies: [],
  externalMods: [],
  externalHints: new Map(),
  collectionConfig: { schemaVersion: 1, packageId: "p", externalMods: {} },
  configPath: "/cfg.json",
  configCreated: false,
  defaultName: "Fresh Name",
  defaultVersion: "1.0.0",
  defaultAuthor: "",
  gameVersion: "1.6.1179.0",
});

const api = {} as never;

/** A session parked in the `form` state with the given typed values. */
const sessionOnForm = (
  typed: Record<string, unknown> = {},
): { s: BuildSession; state: () => Record<string, unknown> } => {
  const s = new BuildSession({
    draftId: "d1",
    gameId: "skyrimse",
    // The registry hooks are what a real session notifies; a stub keeps this
    // about refreshContext rather than about the registry.
    hooks: {
      enqueueBuild: () => undefined,
      releaseBuild: () => undefined,
      cancelQueued: () => undefined,
      notifyStateChanged: () => undefined,
    },
  } as never);
  (s as unknown as { state: unknown }).state = {
    kind: "form",
    ctx: ctx("original"),
    curator: {
      name: "My Collection",
      version: "1.0.1",
      author: "Me",
      description: "",
      gameVersion: "1.6.1179.0",
      gameVersionPolicy: "exact",
    },
    overrides: { "mod-1": { postProcessed: true } },
    readme: "typed readme",
    changelog: "typed changelog",
    verificationLevel: "thorough",
    reverifyEverything: false,
    ...typed,
  };
  return {
    s,
    state: () => (s as unknown as { state: Record<string, unknown> }).state,
  };
};

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

// Call counts are an assertion in two tests below, so the mock cannot carry
// state between them.
beforeEach(() => {
  loadBuildContext.mockReset();
});

describe("refreshing the build form", () => {
  it("swaps the scan and keeps every typed field", async () => {
    loadBuildContext.mockResolvedValueOnce(ctx("refreshed"));
    const { s, state } = sessionOnForm();

    s.refreshContext(api);
    await settle();

    const st = state();
    expect((st.ctx as { tag: string }).tag).toBe("refreshed");
    // The name must NOT be reset to ctx.defaultName ("Fresh Name") — that is
    // the blank-slate value, and this is not a blank slate.
    expect((st.curator as { name: string }).name).toBe("My Collection");
    expect((st.curator as { version: string }).version).toBe("1.0.1");
    expect(st.readme).toBe("typed readme");
    expect(st.changelog).toBe("typed changelog");
    expect(st.refreshing).toBe(false);
    expect(typeof st.refreshedAt).toBe("string");
  });

  it("keeps overrides from memory rather than re-reading the config", async () => {
    // The refreshed context carries an EMPTY externalMods, as it would if the
    // decision has not been written to disk yet. Taking the config's word for
    // it would silently drop the curator's answer.
    loadBuildContext.mockResolvedValueOnce(ctx("refreshed"));
    const { s, state } = sessionOnForm();

    s.refreshContext(api);
    await settle();

    expect(state().overrides).toEqual({ "mod-1": { postProcessed: true } });
  });

  it("does not roll back typing done while the re-read was in flight", async () => {
    // The realistic race: a 1753-mod re-read takes a while and the curator
    // keeps working. Reinstating the snapshot captured at click time would
    // eat their keystrokes — a worse bug than the stale scan being fixed.
    let release: (v: unknown) => void = () => undefined;
    loadBuildContext.mockReturnValueOnce(
      new Promise((r) => {
        release = r;
      }),
    );
    const { s, state } = sessionOnForm();

    s.refreshContext(api);
    const mid = state();
    expect(mid.refreshing).toBe(true);

    // The curator types on.
    (s as unknown as { state: Record<string, unknown> }).state = {
      ...mid,
      readme: "typed WHILE refreshing",
    };

    release(ctx("refreshed"));
    await settle();

    expect(state().readme).toBe("typed WHILE refreshing");
    expect((state().ctx as { tag: string }).tag).toBe("refreshed");
  });

  it("keeps the previous scan when the re-read fails", async () => {
    loadBuildContext.mockRejectedValueOnce(new Error("Vortex went away"));
    const { s, state } = sessionOnForm();

    s.refreshContext(api);
    await settle();

    const st = state();
    // Stale is what they already had; blank would be strictly worse.
    expect((st.ctx as { tag: string }).tag).toBe("original");
    expect(st.refreshing).toBe(false);
    expect(String(st.validationError)).toMatch(/could not re-read/i);
    expect(String(st.validationError)).toMatch(/Vortex went away/);
  });

  it("ignores a second press while one is already running", async () => {
    loadBuildContext.mockReturnValueOnce(new Promise(() => undefined));
    const { s } = sessionOnForm();

    s.refreshContext(api);
    s.refreshContext(api);
    s.refreshContext(api);

    expect(loadBuildContext).toHaveBeenCalledTimes(1);
  });

  it("does nothing at all outside the form state", async () => {
    const s = new BuildSession({
      draftId: "d1",
      gameId: "skyrimse",
      hooks: {
        enqueueBuild: () => undefined,
        releaseBuild: () => undefined,
        cancelQueued: () => undefined,
        notifyStateChanged: () => undefined,
      },
    } as never);
    (s as unknown as { state: unknown }).state = { kind: "building" };
    s.refreshContext(api);
    await settle();
    expect(loadBuildContext).not.toHaveBeenCalled();
  });
});

describe("a refresh re-reads, it does not trust", () => {
  it("does the FULL pass, carrying no hashes over", async () => {
    // Reuse was built and rejected. The archive fingerprint cache
    // (path|size|mtime) already skips reading an archive that has not changed,
    // so a re-read costs one stat per mod plus whatever genuinely moved — the
    // measured 180s load was inflated by 763 archives that had JUST been
    // re-downloaded and so had new mtimes.
    //
    // What reuse would also have skipped is noticing an archive was REPLACED,
    // and re-downloading archives is a normal thing to do between opening this
    // form and pressing Refresh. That is precisely when a carried-over hash is
    // wrong, and a refresh that can hand back a stale identity is not one.
    loadBuildContext.mockResolvedValueOnce(ctx("refreshed"));
    const { s } = sessionOnForm();

    s.refreshContext(api);
    await settle();

    expect(loadBuildContext).toHaveBeenCalledTimes(1);
    const opts = (loadBuildContext.mock.calls[0]![1] ?? {}) as Record<string, unknown>;
    expect(opts.reuseMods).toBeUndefined();
    expect(Object.keys(opts)).toEqual(["signal"]);
  });

  it("leaves no reuse hatch anywhere in the loader", () => {
    // A rejected option that stays in the codebase gets used by the next
    // person who finds the button slow.
    const engine = readFileSync(join(__dirname, "engine.ts"), "utf8");
    expect(engine).not.toContain("reuseMods");
  });
});
