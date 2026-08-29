/**
 * ──────────────────────────────────────────────────────────────────────
 * Reading a .ehcoll without spawning anything.
 *
 * A `.ehcoll` IS a ZIP. Every read of one used to go through Vortex's bundled
 * 7z — a Windows executable, spawned as a child process. On Windows that is
 * invisible. Under Wine/Proton it is the most fragile step in the install, and
 * it fails in a way node-7z cannot report: `list` resolves with an empty spec
 * and discards `{code, errors}`, so "7z never started" and "the archive is
 * corrupt" arrive at the caller completely identical.
 *
 * The alpha tester hit exactly that. His copy was proven byte-identical to the
 * curator's — same sha256, same length, read without complaint by both `unzip`
 * and a native 7z — and Vortex still could not open it.
 *
 * Nothing about reading a ZIP needs a subprocess. The central directory is a
 * flat table at the end of the file, and entry payloads are raw deflate, which
 * Node's own zlib inflates. So this reads the format directly: no child
 * process, no PATH lookup, no drive-letter translation, no 7z, and therefore
 * none of that failure class.
 *
 * Scope is deliberately narrow. 7z keeps the jobs it actually earns —
 * BUILDING a .ehcoll, and unpacking mod archives that may genuinely be .7z or
 * .rar. This covers our own format's READ path only.
 *
 * Everything here is positional reads against a file handle. A collection is
 * hundreds of megabytes and the manifest is a few hundred kilobytes of it;
 * loading the file to find the manifest would be the wrong trade.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as fsp from "fs/promises";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import { pipeline } from "stream/promises";

/** One entry from the central directory. */
export interface ZipEntry {
  /** Entry path as stored, always forward-slashed per the spec. */
  name: string;
  /** Bytes on disk, after compression. */
  compressedSize: number;
  /** Bytes once inflated. */
  uncompressedSize: number;
  /** 0 = stored, 8 = deflate. Anything else we refuse by name. */
  method: number;
  /** Offset of this entry's LOCAL header, not of its data. */
  localHeaderOffset: number;
  /** CRC-32 of the uncompressed bytes, from the central directory. */
  crc32: number;
  /** Directory entries exist in the table and carry no payload. */
  isDirectory: boolean;
}

/** Raised for anything malformed, unsupported, or truncated. */
export class ZipReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipReadError";
  }
}

const EOCD_SIG = 0x06054b50;
const EOCD64_SIG = 0x06064b50;
const EOCD64_LOCATOR_SIG = 0x07064b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

const EOCD_MIN_SIZE = 22;
/** The EOCD comment length field is 16-bit, so the record starts within 64K+22 of the end. */
const EOCD_MAX_SEARCH = 0xffff + EOCD_MIN_SIZE;

const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;

/** Flag bit 0. An encrypted entry inflates to garbage rather than failing loudly. */
const FLAG_ENCRYPTED = 0x1;

/**
 * Every entry in the archive's central directory.
 *
 * Reads the table, never the payloads — the cost is the size of the directory,
 * not of the archive.
 */
export async function listZipEntries(filePath: string): Promise<ZipEntry[]> {
  const handle = await open(filePath);
  try {
    const { size } = await handle.stat();
    const eocd = await readEndOfCentralDirectory(handle, size, filePath);
    return await readCentralDirectory(handle, eocd, filePath);
  } finally {
    await handle.close().catch(() => undefined);
  }
}

/**
 * One entry's bytes, inflated, in memory.
 *
 * `maxBytes` is not a tuning knob: the size comes from the archive, so without
 * a ceiling a malformed or hostile header can ask us to allocate anything it
 * likes. Callers that may face a large entry should extract to a file instead.
 */
