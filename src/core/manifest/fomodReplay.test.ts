import { describe, expect, it } from "vitest";

import type { FomodScript, RecordedStep } from "./fomodReplay";
import { replayFomod } from "./fomodReplay";
import { decodeModuleConfig, parseModuleConfig } from "./parseModuleConfig";

const spec = (source: string, extra: Partial<{ destination: string; priority: number; isFolder: boolean }> = {}) => ({
  source,
  priority: 0,
  isFolder: true,
  ...extra,
});

function script(over: Partial<FomodScript> = {}): FomodScript {
  return { requiredInstallFiles: [], steps: [], conditionalPatterns: [], ...over };
}

describe("replayFomod", () => {
  it("always includes requiredInstallFiles, even with no choices", () => {
    const r = replayFomod(script({ requiredInstallFiles: [spec("Core")] }), []);
    expect(r.sources.map((s) => s.source)).toEqual(["Core"]);
    expect(r.confidence).toBe("high");
  });

  it("resolves a choice by idx, which is what Vortex actually records", () => {
    const s = script({
      steps: [{
        name: "Theme",
        groups: [{
          name: "Body", type: "SelectExactlyOne",
          plugins: [
            { name: "Vanilla", idx: 0, files: [spec("bodies/vanilla")], flags: {} },
            { name: "Atomic Muscle", idx: 1, files: [spec("bodies/am")], flags: {} },
          ],
        }],
      }],
    });
    const recorded: RecordedStep[] = [
      { name: "Theme", groups: [{ name: "Body", choices: [{ name: "Atomic Muscle", idx: 1 }] }] },
    ];
    expect(replayFomod(s, recorded).sources.map((x) => x.source)).toEqual(["bodies/am"]);
  });

  it("prefers idx over a stale display name, and says so", () => {
    // A mod author fixing a typo in a plugin label must not silently change
    // which files we predict.
    const s = script({
      steps: [{
        name: "S", groups: [{
          name: "G", type: "SelectAny",
          plugins: [
            { name: "Renamed Option", idx: 0, files: [spec("zero")], flags: {} },
            { name: "Old Name", idx: 1, files: [spec("one")], flags: {} },
          ],
        }],
      }],
    });
    const r = replayFomod(s, [
      { name: "S", groups: [{ name: "G", choices: [{ name: "Old Name", idx: 0 }] }] },
    ]);
    expect(r.sources.map((x) => x.source)).toEqual(["zero"]);
    expect(r.confidence).toBe("low");
    expect(r.warnings.join(" ")).toMatch(/trusting index/i);
  });

  it("applies a conditional pattern when its flags are satisfied", () => {
    const s = script({
      steps: [{
        name: "S", groups: [{
          name: "G", type: "SelectAny",
          plugins: [{ name: "P", idx: 0, files: [spec("base")], flags: { AM: "true" } }],
        }],
      }],
      conditionalPatterns: [
        { flagDependencies: { AM: "true" }, files: [spec("patches/am")] },
        { flagDependencies: { AM: "false" }, files: [spec("patches/vanilla")] },
      ],
    });
    const r = replayFomod(s, [
      { name: "S", groups: [{ name: "G", choices: [{ name: "P", idx: 0 }] }] },
    ]);
    expect(r.sources.map((x) => x.source).sort()).toEqual(["base", "patches/am"]);
    expect(r.flags).toEqual({ AM: "true" });
  });

  it("does NOT collapse folders that share an empty destination", () => {
    // Regression: keying dedupe on destination alone reduced a real 25-choice
    // install from 30 folders to 1, because FOMOD folders overwhelmingly
    // install to the mod ROOT and so all share destination "".
    const s = script({
      steps: [{
        name: "S", groups: [{
          name: "G", type: "SelectAny",
          plugins: [
            { name: "A", idx: 0, files: [spec("folderA", { destination: "" })], flags: {} },
            { name: "B", idx: 1, files: [spec("folderB", { destination: "" })], flags: {} },
          ],
        }],
      }],
    });
    const r = replayFomod(s, [
      { name: "S", groups: [{ name: "G", choices: [{ name: "A", idx: 0 }, { name: "B", idx: 1 }] }] },
    ]);
    expect(r.sources.map((x) => x.source).sort()).toEqual(["folderA", "folderB"]);
  });

  it("drops an exact duplicate instruction", () => {
    const s = script({
      steps: [{
        name: "S", groups: [{
          name: "G", type: "SelectAny",
          plugins: [
            { name: "A", idx: 0, files: [spec("same")], flags: {} },
            { name: "B", idx: 1, files: [spec("same")], flags: {} },
          ],
        }],
      }],
    });
    const r = replayFomod(s, [
      { name: "S", groups: [{ name: "G", choices: [{ name: "A", idx: 0 }, { name: "B", idx: 1 }] }] },
    ]);
    expect(r.sources).toHaveLength(1);
  });

  it("downgrades confidence when a recorded step is absent from the script", () => {
    const r = replayFomod(script(), [{ name: "Ghost", groups: [] }]);
    expect(r.confidence).toBe("low");
    expect(r.warnings[0]).toMatch(/Ghost/);
  });

  it("downgrades confidence when a choice names no known plugin", () => {
    const s = script({
      steps: [{ name: "S", groups: [{ name: "G", type: "SelectAny", plugins: [] }] }],
    });
    const r = replayFomod(s, [
      { name: "S", groups: [{ name: "G", choices: [{ name: "Nope" }] }] },
    ]);
    expect(r.confidence).toBe("low");
  });

  it("matches step and group names case- and separator-insensitively", () => {
    const s = script({
      steps: [{
        name: "Theme", groups: [{
          name: "Body", type: "SelectAny",
          plugins: [{ name: "P", idx: 0, files: [spec("x")], flags: {} }],
        }],
      }],
    });
    const r = replayFomod(s, [
      { name: "  theme ", groups: [{ name: "BODY", choices: [{ name: "p", idx: 0 }] }] },
    ]);
    expect(r.sources).toHaveLength(1);
    expect(r.confidence).toBe("high");
  });
});

