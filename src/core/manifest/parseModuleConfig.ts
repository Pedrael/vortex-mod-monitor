/**
 * Parse a FOMOD `ModuleConfig.xml` into the shape {@link replayFomod} consumes.
 *
 * Encoding matters and is not optional: the real scripts in the wild are often
 * UTF-16 with a BOM (the Ultimate AAF Patch script measured here is), and
 * decoding one as UTF-8 yields a document full of NUL bytes that xml2js either
 * rejects or, worse, parses into nonsense. The BOM is sniffed rather than
 * assumed.
 *
 * Everything here degrades rather than guesses. A construct this parser does
 * not model must surface as a warning so {@link replayFomod} can downgrade its
 * confidence — a silently-dropped conditional would make the derived file set
 * quietly wrong, which is the one outcome worse than not checking at all.
 */

import { parseStringPromise } from "xml2js";

import type {
  FomodConditionalPattern,
  FomodFileSpec,
  FomodGroup,
  FomodPlugin,
  FomodScript,
  FomodStep,
} from "./fomodReplay";

/** Decode a ModuleConfig buffer, honouring a UTF-16 BOM when present. */
export function decodeModuleConfig(buf: Buffer): string {
  if (buf.length >= 2) {
    if (buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le");
    if (buf[0] === 0xfe && buf[1] === 0xff) {
      // UTF-16BE: swap to LE, which is all Node decodes natively.
      const swapped = Buffer.from(buf);
      swapped.swap16();
      return swapped.toString("utf16le");
    }
  }
  // A UTF-8 BOM would otherwise become a stray char before `<`.
  const text = buf.toString("utf8");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** xml2js gives `{ $: attrs }` and arrays for repeated children. */
type XmlNode = Record<string, unknown> & { $?: Record<string, string> };

function children(node: XmlNode | undefined, name: string): XmlNode[] {
  if (node === undefined) return [];
  const value = node[name];
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]) as XmlNode[];
}

function first(node: XmlNode | undefined, name: string): XmlNode | undefined {
  return children(node, name)[0];
}

function attr(node: XmlNode | undefined, name: string): string | undefined {
  return node?.$?.[name];
}

function toPriority(raw: string | undefined): number {
  if (raw === undefined) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Read a `<files>` block: any mix of `<file>` and `<folder>`. */
function parseFiles(filesNode: XmlNode | undefined): FomodFileSpec[] {
  const out: FomodFileSpec[] = [];
  for (const [tag, isFolder] of [
    ["file", false],
    ["folder", true],
  ] as const) {
    for (const node of children(filesNode, tag)) {
      const source = attr(node, "source");
      if (source === undefined) continue;
      const destination = attr(node, "destination");
      out.push({
        source,
        ...(destination !== undefined ? { destination } : {}),
        priority: toPriority(attr(node, "priority")),
        isFolder,
      });
    }
  }
  return out;
}

function parsePlugin(node: XmlNode, idx: number): FomodPlugin {
  const flags: Record<string, string> = {};
  for (const flagNode of children(first(node, "conditionFlags"), "flag")) {
    const name = attr(flagNode, "name");
    if (name === undefined) continue;
    // xml2js puts element text in `_` when the element also has attributes.
    const value =
      typeof flagNode._ === "string"
        ? flagNode._
        : typeof flagNode === "string"
          ? (flagNode as unknown as string)
          : "";
    flags[name] = String(value).trim();
  }
  return {
    name: attr(node, "name") ?? `plugin-${idx}`,
    idx,
    files: parseFiles(first(node, "files")),
    flags,
  };
}

function parseGroup(node: XmlNode): FomodGroup {
  const pluginNodes = children(first(node, "plugins"), "plugin");
  return {
    name: attr(node, "name") ?? "",
    type: attr(node, "type") ?? "",
    plugins: pluginNodes.map(parsePlugin),
  };
}

function parseStep(node: XmlNode): FomodStep {
  const groupNodes = children(first(node, "optionalFileGroups"), "group");
  return {
    name: attr(node, "name") ?? "",
    groups: groupNodes.map(parseGroup),
  };
}

/**
 * Parse `conditionalFileInstalls`.
 *
 * Only `flagDependency` is modelled. FOMOD also allows `fileDependency`,
 * `gameDependency` and nested `dependencies` operators, and a pattern using
 * one of those is reported through `warnings` rather than being silently
 * treated as unsatisfied — dropping it would under-predict the file set and
 * make a correct install look short.
 */
function parseConditionals(
  configNode: XmlNode,
  warnings: string[],
): FomodConditionalPattern[] {
  const patternsNode = first(
    first(configNode, "conditionalFileInstalls"),
    "patterns",
  );
  const out: FomodConditionalPattern[] = [];
  for (const pattern of children(patternsNode, "pattern")) {
    const deps = first(pattern, "dependencies");
    const flagDependencies: Record<string, string> = {};
    for (const dep of children(deps, "flagDependency")) {
      const name = attr(dep, "flag");
      if (name === undefined) continue;
      flagDependencies[name] = attr(dep, "value") ?? "";
    }
    // Recorded PER PATTERN, not just globally: the replay has to know which
    // specific pattern it cannot evaluate, so it can exclude that one instead
    // of trusting an empty flag map that means "unknown", not "unconditional".
    const unsupportedDependencies: string[] = [];
    for (const unsupported of ["fileDependency", "gameDependency", "dependencies"]) {
      if (children(deps, unsupported).length > 0) {
        unsupportedDependencies.push(unsupported);
        warnings.push(
          `conditionalFileInstalls uses <${unsupported}>, which this replay does not model.`,
        );
      }
    }
    const operator = attr(deps, "operator");
    if (operator !== undefined && operator.toLowerCase() !== "and") {
      unsupportedDependencies.push(`operator=${operator}`);
      warnings.push(`Dependency operator "${operator}" is not modelled (assuming And).`);
    }
    out.push({
      flagDependencies,
      files: parseFiles(first(pattern, "files")),
      unsupportedDependencies,
    });
  }
  return out;
}

export type ParsedModuleConfig = {
  script: FomodScript;
  /** Constructs encountered that this parser does not model. */
  warnings: string[];
};

/** Parse a decoded or raw `ModuleConfig.xml`. */
export async function parseModuleConfig(
  input: Buffer | string,
): Promise<ParsedModuleConfig> {
  const text = typeof input === "string" ? input : decodeModuleConfig(input);
  const doc = (await parseStringPromise(text, {
    explicitArray: true,
    trim: true,
  })) as Record<string, XmlNode>;

  const config = doc.config;
  if (config === undefined) {
    throw new Error("ModuleConfig.xml has no <config> root element.");
  }

  const warnings: string[] = [];
  const stepNodes = children(first(config, "installSteps"), "installStep");

  return {
    script: {
      ...(children(config, "moduleName")[0] !== undefined
        ? { moduleName: String(children(config, "moduleName")[0]) }
        : {}),
      requiredInstallFiles: parseFiles(first(config, "requiredInstallFiles")),
      steps: stepNodes.map(parseStep),
      conditionalPatterns: parseConditionals(config, warnings),
    },
    warnings,
  };
}
