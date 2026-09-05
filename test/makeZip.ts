/**
 * A real, minimal ZIP, built in memory.
 *
 * The packager shells out to 7z, and 7z is stubbed under test — so a test that
 * needs the READER to do real work has to bring its own archive. Stored
 * entries only: no compression, no ZIP64. Enough to be opened by
 * `readZip.ts`, which is the point, because a stub that returns bytes only
 * ever proves the stub works.
 */
import { crc32 } from "../src/core/manifest/readZip";

export type ZipEntryInput = { name: string; data: Buffer };

export function makeZip(entries: readonly ZipEntryInput[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const sum = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method: stored
    local.writeUInt32LE(0, 10); // mod time + date
    local.writeUInt32LE(sum, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, entry.data);

    const dirEntry = Buffer.alloc(46);
    dirEntry.writeUInt32LE(0x02014b50, 0);
    dirEntry.writeUInt16LE(20, 4);
    dirEntry.writeUInt16LE(20, 6);
    dirEntry.writeUInt16LE(0, 8);
    dirEntry.writeUInt16LE(0, 10);
    dirEntry.writeUInt32LE(0, 12);
    dirEntry.writeUInt32LE(sum, 16);
    dirEntry.writeUInt32LE(entry.data.length, 20);
    dirEntry.writeUInt32LE(entry.data.length, 24);
    dirEntry.writeUInt16LE(name.length, 28);
    dirEntry.writeUInt32LE(offset, 42);
    central.push(dirEntry, name);

    offset += local.length + name.length + entry.data.length;
  }

  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}
