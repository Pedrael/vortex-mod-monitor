/**
 * A minimal XML reader for FOMOD `ModuleConfig.xml`.
 *
 * ─── WHY NOT xml2js ───────────────────────────────────────────────────
 * `xml2js` is a `@nexusmods/vortex-api` peer dependency, which looks like a
 * promise that Vortex provides it at runtime. It is not one for THIS
 * extension. Vortex's own bundled extensions are webpack'd and INLINE their
 * dependencies (`bundledPlugins/game-7daystodie/index.cjs` contains xml2js
 * rather than requiring it), and the vortex-api README states plainly that an
 * extension "must bundle all external dependencies into the output".
 *
 * This extension has no bundler — it ships plain `tsc` output — so
 * `require("xml2js")` resolves only if Vortex happens to expose it to unbundled
 * extension code. It was caught by the deployed smoke check:
 *
 *   Error: Cannot find module 'xml2js'
 *     at dist/core/manifest/parseModuleConfig.js
 *
 * That would have been a crash on extension LOAD — not a failed FOMOD parse, a
 * dead extension — because the import sits at module scope. Adding a bundler to
 * chase one dependency is the larger change; a small reader for a small,
 * well-defined document is the smaller one.
 *
 * ─── SCOPE, DELIBERATELY SMALL ────────────────────────────────────────
 * Handles what FOMOD scripts actually contain: elements, attributes (single or
 * double quoted), nesting, self-closing tags, text content, comments, CDATA,
 * the XML declaration, and the five predefined entities plus numeric escapes.
 *
 * It does NOT handle namespaces (FOMOD uses an `xsi:` attribute that is simply
 * kept as a literal attribute name), DTDs, or processing instructions beyond
 * the declaration. It is not a general-purpose XML parser and must not be
 * used as one.
 */

/** A parsed element. Text is only kept when an element has no element children. */
export type XmlElement = {
  name: string;
  attrs: Record<string, string>;
  children: XmlElement[];
  /** Concatenated text content, trimmed. Empty when the element has children. */
  text: string;
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/** Resolve the predefined entities and numeric character references. */
export function decodeEntities(input: string): string {
  if (!input.includes("&")) return input;
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    const named = ENTITIES[body.toLowerCase()];
    return named ?? whole;
  });
}

/**
 * Parse a document and return its root element.
 *
 * Throws on malformed input rather than returning a partial tree: a silently
 * truncated FOMOD script would produce a confidently wrong file set, which is
 * the one outcome worse than not checking.
 */
export function parseXml(source: string): XmlElement {
  let i = 0;
  const len = source.length;
  const stack: XmlElement[] = [];
  let root: XmlElement | undefined;

  const isNameChar = (c: string): boolean => /[A-Za-z0-9_.:-]/.test(c);

  while (i < len) {
    const lt = source.indexOf("<", i);
    if (lt === -1) break;

    // Text between elements belongs to the element currently open.
    if (lt > i && stack.length > 0) {
      const chunk = source.slice(i, lt);
      if (chunk.trim() !== "") {
        const top = stack[stack.length - 1];
        top.text = (top.text + decodeEntities(chunk)).trim();
      }
    }

    if (source.startsWith("<!--", lt)) {
      const end = source.indexOf("-->", lt + 4);
      if (end === -1) throw new Error("Unterminated XML comment.");
      i = end + 3;
      continue;
    }
    if (source.startsWith("<![CDATA[", lt)) {
      const end = source.indexOf("]]>", lt + 9);
      if (end === -1) throw new Error("Unterminated CDATA section.");
      if (stack.length > 0) {
        const top = stack[stack.length - 1];
        top.text = (top.text + source.slice(lt + 9, end)).trim();
      }
      i = end + 3;
      continue;
    }
    if (source.startsWith("<?", lt) || source.startsWith("<!", lt)) {
      // XML declaration or DOCTYPE — skipped wholesale.
      const end = source.indexOf(">", lt);
      if (end === -1) throw new Error("Unterminated XML declaration or doctype.");
      i = end + 1;
      continue;
    }

    if (source.startsWith("</", lt)) {
      const end = source.indexOf(">", lt);
      if (end === -1) throw new Error("Unterminated closing tag.");
      const name = source.slice(lt + 2, end).trim();
      const open = stack.pop();
      if (open === undefined) throw new Error(`Unexpected closing tag </${name}>.`);
      if (open.name !== name) {
        throw new Error(`Mismatched tags: <${open.name}> closed by </${name}>.`);
      }
      i = end + 1;
      continue;
    }

    // Opening tag.
    let p = lt + 1;
    let name = "";
    while (p < len && isNameChar(source[p])) name += source[p++];
    if (name === "") throw new Error(`Malformed tag at offset ${lt}.`);

    const element: XmlElement = { name, attrs: {}, children: [], text: "" };

    // Attributes, until `>` or `/>`.
    while (p < len) {
      while (p < len && /\s/.test(source[p])) p++;
      if (source[p] === ">" || source.startsWith("/>", p)) break;

      let attrName = "";
      while (p < len && isNameChar(source[p])) attrName += source[p++];
      if (attrName === "") {
        // Not a name and not a terminator — skip a char to guarantee progress
        // rather than spinning forever on malformed input.
        p++;
        continue;
      }
      while (p < len && /\s/.test(source[p])) p++;
      if (source[p] !== "=") {
        element.attrs[attrName] = "";
        continue;
      }
      p++; // '='
      while (p < len && /\s/.test(source[p])) p++;
      const quote = source[p];
      if (quote !== '"' && quote !== "'") throw new Error(`Unquoted attribute "${attrName}".`);
      p++;
      const close = source.indexOf(quote, p);
      if (close === -1) throw new Error(`Unterminated attribute "${attrName}".`);
      element.attrs[attrName] = decodeEntities(source.slice(p, close));
      p = close + 1;
    }

    const selfClosing = source.startsWith("/>", p);
    const tagEnd = selfClosing ? p + 2 : source.indexOf(">", p) + 1;
    if (tagEnd === 0) throw new Error(`Unterminated tag <${name}>.`);

    if (stack.length > 0) stack[stack.length - 1].children.push(element);
    else if (root === undefined) root = element;
    else throw new Error("Document has more than one root element.");

    if (!selfClosing) stack.push(element);
    i = tagEnd;
  }

  if (stack.length > 0) throw new Error(`Unclosed tag <${stack[stack.length - 1].name}>.`);
  if (root === undefined) throw new Error("Document has no root element.");
  return root;
}

/** Direct children with the given name (case-insensitive, as FOMOD authors vary). */
export function childrenNamed(element: XmlElement | undefined, name: string): XmlElement[] {
  if (element === undefined) return [];
  const wanted = name.toLowerCase();
  return element.children.filter((c) => c.name.toLowerCase() === wanted);
}

/** First direct child with the given name. */
export function childNamed(element: XmlElement | undefined, name: string): XmlElement | undefined {
  return childrenNamed(element, name)[0];
}

/** Attribute lookup, case-insensitive. */
export function attrNamed(element: XmlElement | undefined, name: string): string | undefined {
  if (element === undefined) return undefined;
  const direct = element.attrs[name];
  if (direct !== undefined) return direct;
  const wanted = name.toLowerCase();
  for (const [k, v] of Object.entries(element.attrs)) {
    if (k.toLowerCase() === wanted) return v;
  }
  return undefined;
}
