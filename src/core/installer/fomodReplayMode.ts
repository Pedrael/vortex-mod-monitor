/**
 * ──────────────────────────────────────────────────────────────────────
 * Silent or supervised? The user decides, once, before the install starts.
 *
 * The curator's FOMOD answers are always REPLAYED — that is not the choice.
 * The choice is whether Vortex stops and shows each installer with those
 * answers pre-filled, or applies them without asking.
 *
 * ─── WHY THIS IS A QUESTION AND NOT A DEFAULT ──────────────────────────
 * Both answers are defensible and they serve different people. Automation is
 * what most users of a 900-mod collection actually want: a tester's run had a
 * median per-mod time of 4ms against a 99th percentile of 491 SECONDS, all of
 * it a human reading dialogs. Supervision is what a careful user wants when
 * they intend to differ from the curator on purpose, or simply want to watch.
 *
 * Picking for them silently is the one option that is definitely wrong, so we
 * ask, and we explain what each answer costs.
 *
 * ─── THE CONSEQUENCE THAT HAS TO BE SAID OUT LOUD ──────────────────────
 * If the user is shown the dialogs and changes an answer, three things follow,
 * and only the first is obvious:
 *
 *   1. The install no longer reproduces the curator's setup. The curator
 *      cannot vouch for a combination they never tested.
 *   2. The receipt records the RESULT, not the answers. It stores a
 *      stagingSetHash, so a deviation is baked in as the new baseline and the
 *      Collection Doctor will call it healthy.
 *   3. Healing works from the MANIFEST, which still holds the curator's
 *      answers. So a later "reinstall this mod" in the Doctor restores the
 *      curator's choice and quietly undoes the user's deliberate one.
 *
 * Point 3 is the trap. Two different reference points — the receipt for
 * diagnosis, the manifest for repair — agree perfectly until someone deviates,
 * and then the disagreement surfaces as the Doctor "fixing" something the user
 * meant. Telling them up front is cheaper than any amount of cleverness later.
 * ──────────────────────────────────────────────────────────────────────
 */

/** Whether Vortex shows each FOMOD installer during the install. */
export type FomodReplayMode = "silent" | "supervised";

export const DEFAULT_FOMOD_REPLAY_MODE: FomodReplayMode = "silent";

/** Does this mode bypass Vortex's FOMOD dialog? */
export function isUnattended(mode: FomodReplayMode): boolean {
  return mode === "silent";
}

export interface FomodModeOption {
  mode: FomodReplayMode;
  title: string;
  /** One line under the title. */
  blurb: string;
  /** Bullets, in the order a user should read them. */
  points: string[];
  /** Shown only for the option that carries a caveat. */
  caution?: string;
  recommended: boolean;
}

/**
 * The two options, written for someone who has never heard the word FOMOD.
 *
 * `modCount` is threaded in because "930 installers" is the argument. An
 * abstract "some mods have installers" does not convey what supervising them
 * actually costs an evening.
 */
export function describeFomodModes(modsWithChoices: number): FomodModeOption[] {
  const many = modsWithChoices >= 25;
  return [
    {
      mode: "silent",
      title: "Apply the curator's answers automatically",
      blurb:
        modsWithChoices > 0
          ? `${modsWithChoices} mod${modsWithChoices === 1 ? "" : "s"} in this collection ` +
            `${modsWithChoices === 1 ? "has an installer" : "have installers"}. ` +
            `Their questions are answered for you.`
          : "Installers are answered for you, if any turn up.",
      points: [
        "The install runs start to finish without stopping for you.",
        "You get exactly the setup the curator tested.",
        ...(many
          ? ["Noticeably faster — Vortex skips the dialog work entirely."]
          : []),
      ],
      recommended: true,
    },
    {
      mode: "supervised",
      title: "Show me each installer",
      blurb:
        "Every installer opens with the curator's answers already selected. " +
        "You confirm, or change them.",
      points: [
        "You see exactly what each mod is installing.",
        "You can deliberately differ from the curator where you want to.",
        modsWithChoices > 0
          ? `Expect to click through ${modsWithChoices} dialog${modsWithChoices === 1 ? "" : "s"}.`
          : "You will be asked whenever a mod has an installer.",
      ],
      caution:
        "If you change an answer, this is no longer the curator's setup and " +
        "they cannot vouch for it. The Collection Doctor also repairs from " +
        "the collection, not from what you picked — so healing that mod later " +
        "will restore the curator's answer and undo your change.",
      recommended: false,
    },
  ];
}

/**
 * The line to record in the receipt and show afterwards.
 *
 * Worth keeping even when nothing went wrong: six months later, "why does this
 * mod differ from the curator's?" is answerable only if we wrote down that the
 * user was driving.
 */
export function describeChosenMode(
  mode: FomodReplayMode,
  modsWithChoices: number,
): string {
  return mode === "silent"
    ? `The curator's answers were applied automatically to ${modsWithChoices} installer${modsWithChoices === 1 ? "" : "s"}.`
    : `You were shown ${modsWithChoices} installer${modsWithChoices === 1 ? "" : "s"} and could change the curator's answers. ` +
        `Any change you made is not part of the collection, and healing that mod restores the curator's answer.`;
}
