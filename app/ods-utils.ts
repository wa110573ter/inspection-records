const encoder = new TextEncoder();
const decoder = new TextDecoder();

type ZipFiles = Map<string, Uint8Array>;

type OdsValue = string | number | null | undefined;

function concatBytes(parts: Uint8Array[]) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function uint16(value: number) {
  const output = new Uint8Array(2);
  new DataView(output.buffer).setUint16(0, value, true);
  return output;
}

function uint32(value: number) {
  const output = new Uint8Array(4);
  new DataView(output.buffer).setUint32(0, value >>> 0, true);
  return output;
}

function readUint16(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, true);
}

function readUint32(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function transformDeflate(
  bytes: Uint8Array,
  kind: "compress" | "decompress",
) {
  const stream =
    kind === "compress"
      ? new CompressionStream("deflate-raw")
      : new DecompressionStream("deflate-raw");
  const source = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const transformed = new Blob([source]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(transformed).arrayBuffer());
}

async function unzip(bytes: Uint8Array): Promise<ZipFiles> {
  let endOfDirectory = -1;
  for (
    let offset = bytes.length - 22;
    offset >= Math.max(0, bytes.length - 65557);
    offset -= 1
  ) {
    if (readUint32(bytes, offset) === 0x06054b50) {
      endOfDirectory = offset;
      break;
    }
  }
  if (endOfDirectory < 0) throw new Error("找不到 ODS ZIP 目錄");

  const entryCount = readUint16(bytes, endOfDirectory + 10);
  let cursor = readUint32(bytes, endOfDirectory + 16);
  const files: ZipFiles = new Map();

  for (let index = 0; index < entryCount; index += 1) {
    if (readUint32(bytes, cursor) !== 0x02014b50) {
      throw new Error("ODS ZIP 目錄格式錯誤");
    }
    const method = readUint16(bytes, cursor + 10);
    const compressedSize = readUint32(bytes, cursor + 20);
    const nameLength = readUint16(bytes, cursor + 28);
    const extraLength = readUint16(bytes, cursor + 30);
    const commentLength = readUint16(bytes, cursor + 32);
    const localOffset = readUint32(bytes, cursor + 42);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));

    if (readUint32(bytes, localOffset) !== 0x04034b50) {
      throw new Error(`ODS ZIP 檔案 ${name} 標頭錯誤`);
    }
    const localNameLength = readUint16(bytes, localOffset + 26);
    const localExtraLength = readUint16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);

    let data: Uint8Array;
    if (method === 0) data = compressed;
    else if (method === 8) data = await transformDeflate(compressed, "decompress");
    else throw new Error(`ODS ZIP 使用不支援的壓縮格式：${method}`);

    files.set(name, data);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

async function zip(files: ZipFiles) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const ordered = [...files.entries()].sort(([left], [right]) => {
    if (left === "mimetype") return -1;
    if (right === "mimetype") return 1;
    return 0;
  });

  for (const [name, raw] of ordered) {
    const nameBytes = encoder.encode(name);
    const stored = name === "mimetype";
    const method = stored ? 0 : 8;
    const compressed = stored ? raw : await transformDeflate(raw, "compress");
    const crc = crc32(raw);

    const local = concatBytes([
      uint32(0x04034b50),
      uint16(20),
      uint16(0x0800),
      uint16(method),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(compressed.length),
      uint32(raw.length),
      uint16(nameBytes.length),
      uint16(0),
      nameBytes,
      compressed,
    ]);
    localParts.push(local);

    const central = concatBytes([
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0x0800),
      uint16(method),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(compressed.length),
      uint32(raw.length),
      uint16(nameBytes.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(offset),
      nameBytes,
    ]);
    centralParts.push(central);
    offset += local.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const endOfDirectory = concatBytes([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(ordered.length),
    uint16(ordered.length),
    uint32(centralDirectory.length),
    uint32(offset),
    uint16(0),
  ]);
  return concatBytes([...localParts, centralDirectory, endOfDirectory]);
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }
  return output;
}

function escapeXml(value: OdsValue) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function generateOds(
  templateBase64: string,
  values: Record<string, OdsValue>,
) {
  const files = await unzip(decodeBase64(templateBase64));
  const contentBytes = files.get("content.xml");
  if (!contentBytes) throw new Error("ODS 範本缺少 content.xml");

  let content = decoder.decode(contentBytes);
  for (const [key, value] of Object.entries(values)) {
    content = content.replaceAll(`{{${key}}}`, escapeXml(value));
  }
  const leftover = [
    ...content.matchAll(/\{\{([A-Z0-9_]+)\}\}/g),
  ].map((match) => match[1]);
  for (const key of new Set(leftover)) {
    content = content.replaceAll(`{{${key}}}`, "");
  }
  files.set("content.xml", encoder.encode(content));
  return zip(files);
}