export async function readZipEntry(
  filePath: string,
  entryName: string,
  maxBytes = 64 * 1024 * 1024,
): Promise<Buffer> {
  const handle = await open(filePath);
  try {
    const { size } = await handle.stat();
    const eocd = await readEndOfCentralDirectory(handle, size, filePath);
    const entries = await readCentralDirectory(handle, eocd, filePath);
    const entry = findEntry(entries, entryName, filePath);

    if (entry.uncompressedSize > maxBytes) {
      throw new ZipReadError(
        `"${entryName}" in "${filePath}" is ${entry.uncompressedSize} bytes, ` +
          `over the ${maxBytes}-byte limit for reading into memory.`,
      );
    }

    const dataOffset = await findDataOffset(handle, entry, filePath);
    const raw = Buffer.alloc(entry.compressedSize);
    if (entry.compressedSize > 0) {
      const { bytesRead } = await handle.read(
        raw,
        0,
        entry.compressedSize,
        dataOffset,
      );
      if (bytesRead !== entry.compressedSize) {
        throw new ZipReadError(
          `"${filePath}" ends before "${entryName}" does — the archive is ` +
            `incomplete (wanted ${entry.compressedSize} bytes, got ${bytesRead}).`,
        );
      }
    }

    const out =
      entry.method === METHOD_STORE ? raw : await inflateRaw(raw, entryName);

    verifyCrc(out, entry, entryName, filePath);
    return out;
  } finally {
    await handle.close().catch(() => undefined);
  }
}

/**
 * Stream one entry to `destPath`, creating parent directories.
 *
 * Streaming rather than buffering because a bundled mod archive inside a
 * collection can be larger than it is reasonable to hold in memory.
 */
export async function extractZipEntryToFile(
  filePath: string,
  entryName: string,
  destPath: string,
): Promise<void> {
  const handle = await open(filePath);
  let entry: ZipEntry;
  let dataOffset: number;
  try {
    const { size } = await handle.stat();
    const eocd = await readEndOfCentralDirectory(handle, size, filePath);
    const entries = await readCentralDirectory(handle, eocd, filePath);
    entry = findEntry(entries, entryName, filePath);
    dataOffset = await findDataOffset(handle, entry, filePath);
  } finally {
    await handle.close().catch(() => undefined);
  }

  await fsp.mkdir(path.dirname(destPath), { recursive: true });

  // An empty entry produces an empty range, and a zero-length read stream is
  // an edge case not worth threading through a pipeline.
  if (entry.compressedSize === 0) {
    await fsp.writeFile(destPath, Buffer.alloc(0));
    return;
  }

  const source = fs.createReadStream(filePath, {
    start: dataOffset,
    end: dataOffset + entry.compressedSize - 1,
  });
  const sink = fs.createWriteStream(destPath);

  if (entry.method === METHOD_STORE) {
    await pipeline(source, sink);
  } else {
    await pipeline(source, zlib.createInflateRaw(), sink);
  }
}

// ---------------------------------------------------------------------------
// Central directory
// ---------------------------------------------------------------------------

interface EndOfCentralDirectory {
  entryCount: number;
  centralDirOffset: number;
  centralDirSize: number;
}

/**
 * Locate and read the end-of-central-directory record.
 *
 * It is at the END of the file and may be followed by up to 64KB of comment,
 * so it has to be found by scanning backwards rather than by arithmetic. This
 * is also the record whose ABSENCE means "truncated" — see diagnoseArchive.
 */
