/**
 * ──────────────────────────────────────────────────────────────────────
 * "Your staging has files this mod's archive cannot produce. Now what?"
 *
 * The build finds these; this module decides what the curator is actually
 * being asked, and what each answer does.
 *
 * ─── THE QUESTION IS NOT "WAS THIS DELIBERATE" ─────────────────────────
 * That was the first framing and it is the wrong one, because "yes, I ran
 * xLODGen" is true for almost every case here and answering it changes
 * nothing useful. The question that decides the outcome is:
 *
 *     DO THE PEOPLE INSTALLING THIS COLLECTION NEED THOSE FILES?
 *
 * Both answers are common and they have opposite fixes:
 *
 *   - No  → generator output, a repacked BA2, a cleaned plugin. Machine-local
 *           work. Declare it, and users install the archive without them.
 *   - Yes → a patch dropped into the folder, an edit the setup depends on.
 *           Declaring would make users silently go without it. Ship the bytes.
 *
 * ─── WHY THIS MATTERS MORE THAN IT LOOKS ───────────────────────────────
 * A curator clicking "declare" down the whole list without reading is not
 * being lazily harmless. They are promising users a collection that
 * reproduces their game while quietly withholding the parts they added — and
 * it will not fail, or warn, or show up in a diff. It reproduces perfectly
 * except for the files that made the setup theirs.
 *
 * So the UI shows the actual paths, offers no bulk action, and starts every
 * mod undecided. The cost of that is a curator reading six file names per
 * mod. The cost of the alternative is silent, permanent and shipped.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { ExternalModConfigEntry } from "../../../core/manifest/collectionConfig";

export type PostProcessingChoice =
  /** The files are the curator's own. Users install the archive without them. */
  | "declare"
  /** The files matter. Pack the staging folder and ship it. */
  | "bundle";

/**
 * The config override each answer writes.
 *
 * `bundle` sets `treatAsExternal` too when the mod came from Nexus. Bundling
 * is gated on a mod shipping as external (`shipsAsExternal`), and a Nexus mod
 * is not external until that flag says so — setting `bundled` alone would be
 * a decision the build then silently ignores, which is the failure mode this
 * whole area already had once.
 */
export function overrideForChoice(
  choice: PostProcessingChoice,
  opts: { isNexusMod: boolean },
): Partial<ExternalModConfigEntry> {
  if (choice === "declare") {
    return { postProcessed: true };
  }
  return {
    bundled: true,
    ...(opts.isNexusMod ? { treatAsExternal: true } : {}),
  };
}

export type ChoiceCopy = {
  label: string;
  /** What happens to the people installing this. Never what happens to a flag. */
  consequence: string;
};

/**
 * The wording IS the feature here, so it is tested like one.
 *
 * Both options are phrased from the INSTALLER's side. "Mark as post-processed"
 * describes a checkbox; "users install this mod without those files" describes
 * what the curator is about to do to someone, which is the thing they are
 * qualified to have an opinion about.
 */
export function describeChoice(
  choice: PostProcessingChoice,
  fileCount: number,
): ChoiceCopy {
  const n = `${fileCount} file${fileCount === 1 ? "" : "s"}`;
  if (choice === "declare") {
    return {
      label: "These files are mine — users don't need them",
      consequence:
        `Users install this mod from its archive, without your ${n}. Right ` +
        `for xLODGen or DynDOLOD output, a BA2 you repacked, or a plugin you ` +
        `cleaned: work that belongs to your machine.`,
    };
  }
  return {
    label: "These files matter — ship my copy",
    consequence:
      `Packs your whole staging folder into the collection so users get the ` +
      `${n} too. Right if you dropped in a patch or an edit the setup needs. ` +
      `Makes the download bigger by the size of the folder.`,
  };
}

/**
 * The heading a curator reads before answering anything.
 *
 * Says what was found, in terms of a fact about their disk rather than a
 * verdict, then states the actual question. A curator who reads only this
 * should already know that the two answers are not interchangeable.
 */
export function describeDecisionIntro(modCount: number): {
  title: string;
  what: string;
  question: string;
  ifIgnored: string;
  caution: string;
} {
  const mods = `${modCount} mod${modCount === 1 ? "" : "s"}`;
  return {
    title: `${mods} need${modCount === 1 ? "s" : ""} a decision`,
    what:
      `Their staging folders hold files that their own archives do not ` +
      `contain. Users install from those archives, so there is no way for ` +
      `them to end up with these files.`,
    question: "Do the people installing this collection need them?",
    ifIgnored:
      `Leaving one undecided is not neutral: the file is recorded as ` +
      `required, every user fails the integrity check, the mod is ` +
      `reinstalled once, fails identically, and is recorded as broken.`,
    // The line that exists because the cheap answer is one click and always
    // available.
    caution:
      `Answer these one at a time, and look at the file names. Marking them ` +
      `all as yours is quick and it is the one outcome worse than ignoring ` +
      `them: your collection would install cleanly for everyone while ` +
      `silently leaving out the files you added.`,
  };
}
