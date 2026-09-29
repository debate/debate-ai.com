/**
 * @fileoverview A streaming writer for single-file `.7z` archives.
 *
 * The file is compressed with the 7z format's Deflate coder (method
 * `04 01 08`, which 7-Zip, p7zip and `7zz` all extract) through the runtime's
 * native `CompressionStream("deflate-raw")`. A pure-JS LZMA encoder would
 * need the whole input in memory and far more CPU than a Worker invocation
 * gets, so it is not an option for a multi-hundred-MB dump; Deflate streams
 * with a fixed-size window.
 *
 * Only the compressed bytes are kept — the input is fed through {@link write}
 * a chunk at a time while its CRC32 and length are tallied — and
 * {@link SevenZipWriter.finish} lays out the archive:
 *
 *     signature header (32 bytes) | packed stream | header
 *
 * `maxBytes` bounds what is buffered: once the packed stream passes it the
 * writer gives up, drops what it has and `finish()` returns null.
 * @module lib/admin/seven-zip
 */

const SIGNATURE = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c];
const FORMAT_VERSION = [0x00, 0x04];
const DEFLATE_METHOD = [0x04, 0x01, 0x08];

// Property ids from 7-Zip's 7zFormat.txt.
const K_END = 0x00;
const K_HEADER = 0x01;
const K_MAIN_STREAMS_INFO = 0x04;
const K_FILES_INFO = 0x05;
const K_PACK_INFO = 0x06;
const K_UNPACK_INFO = 0x07;
const K_SIZE = 0x09;
const K_CRC = 0x0a;
const K_FOLDER = 0x0b;
const K_CODERS_UNPACK_SIZE = 0x0c;
const K_NAME = 0x11;
const K_MTIME = 0x14;

let crcTable: Uint32Array | undefined;

/** Continues a CRC-32 (IEEE) over `bytes`; start from 0. */
export function crc32(bytes: Uint8Array, crc = 0): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  const table = crcTable;
  let c = ~crc;
  for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

/** Growable byte buffer for the header. */
class ByteWriter {
  private bytes: number[] = [];

  byte(...values: number[]) {
    this.bytes.push(...values);
  }

  uint32(value: number) {
    for (let i = 0; i < 4; i++) this.bytes.push((value >>> (8 * i)) & 0xff);
  }

  uint64(value: bigint | number) {
    let v = BigInt(value);
    for (let i = 0; i < 8; i++) {
      this.bytes.push(Number(v & 0xffn));
      v >>= 8n;
    }
  }

  /** 7z's variable-length NUMBER: leading 1-bits of the first byte count the extra bytes. */
  number(value: bigint | number) {
    let v = BigInt(value);
    let first = 0;
    let mask = 0x80;
    let extra = 0;
    for (; extra < 8; extra++) {
      if (v < 1n << BigInt(7 * (extra + 1))) {
        first |= Number(v >> BigInt(8 * extra));
        break;
      }
      first |= mask;
      mask >>= 1;
    }
    this.bytes.push(first & 0xff);
    for (; extra > 0; extra--) {
      this.bytes.push(Number(v & 0xffn));
      v >>= 8n;
    }
  }

  append(other: ByteWriter | Uint8Array) {
    for (const value of other instanceof ByteWriter ? other.bytes : other) this.bytes.push(value);
  }

