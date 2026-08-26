/**
 * Wrong instructions are worse than none. "Find the file on the page" against
 * a direct link sends someone looking for a page that never appears, and
 * "click to download" against a mod page has them waiting for a download that
 * never starts. Both leave them stuck on a screen that sounds confident.
 */
import { describe, expect, it } from "vitest";

import { describeDownload } from "./downloadGuidance";

describe("describeDownload", () => {
  it("tells a browse link to find the file on the page", () => {
    const g = describeDownload({
      url: "https://example.com/mods/42",
      mode: "browse",
      expectedFilename: "CoolMod.7z",
    });
    expect(g.canOpen).toBe(true);
    expect(g.action).toBe("Open the page");
    const said = g.steps.join(" ");
    expect(said).toMatch(/your own browser/);
    expect(said).toMatch(/"CoolMod\.7z"/);
  });

  it("does NOT tell a direct link to search a page", () => {
    // The link IS the file. Sending someone to look for it on a page they
    // will never see is the failure this distinction exists to prevent.
    const g = describeDownload({
      url: "https://example.com/f.7z",
      mode: "direct",
      expectedFilename: "f.7z",
    });
    expect(g.action).toBe("Start the download");
    const said = g.steps.join(" ");
    expect(said).toMatch(/straight to the file/);
    expect(said).not.toMatch(/from the page/);
  });

  it("points a manual download at the curator's notes first", () => {
    const g = describeDownload({
      url: "https://example.com/x",
      mode: "manual",
      expectedFilename: "x.zip",
    });
    expect(g.canOpen).toBe(true);
    expect(g.steps.join(" ")).toMatch(/manual download/);
  });

  it("treats an unknown mode as browse", () => {
    // An inferred link is far likelier to be a page than a direct file, and
    // "look for the file" degrades gracefully if a download starts anyway.
    // The reverse does not.
    const g = describeDownload({ url: "https://example.com/mods/9" });
    expect(g.action).toBe("Open the page");
  });

  it("offers nothing to open when there is no link", () => {
    const g = describeDownload({ mode: "browse", expectedFilename: "y.7z" });
    expect(g.canOpen).toBe(false);
    expect(g.action).toBe("");
    // And still says what to do, because the mod is still installable.
    expect(g.steps.join(" ")).toMatch(/pick it below/);
  });

  it("says \"the file\" rather than an empty name", () => {
    // A manifest without expectedFilename must not produce `""`.
    const g = describeDownload({ url: "https://e.com/a", expectedFilename: "" });
    const said = g.steps.join(" ");
    expect(said).toMatch(/the file/);
    expect(said).not.toMatch(/""/);
  });

  it("always ends by telling them to pick the file", () => {
    // Every branch has to land on the same next action, or the flow dead-ends
    // at "you now have a file" with no idea what to do with it.
    for (const mode of ["browse", "direct", "manual", undefined] as const) {
      const g = describeDownload({
        url: "https://e.com/a",
        ...(mode !== undefined ? { mode } : {}),
      });
      expect(g.steps.join(" "), String(mode)).toMatch(/pick/i);
    }
  });
});
