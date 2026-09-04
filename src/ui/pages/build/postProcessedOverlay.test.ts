/**
 * The curator's post-processing declarations, applied to the mod set.
 *
 * This began as a `.map()` inside `runBuildPipeline` that read
 * `collectionConfig` from the enclosing scope — fifty-seven lines before that
 * variable was declared. It compiled cleanly and threw the moment anyone
 * pressed Build:
 *
 *     ReferenceError: Cannot access 'collectionConfig' before initialization
 *
 * TypeScript catches exactly this mistake when the reference is direct, and it
 * did so twice elsewhere in the same file during the same session. It cannot
 * catch it through a closure, because it cannot prove when the callback runs.
 *
 * So the config is a PARAMETER now. Moving the call back above the declaration
 * is TS2448 again, verified. The extraction is the fix; this file exists
 * because a function taking its inputs as arguments is also the only version
 * of this logic that could ever be tested.
 */
import { describe, expect, it } from "vitest";

import { applyPostProcessedDeclarations } from "./engine";
import type { AuditorMod } from "../../../core/getModsListForProfile";
import type { CollectionConfig } from "../../../core/manifest/collectionConfig";

const mod = (id: string): AuditorMod => ({ id, name: id }) as AuditorMod;

const config = (externalMods: Record<string, unknown>): CollectionConfig =>
  ({ schemaVersion: 1, packageId: "p", externalMods }) as CollectionConfig;

describe("applying the declarations", () => {
  it("marks a mod the curator declared", () => {
    const [out] = applyPostProcessedDeclarations(
      [mod("xlodgen")],
      config({ xlodgen: { postProcessed: true } }),
    );
    expect(out!.postProcessed).toBe(true);
  });

  it("leaves every other mod untouched", () => {
    const out = applyPostProcessedDeclarations(
      [mod("a"), mod("b")],
      config({ a: { postProcessed: true } }),
    );
    expect(out[0]!.postProcessed).toBe(true);
    expect(out[1]!.postProcessed).toBeUndefined();
  });

  it("ignores an entry that exists but does not declare it", () => {
    // An external-source override with a URL is not a post-processing answer.
    const [out] = applyPostProcessedDeclarations(
      [mod("a")],
      config({ a: { url: "https://example.invalid" } }),
    );
    expect(out!.postProcessed).toBeUndefined();
  });

  it("treats false as not declared", () => {
    const [out] = applyPostProcessedDeclarations(
      [mod("a")],
      config({ a: { postProcessed: false } }),
    );
    expect(out!.postProcessed).toBeUndefined();
  });

  it("copies rather than mutating the input", () => {
    // The caller keeps `context.mods` for the membership diff; mutating it
    // would make a later comparison see the change it is looking for.
    const input = [mod("a")];
    const out = applyPostProcessedDeclarations(
      input,
      config({ a: { postProcessed: true } }),
    );
    expect(input[0]!.postProcessed).toBeUndefined();
    expect(out[0]).not.toBe(input[0]);
  });

  it("handles an empty config and an empty mod list", () => {
    expect(applyPostProcessedDeclarations([], config({}))).toEqual([]);
    expect(
      applyPostProcessedDeclarations([mod("a")], config({}))[0]!.postProcessed,
    ).toBeUndefined();
  });
});
