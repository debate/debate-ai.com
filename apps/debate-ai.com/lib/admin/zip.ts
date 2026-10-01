/**
 * @fileoverview A streaming writer for single-file `.zip` archives.
 *
 * One Deflate-compressed entry (method `8`, the Deflate the runtime's
 * `CompressionStream("deflate-raw")` produces) wrapped in the ZIP container
 * that Finder, Explorer and `unzip` all read:
 *
 *     local file header | packed stream | data descriptor
 *     central directory | end of central directory
 *
 * Sizes and the CRC are not known while the entry is being written, so the
 * local header leaves them zero and sets general purpose bit 3, which says
 * they follow the data in a descriptor. Every mainstream extractor — macOS
 * Archive Utility, Windows Explorer, Info-ZIP, 7-Zip, Python's `zipfile` —
 * handles that; only streaming writers that need the sizes up front do not.
 *
 * Without a Zip64 extension a ZIP caps out at 4 GiB per entry, which a
 * content-table dump does not come near.
 * @module lib/admin/zip
 */

import { crc32 } from "./seven-zip";

const LOCAL_FILE_HEADER = 0x04034b50;
const DATA_DESCRIPTOR = 0x08074b50;
const CENTRAL_FILE_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

/** ZIP 2.0: directories and Deflate. */
const VERSION_NEEDED = 20;
/** "Made by" 3.0 on Unix, so the permissions below are read as a Unix mode. */
const VERSION_MADE_BY = 0x031e;
const FLAG_DATA_DESCRIPTOR = 0x0008;
const METHOD_DEFLATE = 8;
/** 0o100644: a regular file with rw-r--r--. */
const EXTERNAL_ATTRIBUTES = 0o100644 << 16;
/** Largest value the 32-bit size fields can hold without a Zip64 extension. */
const SIZE_LIMIT = 0xffffffff;
/** Signature, CRC and two sizes. */
const DATA_DESCRIPTOR_SIZE = 16;

/** Little-endian byte buffer. */
class ByteWriter {
  private bytes: number[] = [];

  byte(...values: number[]) {
    this.bytes.push(...values);
  }

  uint16(value: number) {
    for (let i = 0; i < 2; i++) this.bytes.push((value >>> (8 * i)) & 0xff);
  }

  uint32(value: number) {
    for (let i = 0; i < 4; i++) this.bytes.push((value >>> (8 * i)) & 0xff);
  }

