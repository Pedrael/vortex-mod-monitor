/**
 * Test stub for `@nexusmods/vortex-api`.
 *
 * The real package is TYPES ONLY — no runtime `main`, no `.` export condition.
 * Vortex injects the implementation at load time through its own module hook, so
 * anything importing it is unloadable under vitest and the module is untestable
 * without this. That is why the first test file in this repo covered
 * `modIdentity`, the one core module that imports nothing from the API.
 *
 * Only the surface the tests actually exercise is implemented, and the
 * implementations mirror Vortex's real semantics rather than returning
 * placeholders — a stub that lies produces tests that pass against broken code.
 *
 * Wired up by `resolve.alias` in vitest.config.ts. Lives outside `src/` so `tsc`
 * never compiles it into `dist/`.
 */

/** Vortex keeps the active profile in settings, never on the profile object. */
export const selectors = {
  activeProfileId: (state: any): string | undefined =>
    state?.settings?.profiles?.activeProfileId,
  activeProfile: (state: any): any => {
    const id = state?.settings?.profiles?.activeProfileId;
    return id === undefined ? undefined : state?.persistent?.profiles?.[id];
  },
  activeGameId: (state: any): string | undefined =>
    state?.settings?.profiles?.activeGameId,
  installPathForGame: (): string => "/stub/install",
  downloadPathForGame: (): string => "/stub/downloads",
};

export const util = {
  getVortexPath: (id: string): string => `/stub/${id}`,
  installIconSet: (): Promise<void> => Promise.resolve(),
  getManifest: (): unknown => ({}),
  removeMods: (): Promise<void> => Promise.resolve(),
};

export const actions = {
  setModEnabled: () => ({ type: "STUB_SET_MOD_ENABLED" }),
  setLoadOrder: () => ({ type: "STUB_SET_LOAD_ORDER" }),
  addModRule: () => ({ type: "STUB_ADD_MOD_RULE" }),
  removeModRule: () => ({ type: "STUB_REMOVE_MOD_RULE" }),
  setNextProfile: () => ({ type: "STUB_SET_NEXT_PROFILE" }),
  setProfile: () => ({ type: "STUB_SET_PROFILE" }),
};

/** Swallowed by default so tests do not print. Reassign in a test to assert on it. */
export const log = (): void => {
  /* no-op */
};

export const types = {};
