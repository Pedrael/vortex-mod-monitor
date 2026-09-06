/**
 * ──────────────────────────────────────────────────────────────────────
 * Dropping SOME LOOT rules is routine. Dropping ALL of them is a symptom.
 *
 * `buildUserlist` scopes the curator's LOOT plugin rules to the plugins the
 * collection actually ships, and drops the rest without a word. That is
 * correct: a curator keeps rules on far more plugins than they bundle, and
 * warning per rule would bury the real ones.
 *
 * It stops being correct when the plugin order is EMPTY, because then the
 * reason is not "these rules are about other plugins" — it is "we could not
 * read plugins.txt at all". A real GOG Skyrim SE build hit exactly that: the
 * store-relocated folder made the order empty, and this loop then discarded
 * every LOOT rule the curator had, silently, because each individual drop
 * looked like the ordinary case. One unreadable file, three separate losses.
 * ──────────────────────────────────────────────────────────────────────
 */
import { describe, expect, it } from "vitest";

import { buildManifest } from "./buildManifest";

function build(args: {
  pluginsTxt?: string;
  userlistPlugins: { name: string; after?: string[] }[];
}): { warnings: string[] } {
  return buildManifest({
    snapshot: {
      gameId: "fallout4",
      mods: [],
      userlist: { plugins: args.userlistPlugins, groups: [] },
    } as never,
    package: {
      id: "00000000-0000-4000-8000-000000000000",
      name: "t",
      version: "1.0.0",
      author: "a",
    },
    game: { version: "1.10.163" },
    vortex: { version: "2.6.0", deploymentMethod: "hardlink" },
    ...(args.pluginsTxt !== undefined ? { pluginsTxtContent: args.pluginsTxt } : {}),
  } as never);
}

describe("scoping LOOT rules to the shipped plugins", () => {
  it("says nothing when only SOME rules are out of scope", () => {
    // The ordinary case. One shipped plugin, one rule about a plugin the
    // collection does not contain.
    const { warnings } = build({
      pluginsTxt: "*Shipped.esp\n",
      userlistPlugins: [{ name: "Shipped.esp" }, { name: "TheirOwn.esp" }],
    });
    expect(warnings.join(" ")).not.toMatch(/LOOT plugin rule/);
  });

  it("warns when EVERY rule is dropped for want of a plugin order", () => {
    // No plugins.txt content at all — the shape the store bug produced.
    const { warnings } = build({
      userlistPlugins: [{ name: "A.esp" }, { name: "B.esp" }, { name: "C.esp" }],
    });
    const said = warnings.join(" ");
    expect(said).toMatch(/None of the 3 LOOT plugin rule/);
    expect(said).toMatch(/no plugin order/);
    // Points at the actual cause rather than leaving them to guess.
    expect(said).toMatch(/plugins-txt\.not-found/);
  });

  it("stays quiet when there are no rules to lose", () => {
    // An empty order with an empty userlist is not a symptom of anything.
    const { warnings } = build({ userlistPlugins: [] });
    expect(warnings.join(" ")).not.toMatch(/LOOT plugin rule/);
  });
});