async function readEndOfCentralDirectory(
  handle: fsp.FileHandle,
  fileSize: number,
  filePath: string,
): Promise<EndOfCentralDirectory> {
  if (fileSize < EOCD_MIN_SIZE) {
    throw new ZipReadError(
      `"${filePath}" is ${fileSize} bytes — too small to be a ZIP at all.`,
    );
  }

  const tailLength = Math.min(fileSize, EOCD_MAX_SEARCH);
  const tail = Buffer.alloc(tailLength);
  await handle.read(tail, 0, tailLength, fileSize - tailLength);

  // Scan backwards: with a comment present the signature can legitimately
  // appear more than once, and the LAST one is the real record.
  let eocdPos = -1;
  for (let i = tail.length - EOCD_MIN_SIZE; i >= 0; i -= 1) {
    if (tail.readUInt32LE(i) === EOCD_SIG) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos === -1) {
    throw new ZipReadError(
      `"${filePath}" has no end-of-central-directory record. A ZIP keeps its ` +
        `index at the end, so this is an incomplete file rather than a ` +
        `damaged one — transfer it again.`,
    );
  }

  const diskNumber = tail.readUInt16LE(eocdPos + 4);
  const diskWithCentralDir = tail.readUInt16LE(eocdPos + 6);
  if (diskNumber !== 0 || diskWithCentralDir !== 0) {
    throw new ZipReadError(
      `"${filePath}" is a multi-disk (split) archive, which a collection ` +
        `package never is. Check you picked the right file.`,
    );
  }

  let entryCount = tail.readUInt16LE(eocdPos + 10);
  let centralDirSize = tail.readUInt32LE(eocdPos + 12);
  let centralDirOffset = tail.readUInt32LE(eocdPos + 16);

  // ZIP64. The 16- and 32-bit fields saturate, and the real values live in a
  // separate record found through a locator sitting just before the EOCD.
  const saturated =
    entryCount === 0xffff ||
    centralDirSize === 0xffffffff ||
    centralDirOffset === 0xffffffff;

  if (saturated) {
    const zip64 = await readZip64EndOfCentralDirectory(
      handle,
      tail,
      eocdPos,
      fileSize - tailLength,
      filePath,
    );
    entryCount = zip64.entryCount;
    centralDirSize = zip64.centralDirSize;
    centralDirOffset = zip64.centralDirOffset;
  }

  if (centralDirOffset + centralDirSize > fileSize) {
    throw new ZipReadError(
      `"${filePath}" says its index ends at byte ` +
        `${centralDirOffset + centralDirSize} but the file is only ${fileSize} ` +
        `bytes. The archive is truncated.`,
    );
  }

  return { entryCount, centralDirOffset, centralDirSize };
}

async function readZip64EndOfCentralDirectory(
  handle: fsp.FileHandle,
  tail: Buffer,
  eocdPos: number,
  tailStart: number,
  filePath: string,
): Promise<EndOfCentralDirectory> {
  const locatorPos = eocdPos - 20;
  if (locatorPos < 0 || tail.readUInt32LE(locatorPos) !== EOCD64_LOCATOR_SIG) {
    throw new ZipReadError(
      `"${filePath}" uses ZIP64 sizes but has no ZIP64 locator record.`,
    );
  }

  const zip64Offset = toSafeNumber(
    tail.readBigUInt64LE(locatorPos + 8),
    "ZIP64 directory offset",
    filePath,
  );

  const rec = Buffer.alloc(56);
  const { bytesRead } = await handle.read(rec, 0, 56, zip64Offset);
  if (bytesRead < 56 || rec.readUInt32LE(0) !== EOCD64_SIG) {
    throw new ZipReadError(
      `"${filePath}" has a ZIP64 locator pointing at byte ${zip64Offset}, ` +
        `where there is no ZIP64 end-of-central-directory record.`,
    );
  }
  void tailStart;

  return {
    entryCount: toSafeNumber(rec.readBigUInt64LE(32), "entry count", filePath),
    centralDirSize: toSafeNumber(
      rec.readBigUInt64LE(40),
      "directory size",
      filePath,
    ),
    centralDirOffset: toSafeNumber(
      rec.readBigUInt64LE(48),
      "directory offset",
      filePath,
    ),
  };
}

