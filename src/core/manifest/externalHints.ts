/**
 * ──────────────────────────────────────────────────────────────────────
 * Where does an external mod come from? Ask Vortex before asking the curator.
 *
 * A mod that is not on Nexus has to be described in words: a link, and what to
 * do when you get there. Today the curator types that from scratch for every
 * such mod, which on a large collection is the single most tedious part of
 * publishing — and it is tedious for information Vortex is usually already
 * holding.
 *
 * Three places it can be hiding, in descending order of how deliberate it is:
 *
 *   1. **A Vortex collection's `downloadHint`.** If the curator has already
 *      authored a Vortex collection containing this mod, they filled in a
 *      "browse website" URL and instructions THERE, for exactly this purpose.
 *      That is not a guess about where the file came from, it is the curator's
 *      own published answer, and it wins.
 *
 *      Neatly, that data lives on the collection mod — the one thing the build
 *      deliberately excludes from shipping (see collectionScope). Excluded as
 *      content, read as metadata.
 *
 *   2. **The download's `sourceURI`.** The URL the archive was actually
 *      fetched from. Empirical rather than editorial: correct about origin,
 *      but it can be a direct file link that expires, or a CDN URL that is
 *      useless to a human.
 *
 *   3. **`mod.attributes.homepage`.** The mod's page. Usually the right place
 *      to send someone even when it says nothing about which file to take.
 *
 * ── Never overwrite the curator ──
 * A hint is a DEFAULT for an empty field, never a correction to a full one. If
 * the curator wrote instructions, they looked at this mod and decided; a
 * scraped `sourceURI` replacing that would be the tool overruling the person
 * who knows. Same reason a low-confidence name match is not used at all: a
 * wrong download link on someone else's machine is worse than no link, because
 * it is followed.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { types } from "@nexusmods/vortex-api";

/** What Vortex knows about where a mod came from. */
export type ExternalHint = {
  /** A link to give the user. */
  url?: string;
  /** What the curator said to do, when they said anything. */
  instructions?: string;
  /** Which of the three sources this came from — surfaced so the UI can say. */
  via: "collection-rule" | "download-uri" | "homepage";
  /**
   * Vortex's own `downloadHint.mode`, when the hint came from a collection
   * rule. It says what kind of link this is, which is what the user-side
   * screen needs to give the right instruction:
   *
   *   `browse`  — a mod PAGE. Open it, find the file, download it.
   *   `direct`  — a link straight to the file. Opening it starts a download.
   *   `manual`  — no usable link; the curator is describing where to look.
   *
   * Absent for a hint we inferred, because inferring the mode as well would
   * be guessing on top of guessing: a `homepage` attribute is page-shaped and
   * a `sourceURI` is file-shaped, but neither is a statement of intent the way
   * the curator's own choice is.
   */
  mode?: DownloadMode;
};

export type DownloadMode = "direct" | "browse" | "manual";

/** Vortex's own three; anything else is not something we can act on. */
function asMode(raw: unknown): DownloadMode | undefined {
  return raw === "direct" || raw === "browse" || raw === "manual"
    ? raw
    : undefined;
}

/** Identity a hint can be matched by, strongest first. */
type HintKeys = {
  vortexModId?: string;
  archiveId?: string;
  fileMD5?: string;
  logicalFileName?: string;
};

type IndexedHint = { keys: HintKeys; hint: ExternalHint };

/** The mod fields matching needs. A subset of AuditorMod, so tests stay small. */
export type HintTarget = {
  id: string;
  name: string;
  archiveId?: string;
};

/**
 * Pull every download hint the curator has authored in a Vortex collection.
 *
 * Reads collection mods' rules directly from state rather than going through
 * the captured-rule shape: `CapturedModRule` deliberately keeps only what
 * identity and diffing need, and widening it would put this metadata into the
 * comparison path where it does not belong.
 */
export function collectionHints(
  mods: Readonly<Record<string, unknown>>,
): IndexedHint[] {
  const out: IndexedHint[] = [];
  for (const mod of Object.values(mods)) {
    const m = mod as { type?: string; rules?: unknown };
    if (m.type !== "collection") continue;
    if (!Array.isArray(m.rules)) continue;

    for (const rule of m.rules as unknown[]) {
      const r = rule as {
        reference?: Record<string, unknown>;
        downloadHint?: { mode?: string; url?: string; instructions?: string };
        extra?: { url?: string; instructions?: string };
      };
      const url = str(r.downloadHint?.url) ?? str(r.extra?.url);
      const instructions =
        str(r.downloadHint?.instructions) ?? str(r.extra?.instructions);
      if (url === undefined && instructions === undefined) continue;

      const ref = r.reference ?? {};
      out.push({
        keys: {
          vortexModId: str(ref["id"]),
          archiveId: str(ref["archiveId"]),
          fileMD5: str(ref["fileMD5"]),
          logicalFileName: str(ref["logicalFileName"]),
        },
        hint: {
          ...(url !== undefined ? { url } : {}),
          ...(instructions !== undefined ? { instructions } : {}),
          via: "collection-rule",
          ...(asMode(r.downloadHint?.mode) !== undefined
            ? { mode: asMode(r.downloadHint?.mode) }
            : {}),
        },
      });
    }
  }
  return out;
}

