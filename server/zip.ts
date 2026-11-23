import zlib from "zlib";

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Creates a single-entry PKZIP buffer (used by Veriban SOAP & Mysoft REST XML uploads). */
export function createSingleFileZip(fileName: string, content: Buffer): Buffer {
  const nameBuf = Buffer.from(fileName, "utf8");
  const compressed = zlib.deflateRawSync(content);
  const checksum = crc32(content);

  const localHeader = Buffer.alloc(30 + nameBuf.length);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4); // version needed
  localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
  localHeader.writeUInt16LE(8, 8); // Deflate
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(checksum, 14);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(content.length, 22);
  localHeader.writeUInt16LE(nameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);
  nameBuf.copy(localHeader, 30);

  const cdOffset = localHeader.length + compressed.length;
  const cdHeader = Buffer.alloc(46 + nameBuf.length);
  cdHeader.writeUInt32LE(0x02014b50, 0);
  cdHeader.writeUInt16LE(20, 4);
  cdHeader.writeUInt16LE(20, 6);
  cdHeader.writeUInt16LE(0x0800, 8);
  cdHeader.writeUInt16LE(8, 10);
  cdHeader.writeUInt16LE(0, 12);
  cdHeader.writeUInt16LE(0, 14);
  cdHeader.writeUInt32LE(checksum, 16);
  cdHeader.writeUInt32LE(compressed.length, 20);
  cdHeader.writeUInt32LE(content.length, 24);
  cdHeader.writeUInt16LE(nameBuf.length, 28);
  cdHeader.writeUInt16LE(0, 30);
  cdHeader.writeUInt16LE(0, 32);
  cdHeader.writeUInt16LE(0, 34);
  cdHeader.writeUInt16LE(0, 36);
  cdHeader.writeUInt32LE(0, 38);
  cdHeader.writeUInt32LE(0, 42);
  nameBuf.copy(cdHeader, 46);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cdHeader.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localHeader, compressed, cdHeader, eocd]);
}

function readCompressedSizesFromCentralDir(buf: Buffer): Map<number, { compSize: number; method: number }> {
  const map = new Map<number, { compSize: number; method: number }>();
  const eocdIdx = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocdIdx < 0 || eocdIdx + 22 > buf.length) return map;
  const cdOffset = buf.readUInt32LE(eocdIdx + 16);
  const cdSize = buf.readUInt32LE(eocdIdx + 12);
  let pos = cdOffset;
  const end = Math.min(buf.length, cdOffset + cdSize);
  while (pos + 46 <= end && buf.readUInt32LE(pos) === 0x02014b50) {
    const method = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const nLen = buf.readUInt16LE(pos + 28);
    const eLen = buf.readUInt16LE(pos + 30);
    const cLen = buf.readUInt16LE(pos + 32);
    const localOff = buf.readUInt32LE(pos + 42);
    map.set(localOff, { compSize, method });
    pos += 46 + nLen + eLen + cLen;
  }
  return map;
}

/** Extracts text from a ZIP buffer (Stored/Deflate, single or multi entry). */
export function extractZipEntryText(zipBuf: Buffer, preferExt?: ".xml" | ".html"): { name: string; text: string } | null {
  if (!zipBuf || zipBuf.length < 22) return null;
  const cdSizes = readCompressedSizesFromCentralDir(zipBuf);
  const candidates: { name: string; text: string }[] = [];

  let offset = 0;
  while (offset + 30 <= zipBuf.length) {
    if (zipBuf.readUInt32LE(offset) !== 0x04034b50) break;
    const flags = zipBuf.readUInt16LE(offset + 6);
    const method = cdSizes.get(offset)?.method ?? zipBuf.readUInt16LE(offset + 8);
    let compSize = zipBuf.readUInt32LE(offset + 18);
    if (compSize === 0 && cdSizes.has(offset)) compSize = cdSizes.get(offset)!.compSize;
    const nameLen = zipBuf.readUInt16LE(offset + 26);
    const extraLen = zipBuf.readUInt16LE(offset + 28);
    const name = zipBuf.toString("utf8", offset + 30, offset + 30 + nameLen);
    const dataStart = offset + 30 + nameLen + extraLen;
    let dataEnd = dataStart + compSize;

    if (compSize === 0 && (flags & 0x08) !== 0) {
      const nextLocal = zipBuf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), dataStart);
      const nextDesc = zipBuf.indexOf(Buffer.from([0x50, 0x4b, 0x07, 0x08]), dataStart);
      const nextCd = zipBuf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), dataStart);
      const bounds = [nextLocal, nextDesc, nextCd].filter(x => x > dataStart);
      dataEnd = bounds.length > 0 ? Math.min(...bounds) : zipBuf.length;
    }

    if (!name.endsWith("/") && dataEnd > dataStart && dataEnd <= zipBuf.length) {
      const slice = zipBuf.subarray(dataStart, dataEnd);
      let decoded: Buffer | null = null;
      if (method === 0) decoded = slice;
      else if (method === 8) decoded = zlib.inflateRawSync(slice);
      if (decoded) {
        const text = decoded.toString("utf8");
        if (preferExt && name.toLowerCase().endsWith(preferExt)) return { name, text };
        candidates.push({ name, text });
      }
    }
    offset = dataEnd + ((flags & 0x08) !== 0 && zipBuf.subarray(dataEnd, dataEnd + 4).equals(Buffer.from([0x50, 0x4b, 0x07, 0x08])) ? 16 : 0);
    if (offset <= dataStart) break;
  }

  return candidates[0] || null;
}
