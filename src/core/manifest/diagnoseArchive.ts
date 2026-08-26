/**
 * ──────────────────────────────────────────────────────────────────────
 * WHY could 7z not read this file?
 *
 * When 7z fails, all it says is that the file "is missing, corrupt,
 * password-protected, or not an archive" — four very different problems with
 * four different fixes, and no way to tell which. That is tolerable when you
 * are sitting at the machine. It is useless when the person who hit it is on
 * another continent and the only thing you have is a screenshot.
 *
 * Everything needed to distinguish them is in the first and last few bytes of
 * the file, so this reads them and says which it actually is.
 *
 * The decisive one is TRUNCATION. A ZIP's central directory lives at the END
 * of the file, so a partial download looks like a perfectly good ZIP header
 * followed by nothing 7z can use — which is exactly what a `.ehcoll` sent
 * through a chat client, a cloud sync, or an interrupted copy produces. A file
 * that starts with a ZIP signature and has no end-of-central-directory record
 * is not corrupt in any interesting sense; it is incomplete, and the fix is to
 * transfer it again rather than to rebuild it.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as fsp from "fs/promises";

export type ArchiveDiagnosis =
  | { kind: "missing" }
  | { kind: "empty" }
  | { kind: "truncated"; bytes: number }
  | { kind: "not-an-archive"; looksLike: string; bytes: number }
  | { kind: "looks-like-a-zip"; bytes: number }
  | { kind: "unreadable"; why: string };

/** ZIP local file header — the first thing in any non-empty zip. */
const LOCAL_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
/** End of central directory. Must appear within the last 64KB of a valid zip. */
const EOCD = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

/**
 * What is actually wrong with the file at `filePath`.
 *
 * Never throws: this runs while reporting another error, and an error handler
 * that fails is how a bad message becomes no message.
 */
export async function diagnoseArchive(
  filePath: string,
): Promise<ArchiveDiagnosis> {
  let size: number;
  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) return { kind: "missing" };
    size = stat.size;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return { kind: "missing" };
    return {
      kind: "unreadable",
      why: err instanceof Error ? err.message : String(err),
    };
  }

  if (size === 0) return { kind: "empty" };

  let handle: fsp.FileHandle | undefined;
  try {
    handle = await fsp.open(filePath, "r");

    const head = Buffer.alloc(8);
    await handle.read(head, 0, 8, 0);

    if (!head.subarray(0, 4).equals(LOCAL_HEADER)) {
      // Not a zip at all. Naming what it looks like instead turns "not an
      // archive" into something the user can act on — a downloaded HTML error
      // page and a RAR are both "not a zip" and neither fix is the other's.
      return { kind: "not-an-archive", looksLike: identify(head), bytes: size };
    }

    // A zip's central directory is at the end, within 64KB of it (the EOCD
    // comment field caps at 65535 bytes). If the header is good and this is
    // absent, the file was cut short rather than mangled.
    const tailLength = Math.min(size, 66_000);
    const tail = Buffer.alloc(tailLength);
    await handle.read(tail, 0, tailLength, size - tailLength);

    if (tail.indexOf(EOCD) === -1) return { kind: "truncated", bytes: size };

    return { kind: "looks-like-a-zip", bytes: size };
  } catch (err) {
    return {
      kind: "unreadable",
      why: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/** A guess at what the file is, from its first bytes. */
function identify(head: Buffer): string {
  const starts = (...bytes: number[]): boolean =>
    bytes.every((b, i) => head[i] === b);

  if (starts(0x37, 0x7a, 0xbc, 0xaf)) return "a 7z archive (not a ZIP)";
  if (starts(0x52, 0x61, 0x72, 0x21)) return "a RAR archive (not a ZIP)";
  if (starts(0x1f, 0x8b)) return "a gzip file (not a ZIP)";
  if (starts(0x50, 0x4b, 0x05, 0x06)) return "an empty ZIP";

  const text = head.toString("utf8").trimStart().toLowerCase();
  if (text.startsWith("<!do") || text.startsWith("<htm")) {
    return "an HTML page — the download probably returned an error page";
  }
  if (text.startsWith("{") || text.startsWith("[")) return "a JSON file";
  return "something that is not a ZIP";
}

/**
 * The diagnosis in the user's terms, with the fix that matches it.
 *
 * Each line names ONE next action. The generic "missing, corrupt,
 * password-protected, or not an archive" asked the reader to work out which of
 * four situations they were in, using information they did not have.
 */
export function describeArchiveDiagnosis(
  d: ArchiveDiagnosis,
  filePath: string,
): string[] {
  switch (d.kind) {
    case "missing":
      return [
        `There is no file at "${filePath}". It may have been moved or deleted ` +
          `since it was picked, or the download never finished.`,
      ];
    case "empty":
      return [
        `"${filePath}" is 0 bytes — the transfer produced an empty file. ` +
          `Download or copy it again.`,
      ];
    case "truncated":
      return [
        `"${filePath}" is an INCOMPLETE copy: it starts like a valid ` +
          `collection but the end of the file is missing (${formatBytes(d.bytes)} ` +
          `so far). Nothing is wrong with the collection itself — the transfer ` +
          `was cut short. Send or download it again, and check the size matches ` +
          `the sender's.`,
      ];
    case "not-an-archive":
      return [
        `"${filePath}" is not a collection package — it looks like ${d.looksLike} ` +
          `(${formatBytes(d.bytes)}). Check you picked the right file, and that ` +
          `it was not renamed from something else.`,
      ];
    case "looks-like-a-zip":
      return [
        `"${filePath}" looks like a complete package (${formatBytes(d.bytes)}) ` +
          `but 7z still could not read it. It may be password-protected, or ` +
          `damaged in the middle where a size check cannot see it. Try ` +
          `transferring it again; if it fails the same way, rebuild it.`,
      ];
    case "unreadable":
      return [
        `"${filePath}" could not be read: ${d.why}. Check the file is not open ` +
          `in another program and that you have permission to read it.`,
      ];
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} bytes`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