/**
 * The best hint for one mod, or nothing.
 *
 * Matching is by identity only — a Vortex mod id, an archive id, an archive
 * filename. Deliberately NOT by display name: two mods can share a name, names
 * get edited, and the cost of being wrong here is a user following a link to
 * the wrong mod. An unmatched mod is the curator typing what they type today,
 * which is the current behaviour and therefore a safe floor.
 */
export function findCollectionHint(
  target: HintTarget,
  index: readonly IndexedHint[],
  archiveFileName?: string,
): ExternalHint | undefined {
  const byId = index.find((h) => h.keys.vortexModId === target.id);
  if (byId !== undefined) return byId.hint;

  if (target.archiveId !== undefined) {
    const byArchive = index.find((h) => h.keys.archiveId === target.archiveId);
    if (byArchive !== undefined) return byArchive.hint;
  }

  if (archiveFileName !== undefined) {
    const lower = archiveFileName.toLowerCase();
    const byName = index.find(
      (h) => h.keys.logicalFileName?.toLowerCase() === lower,
    );
    if (byName !== undefined) return byName.hint;
  }

  return undefined;
}

/**
 * Fall back to what the download itself recorded.
 *
 * `sourceURI` is where the bytes came from and `details.homepage` is the mod's
 * page; the page is preferred when both exist, because a direct file URL is
 * frequently a signed or expiring link that will not work for anyone else —
 * accurate about the past and useless as an instruction.
 */
export function downloadHint(
  download: unknown,
  modAttributes?: Readonly<Record<string, unknown>>,
): ExternalHint | undefined {
  const d = download as
    | { sourceURI?: unknown; details?: { homepage?: unknown } }
    | undefined;

  const homepage =
    str(d?.details?.homepage) ?? str(modAttributes?.["homepage"]);
  if (homepage !== undefined && isUsableUrl(homepage)) {
    return { url: homepage, via: "homepage" };
  }

  const source = str(d?.sourceURI);
  if (source !== undefined && isUsableUrl(source)) {
    return { url: source, via: "download-uri" };
  }
  return undefined;
}

/**
 * Only http(s) is worth handing to a person.
 *
 * Vortex writes `nxm://` links and bare local paths into `sourceURI` too. A
 * local path is the curator's own disk and means nothing on another machine —
 * shipping one as "where to get this" would send the user looking for a folder
 * they do not have, and it would leak the curator's directory layout.
 */
function isUsableUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

const str = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

/**
 * Merge a hint into what the curator already wrote.
 *
 * Curator-supplied values always win, field by field: someone who wrote
 * instructions but no URL keeps their instructions and gains the link.
 */
export function applyHint(
  existing: { url?: string; instructions?: string; mode?: DownloadMode },
  hint: ExternalHint | undefined,
): {
  url?: string;
  instructions?: string;
  mode?: DownloadMode;
  filledFrom?: ExternalHint["via"];
} {
  if (hint === undefined) return existing;

  const url = existing.url ?? hint.url;
  const instructions = existing.instructions ?? hint.instructions;
  const filled =
    (existing.url === undefined && hint.url !== undefined) ||
    (existing.instructions === undefined && hint.instructions !== undefined);

  const mode = existing.mode ?? hint.mode;
  return {
    ...(url !== undefined ? { url } : {}),
    ...(instructions !== undefined ? { instructions } : {}),
    ...(mode !== undefined ? { mode } : {}),
    ...(filled ? { filledFrom: hint.via } : {}),
  };
}

/** Read every mod record for a game, or an empty map if state is unreadable. */
export function modsFromState(
  api: types.IExtensionApi,
  gameId: string,
): Record<string, unknown> {
  try {
    const state = api.getState() as unknown as {
      persistent?: { mods?: Record<string, Record<string, unknown>> };
    };
    return state.persistent?.mods?.[gameId] ?? {};
  } catch {
    return {};
  }
}

/** Read the downloads map, or an empty map if state is unreadable. */
export function downloadsFromState(
  api: types.IExtensionApi,
): Record<string, unknown> {
  try {
    const state = api.getState() as unknown as {
      persistent?: { downloads?: { files?: Record<string, unknown> } };
    };
    return state.persistent?.downloads?.files ?? {};
  } catch {
    return {};
  }
}

/**
 * The best hint for every external mod that has one, by Vortex mod id.
 *
 * Mods with no hint are simply absent — the map's size IS the number of mods
 * this saved the curator from describing, which is the number worth logging.
 *
 * Sources are tried in order of how deliberate they are: the curator's own
 * collection answer, then the URL the archive came from, then the mod's page.
 * Only the first is something a person wrote for this purpose; the other two
 * are inferences, which is why `via` travels with the hint instead of being
 * discarded once a URL is found.
 */
