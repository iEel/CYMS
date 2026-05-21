export interface ZipEntry {
  name: string;
  data: string | Buffer | Uint8Array;
}

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let i = 0; i < 8; i += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTimestamp(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = (year - 1980) << 9 | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function writeUInt16(value: number) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function writeUInt32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function toBuffer(data: ZipEntry['data']) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  return Buffer.from(data, 'utf8');
}

export function createZipArchive(entries: ZipEntry[], now = new Date()) {
  const { time, day } = dosTimestamp(now);
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/\\/g, '/'), 'utf8');
    const data = toBuffer(entry.data);
    const crc = crc32(data);

    const localHeader = Buffer.concat([
      writeUInt32(0x04034b50),
      writeUInt16(20),
      writeUInt16(0x0800),
      writeUInt16(0),
      writeUInt16(time),
      writeUInt16(day),
      writeUInt32(crc),
      writeUInt32(data.length),
      writeUInt32(data.length),
      writeUInt16(name.length),
      writeUInt16(0),
      name,
    ]);

    localParts.push(localHeader, data);

    centralParts.push(Buffer.concat([
      writeUInt32(0x02014b50),
      writeUInt16(20),
      writeUInt16(20),
      writeUInt16(0x0800),
      writeUInt16(0),
      writeUInt16(time),
      writeUInt16(day),
      writeUInt32(crc),
      writeUInt32(data.length),
      writeUInt32(data.length),
      writeUInt16(name.length),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(offset),
      name,
    ]));

    offset += localHeader.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localData = Buffer.concat(localParts);
  const end = Buffer.concat([
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(entries.length),
    writeUInt16(entries.length),
    writeUInt32(centralDirectory.length),
    writeUInt32(localData.length),
    writeUInt16(0),
  ]);

  return Buffer.concat([localData, centralDirectory, end]);
}
