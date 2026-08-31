/**
 * Handing the curator's FOMOD answers back to Vortex.
 *
 * ## How the signature was established
 *
 * Vortex's events are untyped and `start-install-download` appears nowhere in
 * `api.d.ts`, so the shape could not be read from the package. It was observed
 * instead: a passive listener recorded Vortex's OWN calls during a real
 * install, and it passes
 *
 *   start-install-download(downloadId, { allowAutoEnable, choices }, cb)
 *
 * with `cb` of arity 2 — `(err, modId)`. That is the mechanism, watched rather
 * than guessed, which matters because the listener wrapper is a transparent
 * `(...args) => cb(...args)` shim: extra arguments are forwarded silently, so
 * a wrong guess would install every mod with default options while appearing
 * to replay the curator's.
 *
 * ## What gets sent
 *
 * `IChoiceType` is `{ type, options }`. `options` is the recorded selection
 * tree; `type` says which installer's answer format it is. Both come from the
 * manifest — see `installerChoicesType`, captured for exactly this.
 */

import type { FomodSelectionStep } from "../getModsListForProfile";
import type { EhcollMod } from "../../types/ehcoll";

/** Vortex's `IChoiceType`, as its installer expects it. */
export type VortexInstallerChoices = {
  type: string;
  options: FomodSelectionStep[];
};

/**
 * Fallback for manifests built before `installerChoicesType` was captured.
 *
 * Every recorded selection in the wild came from Vortex's FOMOD installer —
 * that is the only installer that asks questions — so this is the right guess
 * for old packages. New ones carry the real value and never reach it.
 */
const LEGACY_CHOICE_TYPE = "fomod";

/**
 * The choices to replay for a mod, or `undefined` when there are none.
 *
 * Returning `undefined` is load-bearing: the caller then makes the exact call
 * it made before this feature existed. A mod with nothing recorded must not
 * take a different code path just because replay is now possible.
 */
export function choicesFor(entry: EhcollMod | undefined): VortexInstallerChoices | undefined {
  const selections = entry?.install?.fomodSelections ?? [];
  if (selections.length === 0) return undefined;

  // A step with no chosen option in any group answers nothing; sending it
  // would claim the curator made a choice they did not make.
  const answered = selections.some((step) =>
    step.groups.some((group) => group.choices.length > 0),
  );
  if (!answered) return undefined;

  return {
    type: entry?.install?.installerChoicesType ?? LEGACY_CHOICE_TYPE,
    options: selections,
  };
}

/**
 * The options bag for `start-install-download`.
 *
 * `allowAutoEnable: true` matches what the path this replaces did: installing
 * through `nexusDownload(..., allowInstall = true)` let Vortex enable the mod
 * as it normally would. The driver sets enablement itself afterwards from the
 * manifest, so this decides only the moment in between.
 */
/**
 * Should the curator's answers be applied WITHOUT showing the FOMOD dialog?
 *
 * Read out of the shipped Vortex bundle rather than guessed. Its installer:
 *
 *     const canBeUnattended =
 *       choices !== undefined && choices.type === "fomod";
 *     const shouldBypassDialog = canBeUnattended && unattended === true;
 *
 * and the install manager forwards `options.unattended` from the very option
 * bag we pass to `start-install-download`. So all three conditions are ours to
 * satisfy — we already supply `choices` with `type: "fomod"`.
 *
 * (The comment directly above that code says the dialog is bypassed
 * "regardless of unattended flag". It is not; the line beneath it requires
 * `unattended === true`. Trust the code.)
 *
 * Vortex's own note on the flag calls it "collection install with preset
 * choices" and points out it also skips dozens of main-thread callbacks per
 * mod — so on a 900-mod collection this is a speed change as well as a
 * quiet one.
 *
 * ─── WHY THIS IS THE DEFAULT ───────────────────────────────────────────
 * The curator already answered these questions, and that answer IS the
 * collection. Stopping to ask the user to re-confirm it invites them to
 * deviate from the thing they chose to reproduce, and it is the single
 * biggest source of friction in a large install: a tester's run showed
 * per-mod times with a median of 4ms and a 99th percentile of 491 SECONDS,
 * all of it a human reading dialogs, and six mods killed by the stall
 * watchdog while he did.
 *
 * Set to false to watch each step go past instead.
 */
export const REPLAY_FOMOD_SILENTLY = true;

export function installOptions(
  choices: VortexInstallerChoices,
  unattended: boolean = REPLAY_FOMOD_SILENTLY,
): {
  allowAutoEnable: boolean;
  choices: VortexInstallerChoices;
  unattended: boolean;
} {
  return { allowAutoEnable: true, choices, unattended };
}