  get length() {
    return this.bytes.length;
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

/** Windows FILETIME: 100 ns ticks since 1601-01-01. */
function fileTime(date: Date): bigint {
  return (BigInt(date.getTime()) + 11644473600000n) * 10000n;
}

/** The archive header describing one Deflate-packed file. */
export function buildHeader(opts: {
  fileName: string;
  packedSize: number;
  unpackedSize: number;
  crc: number;
  modified: Date;
}): Uint8Array {
  const h = new ByteWriter();
  h.byte(K_HEADER);

  h.byte(K_MAIN_STREAMS_INFO);
  h.byte(K_PACK_INFO);
  h.number(0); // pack position
  h.number(1); // pack streams
  h.byte(K_SIZE);
  h.number(opts.packedSize);
  h.byte(K_END);

  h.byte(K_UNPACK_INFO);
  h.byte(K_FOLDER);
  h.number(1); // folders
  h.byte(0); // not external
  h.number(1); // coders in the folder
  h.byte(DEFLATE_METHOD.length); // simple coder, no properties
  h.byte(...DEFLATE_METHOD);
  h.byte(K_CODERS_UNPACK_SIZE);
  h.number(opts.unpackedSize);
  h.byte(K_CRC);
  h.byte(1); // all defined
  h.uint32(opts.crc);
  h.byte(K_END);
  h.byte(K_END); // end of streams info

  h.byte(K_FILES_INFO);
  h.number(1); // files

  const name = new ByteWriter();
  name.byte(0); // not external
  for (let i = 0; i < opts.fileName.length; i++) {
    const code = opts.fileName.charCodeAt(i);
    name.byte(code & 0xff, code >>> 8);
  }
  name.byte(0, 0);
  h.byte(K_NAME);
  h.number(name.length);
  h.append(name);

  h.byte(K_MTIME);
  h.number(1 + 1 + 8);
  h.byte(1); // all defined
  h.byte(0); // not external
  h.uint64(fileTime(opts.modified));

  h.byte(K_END); // end of files info
  h.byte(K_END); // end of header
  return h.toBytes();
}

/** The 32-byte signature header that points at the archive header. */
export function buildSignatureHeader(nextHeaderOffset: number, nextHeader: Uint8Array): Uint8Array {
  const start = new ByteWriter();
  start.uint64(nextHeaderOffset);
  start.uint64(nextHeader.length);
  start.uint32(crc32(nextHeader));
  const startBytes = start.toBytes();

  const out = new ByteWriter();
  out.byte(...SIGNATURE, ...FORMAT_VERSION);
  out.uint32(crc32(startBytes));
  out.append(startBytes);
  return out.toBytes();
}

/**
 * Compresses one file into a `.7z` while its bytes are written. Await each
 * {@link write} (it applies the compressor's backpressure), then
 * {@link finish} for the archive, or null if it passed `maxBytes`.
 */
export class SevenZipWriter {
  private readonly writer: WritableStreamDefaultWriter<BufferSource>;
  private readonly draining: Promise<void>;
  private packed: Uint8Array[] = [];
  private packedSize = 0;
  private unpackedSize = 0;
  private crc = 0;
  private overflowed = false;

  constructor(
    private readonly fileName: string,
    private readonly maxBytes: number = Number.POSITIVE_INFINITY,
  ) {
    const deflate = new CompressionStream("deflate-raw");
    this.writer = deflate.writable.getWriter();
    const reader = deflate.readable.getReader();
    this.draining = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        if (this.overflowed) continue;
        this.packedSize += value.byteLength;
        // Leave room for the signature header and the archive header.
        if (this.packedSize + 32 + 1024 > this.maxBytes) {
          this.overflowed = true;
          this.packed = [];
          continue;
        }
        this.packed.push(value);
      }
    })();
    // Surfaced through finish(); avoid an unhandled rejection meanwhile.
    this.draining.catch(() => {});
  }

  /** True once the archive has outgrown `maxBytes`; further input is only counted. */
  get tooLarge(): boolean {
    return this.overflowed;
  }

  async write(bytes: Uint8Array<ArrayBuffer>): Promise<void> {
    this.crc = crc32(bytes, this.crc);
    this.unpackedSize += bytes.byteLength;
    await this.writer.write(bytes);
  }

  async abort(reason?: unknown): Promise<void> {
    await this.writer.abort(reason).catch(() => {});
    await this.draining.catch(() => {});
    this.packed = [];
  }

  async finish(modified: Date = new Date()): Promise<Uint8Array | null> {
    await this.writer.close();
    await this.draining;
    if (this.overflowed) return null;

    const header = buildHeader({
      fileName: this.fileName,
      packedSize: this.packedSize,
      unpackedSize: this.unpackedSize,
      crc: this.crc,
      modified,
    });
    const signature = buildSignatureHeader(this.packedSize, header);
    const out = new Uint8Array(signature.length + this.packedSize + header.length);
    out.set(signature, 0);
    let offset = signature.length;
    for (const part of this.packed) {
      out.set(part, offset);
      offset += part.byteLength;
    }
    out.set(header, offset);
    this.packed = [];
    return out;
  }
}