describe("decodeModuleConfig", () => {
  it("decodes UTF-16LE, which real scripts in the wild actually use", () => {
    const xml = '<config><moduleName>X</moduleName></config>';
    const buf = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(xml, "utf16le")]);
    expect(decodeModuleConfig(buf)).toContain("<moduleName>");
  });

  it("strips a UTF-8 BOM so the document does not start with a stray char", () => {
    const buf = Buffer.from("﻿<config/>", "utf8");
    expect(decodeModuleConfig(buf).startsWith("<config")).toBe(true);
  });
});

describe("parseModuleConfig", () => {
  it("parses steps, groups, plugins, flags and folder specs", async () => {
    const xml = `<config>
      <moduleName>Test</moduleName>
      <requiredInstallFiles><folder source="Core" destination="" priority="0"/></requiredInstallFiles>
      <installSteps order="Explicit">
        <installStep name="Theme">
          <optionalFileGroups order="Explicit">
            <group name="Body" type="SelectExactlyOne">
              <plugins order="Explicit">
                <plugin name="Atomic Muscle">
                  <conditionFlags><flag name="AM">true</flag></conditionFlags>
                  <files><folder source="bodies/am" destination=""/></files>
                </plugin>
              </plugins>
            </group>
          </optionalFileGroups>
        </installStep>
      </installSteps>
      <conditionalFileInstalls><patterns>
        <pattern>
          <dependencies operator="And"><flagDependency flag="AM" value="true"/></dependencies>
          <files><folder source="patches/am"/></files>
        </pattern>
      </patterns></conditionalFileInstalls>
    </config>`;
    const { script: s, warnings } = await parseModuleConfig(xml);
    expect(s.moduleName).toBe("Test");
    expect(s.requiredInstallFiles).toHaveLength(1);
    expect(s.steps[0].groups[0].plugins[0].flags).toEqual({ AM: "true" });
    expect(s.steps[0].groups[0].plugins[0].idx).toBe(0);
    expect(s.conditionalPatterns[0].flagDependencies).toEqual({ AM: "true" });
    expect(warnings).toEqual([]);
  });

  it("WARNS about dependency kinds it does not model instead of dropping them", async () => {
    // Silently ignoring one would under-predict the file set and make a
    // correct install look short.
    const xml = `<config><conditionalFileInstalls><patterns><pattern>
      <dependencies><fileDependency file="x.esp" state="Active"/></dependencies>
      <files><folder source="s"/></files>
    </pattern></patterns></conditionalFileInstalls></config>`;
    const { warnings } = await parseModuleConfig(xml);
    expect(warnings.join(" ")).toMatch(/fileDependency/);
  });

  it("throws on a document with no <config> root", async () => {
    await expect(parseModuleConfig("<nope/>")).rejects.toThrow(/config/);
  });
});
