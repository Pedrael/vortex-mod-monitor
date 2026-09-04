/**
 * ──────────────────────────────────────────────────────────────────────
 * "Did this mod come from Nexus?" — one definition, for the question that
 * has one answer.
 *
 * This predicate existed three times. Two of them — `engine.ts` and
 * `buildPackageAction.ts` — were byte-identical, and the second was private
 * and never imported the first, so a change to either would have silently
 * split the bundling gates apart. That is the copy this module replaces.
 *
 * ─── THE THIRD ONE IS NOT A DUPLICATE AND IS NOT MOVING ────────────────
 * `buildManifest.ts` asks a stricter question: it also requires
 * `mod.source === "nexus"`, because a manifest entry claiming a Nexus origin
 * has to be one Nexus can actually serve, not merely a mod carrying ids.
 * Unifying them was tried and reclassified every mod that had ids without a
 * source — see `shipsAsExternal.ts`'s header and `shipsAsExternal.test.ts`.
 *
 * So it keeps its own body and gets a name that says what it asks. Three
 * predicates sharing one name was the hazard; three predicates is fine.
 *
 * ─── WHY `core/identity` ───────────────────────────────────────────────
 * The old home was `src/ui/pages/build/engine.ts`, which meant
 * `src/actions/buildPackageAction.ts` would have had to import from a UI page
 * to stop duplicating it — a good reason to keep duplicating it. Identity is
 * a core concept and lives with `modIdentity.ts`.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { AuditorMod } from "../getModsListForProfile";

/**
 * Both ids present, both real numbers, both positive.
 *
 * `AuditorMod.nexusModId` is typed `number | string` because Vortex's
 * attributes are not normalised, so the `typeof` test is load-bearing rather
 * than decorative: a mod whose ids arrived as strings is NOT accepted here.
 * Measured on a real 939-mod profile every id was a number, so this is a
 * latent difference rather than a live one — but it is the reason sites that
 * test `!== undefined` or coerce with `Number()` can disagree with this
 * function, and why they should be asking this instead.
 */
export function isNexusSourced(
  mod: Pick<AuditorMod, "nexusModId" | "nexusFileId">,
): boolean {
  return (
    typeof mod.nexusModId === "number" &&
    typeof mod.nexusFileId === "number" &&
    mod.nexusModId > 0 &&
    mod.nexusFileId > 0
  );
}