export function collectExternalHints(args: {
  modsInState: Readonly<Record<string, unknown>>;
  downloads: Readonly<Record<string, unknown>>;
  externalMods: readonly HintTarget[];
}): Map<string, ExternalHint> {
  const index = collectionHints(args.modsInState);
  const out = new Map<string, ExternalHint>();

  for (const mod of args.externalMods) {
    const record = args.modsInState[mod.id] as
      | { attributes?: Record<string, unknown> }
      | undefined;
    const archive =
      mod.archiveId === undefined ? undefined : args.downloads[mod.archiveId];
    const archiveFileName = str(
      (archive as { localPath?: unknown } | undefined)?.localPath,
    );

    const hint =
      findCollectionHint(mod, index, archiveFileName) ??
      downloadHint(archive, record?.attributes);
    if (hint !== undefined) out.set(mod.id, hint);
  }
  return out;
}

/** Tally of values, for a log line that says which source actually answered. */
export function countBy(values: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}

/**
 * Mods the curator's Vortex collection says are needed, that this collection
 * does not ship.
 *
 * The prerequisite catalogue (externalDependencies) is a CLOSED list — seven
 * known tools, found by looking for their files in the game directory. It
 * cannot know about a Buffout, an xSE plugin, or a custom ENB preset, so a
 * collection depending on one ships without ever mentioning it and the user
 * finds out when the game does not start.
 *
 * The curator's own Vortex collection is an OPEN list of the same thing: they
 * already declared those dependencies, with a link and instructions, for
 * exactly this purpose. Anything in there with a download hint that is not one
 * of our own mods is something the user will need and we are not providing.
 *
 * ── Reported, not shipped ──
 * This returns warnings for the curator to act on rather than manifest
 * entries, and that is deliberate. `EhcollExternalDependency` is a
 * files-on-disk contract — every entry carries hashed files the installer
 * verifies — and a mod rule has no files to hash. Inventing an entry with no
 * verifiable content would put something in the manifest that the installer
 * can only take on faith, which is the opposite of what that type is for.
 *
 * The curator can act on the warning by adding the mod to the profile, or by
 * writing it into the collection's prose. Both are better than a manifest
 * entry nothing can check.
 */
export function undeclaredDependencies(args: {
  modsInState: Readonly<Record<string, unknown>>;
  /** Mods this collection ships, so a satisfied dependency is not reported. */
  includedMods: readonly HintTarget[];
  /** Archive filename per included mod id, when known. Improves matching. */
  archiveNames?: ReadonlyMap<string, string>;
}): { name: string; url?: string; instructions?: string }[] {
  const index = collectionHints(args.modsInState);
  if (index.length === 0) return [];

  const out: { name: string; url?: string; instructions?: string }[] = [];
  const seen = new Set<string>();

  for (const entry of index) {
    // Does any mod we ship answer this rule? Same identity ladder as
    // findCollectionHint, run the other way round.
    const satisfied = args.includedMods.some(
      (mod) =>
        (entry.keys.vortexModId !== undefined &&
          entry.keys.vortexModId === mod.id) ||
        (entry.keys.archiveId !== undefined &&
          entry.keys.archiveId === mod.archiveId) ||
        (entry.keys.logicalFileName !== undefined &&
          args.archiveNames?.get(mod.id)?.toLowerCase() ===
            entry.keys.logicalFileName.toLowerCase()),
    );
    if (satisfied) continue;

    // Something has to name it, or the warning is unactionable.
    const name = entry.keys.logicalFileName ?? entry.hint.url;
    if (name === undefined || seen.has(name)) continue;
    seen.add(name);

    out.push({
      name,
      ...(entry.hint.url !== undefined ? { url: entry.hint.url } : {}),
      ...(entry.hint.instructions !== undefined
        ? { instructions: entry.hint.instructions }
        : {}),
    });
  }
  return out;
}

/**
 * Say it in terms of what will happen to the person installing.
 *
 * A curator reading their own build output knows what their Vortex collection
 * contains; what they cannot see is that the person on the other end will not
 * get any of it.
 */
export function describeUndeclared(
  found: readonly { name: string; url?: string }[],
): string[] {
  if (found.length === 0) return [];

  const lines = [
    `Your Vortex collection declares ${found.length} download(s) this ` +
      `collection does not ship and does not mention. Whoever installs this ` +
      `will not be told they need them:`,
  ];
  for (const dep of found.slice(0, 5)) {
    lines.push(`  • ${dep.name}${dep.url !== undefined ? ` — ${dep.url}` : ""}`);
  }
  if (found.length > 5) lines.push(`  • and ${found.length - 5} more.`);
  lines.push(
    `Add them to this profile so they ship, or describe them in the ` +
      `collection's README so the instruction reaches the user.`,
  );
  return lines;
}