  append(other: Uint8Array) {
    for (const value of other) this.bytes.push(value);
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

/** MS-DOS date and time: two-second resolution, 1980 onwards, local time. */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/**
 * The header opening the entry: the name and a promise that the sizes and CRC
 * follow the data in a descriptor.
 */
export function buildLocalFileHeader(name: Uint8Array, modified: Date): Uint8Array {
  const { time, date } = dosDateTime(modified);
  const out = new ByteWriter();
  out.uint32(LOCAL_FILE_HEADER);
  out.uint16(VERSION_NEEDED);
  out.uint16(FLAG_DATA_DESCRIPTOR);
  out.uint16(METHOD_DEFLATE);
  out.uint16(time);
  out.uint16(date);
  out.uint32(0); // crc32, in the descriptor
  out.uint32(0); // compressed size, in the descriptor
  out.uint32(0); // uncompressed size, in the descriptor
  out.uint16(name.length);
  out.uint16(0); // no extra field
  out.append(name);
  return out.toBytes();
}

/** What the local header deferred: the CRC and both sizes. */
export function buildDataDescriptor(crc: number, packedSize: number, unpackedSize: number): Uint8Array {
  const out = new ByteWriter();
  out.uint32(DATA_DESCRIPTOR);
  out.uint32(crc);
  out.uint32(packedSize);
  out.uint32(unpackedSize);
  return out.toBytes();
}

/** The directory record, which repeats the sizes a streaming writer had to defer. */
export function buildCentralDirectory(opts: {
  name: Uint8Array;
  crc: number;
  packedSize: number;
  unpackedSize: number;
  offset: number;
  modified: Date;
}): Uint8Array {
  const { time, date } = dosDateTime(opts.modified);
  const out = new ByteWriter();
  out.uint32(CENTRAL_FILE_HEADER);
  out.uint16(VERSION_MADE_BY);
  out.uint16(VERSION_NEEDED);
  out.uint16(FLAG_DATA_DESCRIPTOR);
  out.uint16(METHOD_DEFLATE);
  out.uint16(time);
  out.uint16(date);
  out.uint32(opts.crc);
  out.uint32(opts.packedSize);
  out.uint32(opts.unpackedSize);
  out.uint16(opts.name.length);
  out.uint16(0); // extra field length
  out.uint16(0); // comment length
  out.uint16(0); // disk number start
  out.uint16(0); // internal attributes
  out.uint32(EXTERNAL_ATTRIBUTES);
  out.uint32(opts.offset);
  out.append(opts.name);
  return out.toBytes();
}

/** Points the reader at the central directory. */
export function buildEndOfCentralDirectory(size: number, offset: number): Uint8Array {
  const out = new ByteWriter();
  out.uint32(END_OF_CENTRAL_DIRECTORY);
  out.uint16(0); // this disk
  out.uint16(0); // disk with the central directory
  out.uint16(1); // entries on this disk
  out.uint16(1); // entries in total
  out.uint32(size);
  out.uint32(offset);
  out.uint16(0); // comment length
  return out.toBytes();
}

export interface ZipEntrySizes {
  crc: number;
  packedSize: number;
  unpackedSize: number;
}

/**
 * Wraps `source` in a `.zip` holding one Deflate-compressed file called
 * `fileName`, compressing and packaging it as it arrives — nothing is buffered
 * beyond the chunks in flight, and the CRC and sizes are tallied on the way
 * through so the directory records are complete.
 */
export function zipSingleFileStream(
  fileName: string,
  source: ReadableStream<Uint8Array>,
  modified: Date = new Date(),
): ReadableStream<Uint8Array> {
  const name = new TextEncoder().encode(fileName);
  const header = buildLocalFileHeader(name, modified);

  const iterator = zipEntryChunks(name, header, source, modified);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.return(undefined);
    },
  });
}

/**
 * The archive as a sequence of byte chunks: the local header, the packed
 * stream, then the descriptor and the two directory records that close it.
 */
async function* zipEntryChunks(
  name: Uint8Array,
  header: Uint8Array,
  source: ReadableStream<Uint8Array>,
  modified: Date,
): AsyncGenerator<Uint8Array, void, unknown> {
  yield header;

  const deflate = new CompressionStream("deflate-raw");
  const writer = deflate.writable.getWriter();
  const reader = deflate.readable.getReader();
  let crc = 0;
  let unpackedSize = 0;
  let packedSize = 0;

  // Feed the compressor while reading its output, or its backpressure would
  // stall both sides.
  const input = source.getReader();
  const feeding = (async () => {
    try {
      for (;;) {
        const { done, value } = await input.read();
        if (done) break;
        crc = crc32(value, crc);
        unpackedSize += value.byteLength;
        await writer.write(value as Uint8Array<ArrayBuffer>);
      }
      await writer.close();
    } catch (error) {
      await writer.abort(error).catch(() => {});
      throw error;
    }
  })();

  // A client that walks away mid-download leaves the generator here, so stop
  // reading the database rather than dumping all of it into a dead stream.
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      packedSize += value.byteLength;
      if (packedSize > SIZE_LIMIT) throw new Error("Backup is too large for a ZIP archive");
      yield value;
    }
    await feeding;
  } catch (error) {
    await feeding.catch(() => {});
    throw error;
  } finally {
    await input.cancel().catch(() => {});
  }

  const sizes: ZipEntrySizes = { crc, packedSize, unpackedSize };
  yield buildDataDescriptor(sizes.crc, sizes.packedSize, sizes.unpackedSize);
  // The single entry starts at the archive's own first byte.
  const directory = buildCentralDirectory({ name, ...sizes, offset: 0, modified });
  yield directory;
  const directoryOffset = header.length + packedSize + DATA_DESCRIPTOR_SIZE;
  yield buildEndOfCentralDirectory(directory.length, directoryOffset);
}