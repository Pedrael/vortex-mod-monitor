/**
 * ──────────────────────────────────────────────────────────────────────
 * "No deployment method active" — the failure that wastes a whole evening.
 *
 * Vortex links staged mods into the game folder using a DEPLOYMENT METHOD
 * (hardlinks, symlinks, or copying). When none is usable, mods still download
 * and stage perfectly and nothing reaches the game. Vortex's own code:
 *
 *     const activator = activatorId !== undefined
 *       ? activators.find(act => act.id === activatorId)
 *       : activators.find(act => allTypesSupported(...).errors.length === 0);
 *     if (activator === undefined)
 *       throw new ProcessCanceled("No deployment method active");
 *
 * ─── WHY THIS FILE EXISTS ──────────────────────────────────────────────
 * A tester's run hit it on mod 489 of 967 — and the driver treated it as one
 * bad mod, carried on for another 478, and died at the end. Seventy minutes,
 * no receipt, no collection. The information needed to stop was in the very
 * first failure.
 *
 * It is not a property of the mod. It is a property of the MACHINE, so the
 * second mod will fail exactly like the first and so will the nine hundredth.
 * The only useful thing to do with it is stop and say so.
 *
 * ─── AND IT DOES NOT MEAN THE USER CANCELLED ANYTHING ──────────────────
 * Vortex raises it as `ProcessCanceled`, and our error formatter matched any
 * message containing "cancel" and reported "Operation cancelled — canceled by
 * user". Nobody cancelled anything; the tester was asleep. A misleading
 * diagnosis is worse than a raw stack trace, because it stops the reader
 * looking.
 *
 * Common on Linux/Proton specifically: hardlink deployment needs the staging
 * folder and the game folder on one filesystem, which a Proton prefix often
 * breaks.
 * ──────────────────────────────────────────────────────────────────────
 */

/** Vortex's message, matched as a substring because it is thrown verbatim. */
const MARKER = "no deployment method active";

/**
 * Is this the machine-level deployment failure rather than a mod problem?
 *
 * Matched on the message, not the error class: Vortex throws `ProcessCanceled`
 * here, and that class is also used for genuinely unrelated things — treating
 * every `ProcessCanceled` as this would abort installs for the wrong reason.
 */
export function isDeploymentMethodMissing(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : String((err as { message?: unknown })?.message ?? "");
  return msg.toLowerCase().includes(MARKER);
}

/**
 * What Vortex has selected for this game, if anything.
 *
 * Reads the same state path Vortex reads. `undefined` is NOT proof of trouble:
 * Vortex falls back to auto-picking any method that supports the game's mod
 * types, and for most users that works. It is a reason to warn, never to
 * block — the check that can actually prove the problem is the deployment
 * itself, which is why the fatal path keys off the real failure instead.
 */
export function selectedDeploymentMethod(
  state: unknown,
  gameId: string,
): string | undefined {
  const activator = (
    state as {
      settings?: { mods?: { activator?: Record<string, unknown> } };
    }
  )?.settings?.mods?.activator?.[gameId];
  return typeof activator === "string" && activator.length > 0
    ? activator
    : undefined;
}

/**
 * The message shown when a run stops for this.
 *
 * Written for someone who has just lost an install and needs to know it was
 * not their collection, not their download, and not something they did.
 */
export function describeMissingDeploymentMethod(opts: {
  modName: string;
  atIndex: number;
  total: number;
  /** True on Linux/Proton, where this has a specific likely cause. */
  wine: boolean;
}): string {
  const base =
    `Stopped at mod ${opts.atIndex} of ${opts.total} ("${opts.modName}"): ` +
    `Vortex has no working deployment method for this game, so nothing can ` +
    `be linked into the game folder. Every remaining mod would fail the same ` +
    `way — this is a Vortex setting, not a problem with the collection or ` +
    `with your downloads, and nobody cancelled anything.`;

  const fix =
    ` Fix it in Vortex under Settings → Mods → Deployment Method, then run ` +
    `the install again. Mods already installed are skipped, so it picks up ` +
    `near where it stopped.`;

  const proton = opts.wine
    ? ` On Linux/Proton this is usually hardlink deployment: it needs the ` +
      `staging folder and the game folder on the SAME filesystem inside the ` +
      `prefix. Moving the staging folder next to the game, or switching the ` +
      `method, resolves it.`
    : "";

  return base + fix + proton;
}