/** Parse every central-directory header into a ZipEntry. */
async function readCentralDirectory(
  handle: fsp.FileHandle,
  eocd: EndOfCentralDirectory,
  filePath: string,
): Promise<ZipEntry[]> {
  const buf = Buffer.alloc(eocd.centralDirSize);
  if (eocd.centralDirSize > 0) {
    const { bytesRead } = await handle.read(
      buf,
      0,
      eocd.centralDirSize,
      eocd.centralDirOffset,
    );
    if (bytesRead !== eocd.centralDirSize) {
      throw new ZipReadError(
        `"${filePath}" ends inside its own index (wanted ` +
          `${eocd.centralDirSize} bytes, got ${bytesRead}). The archive is ` +
          `truncated.`,
      );
    }
  }

  const entries: ZipEntry[] = [];
  let pos = 0;

  for (let i = 0; i < eocd.entryCount; i += 1) {
    if (pos + 46 > buf.length) {
      throw new ZipReadError(
        `"${filePath}" declares ${eocd.entryCount} entries but its index runs ` +
          `out after ${i}. The archive is truncated or malformed.`,
      );
    }
    if (buf.readUInt32LE(pos) !== CENTRAL_SIG) {
      throw new ZipReadError(
        `"${filePath}" has a malformed index at entry ${i} — expected a ` +
          `central-directory header and found something else.`,
      );
    }

    const flags = buf.readUInt16LE(pos + 8);
    const method = buf.readUInt16LE(pos + 10);
    const crc32 = buf.readUInt32LE(pos + 16);
    let compressedSize = buf.readUInt32LE(pos + 20);
    let uncompressedSize = buf.readUInt32LE(pos + 24);
    const nameLength = buf.readUInt16LE(pos + 28);
    const extraLength = buf.readUInt16LE(pos + 30);
    const commentLength = buf.readUInt16LE(pos + 32);
    let localHeaderOffset = buf.readUInt32LE(pos + 42);

    const nameStart = pos + 46;
    const name = buf.toString("utf8", nameStart, nameStart + nameLength);

    if ((flags & FLAG_ENCRYPTED) !== 0) {
      throw new ZipReadError(
        `"${name}" in "${filePath}" is encrypted. Collection packages are ` +
          `never password-protected, so this is not the file you meant.`,
      );
    }

    // Any field that saturated is carried in the ZIP64 extra field, in a
    // fixed order, and ONLY the saturated ones are present.
    if (
      uncompressedSize === 0xffffffff ||
      compressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff
    ) {
      const extraStart = nameStart + nameLength;
      const zip64 = findZip64Extra(buf, extraStart, extraLength);
      if (zip64 === undefined) {
        throw new ZipReadError(
          `"${name}" in "${filePath}" uses ZIP64 sizes but carries no ZIP64 ` +
            `extra field.`,
        );
      }
      let z = 0;
      if (uncompressedSize === 0xffffffff) {
        uncompressedSize = toSafeNumber(
          zip64.readBigUInt64LE(z),
          "uncompressed size",
          filePath,
        );
        z += 8;
      }
      if (compressedSize === 0xffffffff) {
        compressedSize = toSafeNumber(
          zip64.readBigUInt64LE(z),
          "compressed size",
          filePath,
        );
        z += 8;
      }
      if (localHeaderOffset === 0xffffffff) {
        localHeaderOffset = toSafeNumber(
          zip64.readBigUInt64LE(z),
          "entry offset",
          filePath,
        );
      }
    }

    entries.push({
      name,
      compressedSize,
      uncompressedSize,
      method,
      localHeaderOffset,
      crc32,
      isDirectory: name.endsWith("/"),
    });

    pos = nameStart + nameLength + extraLength + commentLength;
  }

  return entries;
}

