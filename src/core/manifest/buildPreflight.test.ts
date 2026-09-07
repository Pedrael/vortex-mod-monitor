/**
 * ──────────────────────────────────────────────────────────────────────
 * The two builds that must not happen, and the many that must.
 *
 * A gate that refuses too eagerly is worse than no gate: a curator who cannot
 * build and does not know why goes and uses something else. So most of these
 * tests are about what it lets THROUGH — an unknown flag, a disabled plugin,
 * a game whose light bit we cannot read.
 * ──────────────────────────────────────────────────────────────────────
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import { preflightRefusal, type PreflightPlugin } from "./buildPreflight";

/** N plugins, all enabled and regular unless told otherwise. */
const heavy = (n: number, over: Partial<PreflightPlugin> = {}): PreflightPlugin[] =>
  Array.from({ length: n }, (_v, i) => ({
    name: `p${i}.esp`,
    enabled: true,
    light: false,
    ...over,
  }));

describe("a build with no plugin order at all", () => {
  it("is refused for a game that keeps its order in plugins.txt", () => {
    // The shape the GOG folder bug produced ten times over.
    const r = preflightRefusal({
      gameId: "skyrimse",
      usesPluginsTxt: true,
      plugins: [],
    });
    expect(r?.code).toBe("no-plugin-order");
    // Actionable, not diagnostic: it says what to DO.
    expect(r?.message).toMatch(/Launch the game once/);
    expect(r?.message).toMatch(/plugins-txt\.not-found/);
    // And it says what it is NOT, because "you have no plugins" is the wrong
    // conclusion and the one a curator would otherwise draw.
    expect(r?.message).toMatch(/not "you have no plugins"/);
  });

  it("is allowed for a game that does not use plugins.txt", () => {
    // Refusing here would block every FBLO-style game over a file it never
    // writes.
    expect(
      preflightRefusal({
        gameId: "starfield",
        usesPluginsTxt: false,
        plugins: [],
      }),
    ).toBeUndefined();
  });
});

describe("the 254 regular-plugin limit", () => {
  it("refuses at 255 enabled heavy plugins", () => {
    const r = preflightRefusal({
      gameId: "skyrimse",
      usesPluginsTxt: true,
      plugins: heavy(255),
    });
    expect(r?.code).toBe("over-plugin-limit");
    expect(r?.message).toMatch(/255 enabled regular/);
    // Says how many must move, not just that it is too many.
    expect(r?.message).toMatch(/flagging 1 more/);
  });

  it("allows exactly 254", () => {
    // The limit is what the game can load, not one less.
    expect(
      preflightRefusal({
        gameId: "skyrimse",
        usesPluginsTxt: true,
        plugins: heavy(254),
      }),
    ).toBeUndefined();
  });

  it("does not count light plugins", () => {
    // The entire reason a 1600-plugin collection can exist.
    expect(
      preflightRefusal({
        gameId: "skyrimse",
        usesPluginsTxt: true,
        plugins: [...heavy(200), ...heavy(1400, { light: true })],
      }),
    ).toBeUndefined();
  });

  it("does not count disabled plugins", () => {
    // A disabled plugin is listed in plugins.txt and loads nothing, so it
    // occupies no index. Counting them would refuse working profiles.
    expect(
      preflightRefusal({
        gameId: "skyrimse",
        usesPluginsTxt: true,
        plugins: [...heavy(254), ...heavy(50, { enabled: false })],
      }),
    ).toBeUndefined();
  });

  it("does not count a plugin whose flag could not be read", () => {
    /**
     * The direction this gate must never fail in. An unreadable header is an
     * unknown, and treating unknowns as heavy would refuse a build over
     * files we simply could not open — a locked game folder becomes "your
     * collection is broken".
     */
    expect(
      preflightRefusal({
        gameId: "skyrimse",
        usesPluginsTxt: true,
        plugins: [...heavy(200), ...heavy(300, { light: undefined })],
      }),
    ).toBeUndefined();
  });

  it("does not judge Starfield's budget at all", () => {
    /**
     * Starfield uses a different header bit for light, which this codebase
     * does not read — pluginFlags.ts says so where the constant is defined.
     * So every Starfield plugin would look regular, and a large profile would
     * be refused for a limit it may not even breach. An unknown must not
     * become a refusal.
     */
    expect(
      preflightRefusal({
        gameId: "starfield",
        usesPluginsTxt: true,
        plugins: heavy(900),
      }),
    ).toBeUndefined();
  });

  it("does not judge a game it has never heard of", () => {
    expect(
      preflightRefusal({
        gameId: "morrowind",
        usesPluginsTxt: true,
        plugins: heavy(900),
      }),
    ).toBeUndefined();
  });
});

describe("the ordinary build", () => {
  it("passes a healthy profile untouched", () => {
    // The shape of the curator's real 1.0.10 package: 1607 plugins, 1421
    // light, 186 enabled regular.
    expect(
      preflightRefusal({
        gameId: "skyrimse",
        usesPluginsTxt: true,
        plugins: [...heavy(186), ...heavy(1421, { light: true })],
      }),
    ).toBeUndefined();
  });
});

describe("the refusal reaches the curator as guidance, not as a crash", () => {
  it("is routed to the form's validation channel, not the error state", () => {
    /**
     * A source tripwire, because the difference is invisible in a unit test
     * and very visible to a user: the error state renders a stack and a
     * "report this" button, and the report we would get back is "Event
     * Horizon crashed on build" for something the curator can fix in a
     * minute.
     */
    const src = readFileSync(
      join(__dirname, "..", "..", "ui", "pages", "build", "buildSession.ts"),
      "utf8",
    );
    const at = src.indexOf("BuildRefusedError");
    expect(at, "buildSession must handle BuildRefusedError").toBeGreaterThan(0);
    // The handling must come BEFORE the generic error state, or the generic
    // one wins and the refusal renders as a crash after all.
    expect(at).toBeLessThan(src.indexOf('kind: "error"', at));
    expect(src).toMatch(/validationError: \(err as Error\)\.message/);
  });
});
