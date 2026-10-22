import { crc32, deflateRawSync } from "node:zlib";
// Small deterministic ZIP fixtures, independent of the production reader.
export function zip(entries) {
  const local = [],
    central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name),
      data = Buffer.from(entry.text ?? ""),
      packed = entry.stored ? data : deflateRawSync(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(entry.encrypted ? 1 : 0, 6);
    header.writeUInt16LE(entry.stored ? 0 : 8, 8);
    header.writeUInt32LE(entry.badCRC ? 123 : crc32(data), 14);
    header.writeUInt32LE(packed.length, 18);
    header.writeUInt32LE(entry.size ?? data.length, 22);
    header.writeUInt16LE(name.length, 26);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50);
    record.writeUInt16LE(0x0314, 4);
    header.copy(record, 6, 4, 30);
    record.writeUInt32LE(entry.symlink ? 0xa1ff0000 >>> 0 : 0, 38);
    record.writeUInt32LE(offset, 42);
    local.push(header, name, packed);
    central.push(record, name);
    offset += header.length + name.length + packed.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