/** The ZIP64 extra field is id 0x0001 inside a run of id/size/payload triples. */
function findZip64Extra(
  buf: Buffer,
  start: number,
  length: number,
): Buffer | undefined {
  let p = start;
  const end = start + length;
  while (p + 4 <= end) {
    const id = buf.readUInt16LE(p);
    const size = buf.readUInt16LE(p + 2);
    if (id === 0x0001) {
      return buf.subarray(p + 4, Math.min(p + 4 + size, end));
    }
    p += 4 + size;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Entry payloads
// ---------------------------------------------------------------------------

/**
 * Where an entry's bytes actually start.
 *
 * The central directory records where the LOCAL header is, not where the data
 * is, and the local header's name and extra lengths may differ from the ones
 * in the central directory. So the local header has to be read; computing the
 * offset from the central copy produces a plausible wrong answer.
 */
async function findDataOffset(
  handle: fsp.FileHandle,
  entry: ZipEntry,
  filePath: string,
): Promise<number> {
  const local = Buffer.alloc(30);
  const { bytesRead } = await handle.read(
    local,
    0,
    30,
    entry.localHeaderOffset,
  );
  if (bytesRead < 30 || local.readUInt32LE(0) !== LOCAL_SIG) {
    throw new ZipReadError(
      `"${filePath}" points at byte ${entry.localHeaderOffset} for ` +
        `"${entry.name}", where there is no entry header. The archive's ` +
        `index does not match its contents.`,
    );
  }
  const nameLength = local.readUInt16LE(26);
  const extraLength = local.readUInt16LE(28);
  return entry.localHeaderOffset + 30 + nameLength + extraLength;
}

function findEntry(
  entries: ZipEntry[],
  entryName: string,
  filePath: string,
): ZipEntry {
  const entry = entries.find((e) => e.name === entryName);
  if (entry === undefined) {
    throw new ZipReadError(
      `"${filePath}" contains no entry named "${entryName}".`,
    );
  }
  if (entry.isDirectory) {
    throw new ZipReadError(
      `"${entryName}" in "${filePath}" is a directory, not a file.`,
    );
  }
  if (entry.method !== METHOD_STORE && entry.method !== METHOD_DEFLATE) {
    throw new ZipReadError(
      `"${entryName}" in "${filePath}" uses compression method ` +
        `${entry.method}, which this reader does not support (only stored and ` +
        `deflate). The package was probably not built by Event Horizon.`,
    );
  }
  return entry;
}

async function inflateRaw(raw: Buffer, entryName: string): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    zlib.inflateRaw(raw, (err, out) => {
      if (err) {
        reject(
          new ZipReadError(
            `"${entryName}" could not be decompressed: ${err.message}. The ` +
              `entry is damaged.`,
          ),
        );
        return;
      }
      resolve(out);
    });
  });
}

/**
 * CRC-32, computed rather than taken from zlib.
 *
 * `zlib.crc32` only exists from Node 20.15, and Vortex's Electron runtime is
 * not ours to choose. This is the same polynomial, in about as many lines as
 * the version check would have cost.
 */
const CRC_TABLE = ((): Uint32Array => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Checking the CRC is the whole point of having one.
 *
 * A collection is a reproduction contract: a manifest that inflated to
 * plausible-looking but wrong bytes is worse than one that failed to inflate,
 * because the failure is silent and everything downstream trusts it.
 */
function verifyCrc(
  out: Buffer,
  entry: ZipEntry,
  entryName: string,
  filePath: string,
): void {
  if (out.length !== entry.uncompressedSize) {
    throw new ZipReadError(
      `"${entryName}" in "${filePath}" should be ${entry.uncompressedSize} ` +
        `bytes but decompressed to ${out.length}. The entry is damaged.`,
    );
  }
  const actual = crc32(out);
  if (actual !== entry.crc32) {
    throw new ZipReadError(
      `"${entryName}" in "${filePath}" failed its checksum (expected ` +
        `${entry.crc32.toString(16)}, got ${actual.toString(16)}). The entry ` +
        `is damaged.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function open(filePath: string): Promise<fsp.FileHandle> {
  try {
    return await fsp.open(filePath, "r");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      throw new ZipReadError(`No file at "${filePath}".`);
    }
    throw new ZipReadError(
      `Cannot open "${filePath}": ` +
        `${err instanceof Error ? err.message : String(err)}.`,
    );
  }
}

/**
 * ZIP64 fields are 64-bit and JavaScript numbers are not.
 *
 * Silently truncating past 2^53 would turn a real offset into a wrong one that
 * still looks like a number, so this refuses instead. No collection is
 * anywhere near the limit; a value that is says the header is wrong.
 */
function toSafeNumber(value: bigint, what: string, filePath: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ZipReadError(
      `"${filePath}" declares a ${what} of ${value}, which is too large to be ` +
        `real. The archive's index is corrupt.`,
    );
  }
  return Number(value);
}
