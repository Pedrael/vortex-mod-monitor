/**
 * ──────────────────────────────────────────────────────────────────────
 * Automatic deployment must be off before a collection install.
 *
 * Vortex's auto-deploy runs a deployment whenever the active mod set changes.
 * That is a sensible default when you install a mod or two by hand. Against a
 * 967-mod collection it means up to 967 deployments — each one walking the
 * whole staging folder and relinking it into the game directory — for one
 * useful result at the end.
 *
 * ─── WHY IT IS FATAL AND NOT MERELY SLOW ───────────────────────────────
 * Time is the visible half. The half that corrupts is that the driver does its
 * OWN deploy at a specific point: after the mod rules and the LOOT userlist
 * are applied, before the load order is pinned. Those rules decide which mod
 * wins a shared file, so a deployment that runs BEFORE them links the wrong
 * winner into the game folder — and auto-deploy fires exactly that, mid-run,
 * while mods are still being written.
 *
 * The result is the failure this project exists to prevent: every file
 * verifies, every hash matches, and the game loads something the curator never
 * had. Nothing errors, and nothing downstream can see it.
 *
 * ─── SO IT IS A GATE, AND ONE WE CAN ACTUALLY CLOSE ────────────────────
 * Unlike a dead extractor or a missing deployment method, this one is a single
 * boolean we are able to set. Offering to set it beats describing a settings
 * page — but it is still the user's Vortex, so it is offered rather than done,
 * and it stays off afterwards rather than being silently restored. A setting
 * quietly changed back at the end of an hour-long run is a worse surprise than
 * one left where the user agreed to put it.
 * ──────────────────────────────────────────────────────────────────────
 */

/** Vortex's own state path, read out of its bundle rather than guessed. */
export function readsAutoDeploy(state: unknown): boolean | undefined {
  const value = (
    state as { settings?: { automation?: { deploy?: unknown } } }
  )?.settings?.automation?.deploy;
  return typeof value === "boolean" ? value : undefined;
}

/**
 * Should the install be stopped for this?
 *
 * Only a definite `true` blocks. A setting we cannot read is NOT "off" — but
 * it is not grounds to stop someone either, and the same fail-open rule the
 * deployment-method gate uses applies here: refusing a working install because
 * a check could not run does more damage than the thing it guards against.
 */
export function blocksInstall(state: unknown): boolean {
  return readsAutoDeploy(state) === true;
}

/**
 * What the user is told, and what they are agreeing to.
 *
 * Leads with the consequence rather than the mechanism: "deploys after every
 * mod" means nothing to someone who has never watched it happen, while "the
 * game loads something the curator never had" is the part they care about.
 */
export function describeAutoDeployBlock(modCount: number): {
  title: string;
  body: string;
  confirm: string;
  decline: string;
} {
  const scale = modCount > 0 ? `${modCount} mods` : "a collection";
  return {
    title: "Turn off automatic deployment first",
    body: [
      `Vortex is set to deploy automatically, which runs a full deployment ` +
        `every time the mod list changes. Installing ${scale} would trigger ` +
        `that over and over.`,
      `Worse than slow: one of those deployments can land before the ` +
        `collection's conflict rules are applied, and those rules decide ` +
        `which mod wins a shared file. That is the failure this tool exists ` +
        `to prevent — every file verifies, and the game still loads ` +
        `something the curator never had.`,
      `Event Horizon deploys once, at the right point in the install.`,
      `This changes a Vortex setting, and it stays off afterwards. The ` +
        `toggle is "Deploy Mods when Enabled", under Automation in Vortex's ` +
        `settings.`,
    ].join("\n\n"),
    confirm: "Turn it off and install",
    decline: "Cancel",
  };
}
