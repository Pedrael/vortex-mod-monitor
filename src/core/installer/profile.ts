/**
 * Vortex profile lifecycle helpers — Phase 3 slice 6.
 *
 * The driver isolates fresh-profile installs by creating a brand-new
 * Vortex profile, switching into it, and only enabling collection mods
 * there. The user's other profiles are never touched.
 *
 * Spec: docs/business/INSTALL_DRIVER.md (§ Profile lifecycle)
 *
 * ─── DESIGN NOTES ──────────────────────────────────────────────────────
 *  • Profile ids are random UUIDs. Vortex doesn't enforce any specific
 *    format — it uses `shortid` internally but treats the id as opaque.
 *    Crypto-strong UUIDs avoid collision worries entirely.
 *
 *  • `setNextProfile` is the *only* way to switch profiles cleanly.
 *    Vortex listens for the dispatch and runs full activation
 *    (purge → switch → activate). The handler is async; we wait for the
 *    canonical `profile-did-change` event documented in
 *    https://github.com/Nexus-Mods/vortex-api/blob/master/docs/EVENTS.md.
 *
 *  • Name collision handling is best-effort. If "Event Horizon — Foo"
 *    already exists we append " (2)", " (3)", etc. The user can rename
 *    later in Vortex's UI; the driver never blocks on this.
 * ──────────────────────────────────────────────────────────────────────
 */

import { randomUUID } from "crypto";
import { actions, types } from "vortex-api";

const PROFILE_SWITCH_TIMEOUT_MS = 30_000;

/**
 * Create a brand-new, empty Vortex profile and dispatch it into the
 * Redux store. The profile is created BUT NOT switched into — the
 * caller drives the switch via {@link switchToProfile}.
 *
 * @returns the profile descriptor that was created.
 */
export function createFreshProfile(
  api: types.IExtensionApi,
  gameId: string,
  suggestedName: string,
): { id: string; name: string } {
  const state = api.getState();
  const finalName = pickNonCollidingName(state, gameId, suggestedName);
  const id = randomUUID();

  const profile: types.IProfile = {
    id,
    gameId,
    name: finalName,
    modState: {},
    lastActivated: 0,
  };

  api.store?.dispatch(actions.setProfile(profile));

  return { id, name: finalName };
}

/**
 * Dispatch a profile switch and wait for Vortex to finish activating
 * the new profile (deployments purged + new profile applied).
 *
 * @throws if the switch doesn't complete within
 *   `PROFILE_SWITCH_TIMEOUT_MS` ms — usually means Vortex hit a
 *   deployment lock the user must resolve manually.
 */
export async function switchToProfile(
  api: types.IExtensionApi,
  profileId: string,
): Promise<void> {
  const state = api.getState();
  const currentProfileId =
    state.settings?.profiles?.activeProfileId ?? state.settings?.profiles?.nextProfileId;

  if (currentProfileId === profileId) {
    return; // already active — no-op
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      api.events.removeListener("profile-did-change", onChange);
      reject(
        new Error(
          `Profile switch to "${profileId}" did not complete within ` +
            `${PROFILE_SWITCH_TIMEOUT_MS}ms. Check Vortex's notifications for ` +
            `a stuck deployment.`,
        ),
      );
    }, PROFILE_SWITCH_TIMEOUT_MS);

    const onChange = (newProfileId: string): void => {
      if (newProfileId !== profileId || settled) return;
      settled = true;
      clearTimeout(timeout);
      api.events.removeListener("profile-did-change", onChange);
      resolve();
    };

    api.events.on("profile-did-change", onChange);

    api.store?.dispatch(actions.setNextProfile(profileId));
  });
}

/**
 * Enable a mod inside a specific profile. Pure dispatch; does NOT
 * trigger deploy on its own (driver batches enables, then deploys
 * once at the end of the install).
 */
export function enableModInProfile(
  api: types.IExtensionApi,
  profileId: string,
  modId: string,
): void {
  api.store?.dispatch(actions.setModEnabled(profileId, modId, true));
}

// ===========================================================================
// Helpers
// ===========================================================================

/**
 * Walk the existing profile list for `gameId` and pick a name that
 * doesn't collide. Appends `" (2)"`, `" (3)"`, … until unique.
 */
export function pickNonCollidingName(
  state: types.IState,
  gameId: string,
  base: string,
): string {
  const profiles = state.persistent?.profiles ?? {};

  const existingNames = new Set<string>(
    Object.values(profiles)
      .filter((p): p is types.IProfile => Boolean(p) && p.gameId === gameId)
      .map((p) => p.name),
  );

  if (!existingNames.has(base)) return base;

  for (let suffix = 2; suffix < 1000; suffix++) {
    const candidate = `${base} (${suffix})`;
    if (!existingNames.has(candidate)) return candidate;
  }

  // Fallback — astronomically unlikely. Random suffix avoids infinite loop.
  return `${base} ${Date.now()}`;
}
