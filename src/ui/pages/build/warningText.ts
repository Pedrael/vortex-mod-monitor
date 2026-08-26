/**
 * Turning a build warning into something scannable.
 *
 * The warnings are written as prose on purpose — each one explains what
 * happened, why it matters and what to do, because a curator meeting
 * "9 external mods no longer match" for the first time needs all three. But
 * ten of those rendered as ten paragraphs is a wall, and a wall is skimmed,
 * which loses the one warning that mattered.
 *
 * Every warning already has the shape: a first sentence that says WHAT, and a
 * remainder that says why and what to do. Splitting there gives a list you can
 * run your eye down, with the explanation one click away.
 *
 * Pure and separate from the component so the awkward inputs — an abbreviation
 * mid-sentence, a bulleted detail block, a warning that is only one sentence —
 * are testable without rendering anything.
 */

export type WarningParts = {
  /** The scannable line. Always non-empty. */
  headline: string;
  /** Everything else, or empty when the warning is a single sentence. */
  detail: string;
};

/**
 * Abbreviations whose full stop does NOT end a sentence.
 *
 * Without these, "e.g. Fallout4.esm" splits after "e.g." and the headline
 * becomes a fragment. The list is short because the warnings are ours; it
 * covers what they actually use.
 */
const NOT_SENTENCE_END = ["e.g.", "i.e.", "vs.", "etc.", "no."];

/**
 * Split a warning into a headline and the rest.
 *
 * A detail block that starts on its own line (the per-mod bullets) is kept
 * whole rather than sentence-split: those lines are already a list, and
 * chopping the first bullet onto the headline would read as nonsense.
 */
export function splitWarning(text: string): WarningParts {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { headline: "", detail: "" };

  // A newline is the strongest signal the author already separated summary
  // from detail — respect it over any sentence heuristic.
  const newline = trimmed.indexOf("\n");
  if (newline !== -1) {
    return {
      headline: trimmed.slice(0, newline).trim(),
      detail: trimmed.slice(newline + 1).trim(),
    };
  }

  const end = firstSentenceEnd(trimmed);
  if (end === -1) return { headline: trimmed, detail: "" };
  return {
    headline: trimmed.slice(0, end + 1).trim(),
    detail: trimmed.slice(end + 1).trim(),
  };
}

/** Index of the full stop that ends the first sentence, or -1. */
function firstSentenceEnd(text: string): number {
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch !== "." && ch !== "?" && ch !== "!") continue;
    // A sentence ends when whitespace follows; "1.10.163" and "Fallout4.esm"
    // do not.
    const next = text[i + 1];
    if (next !== undefined && next !== " " && next !== "\n") continue;
    const upTo = text.slice(0, i + 1).toLowerCase();
    if (NOT_SENTENCE_END.some((abbr) => upTo.endsWith(abbr))) continue;
    // A one-word "sentence" is a false positive from a stray dot.
    if (i < 12) continue;
    return i;
  }
  return -1;
}

/**
 * A rough severity, from the words the warning uses.
 *
 * Deliberately coarse. The point is to let a curator see at a glance which
 * lines are "something did not ship" versus "here is a note", not to build a
 * taxonomy nobody maintains.
 */
export type WarningTone = "blocking" | "attention" | "note";

export function warningTone(text: string): WarningTone {
  const t = text.toLowerCase();
  if (
    t.includes("will not ship") ||
    t.includes("not bundled") ||
    t.includes("could not") ||
    t.includes("cannot")
  ) {
    return "blocking";
  }
  if (
    t.includes("no longer match") ||
    t.includes("is missing") ||
    t.includes("weaker") ||
    t.includes("not replay")
  ) {
    return "attention";
  }
  return "note";
}
