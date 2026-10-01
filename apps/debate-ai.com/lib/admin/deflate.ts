/**
 * @fileoverview One DEFLATE pass over a dump, shared by every container that
 * stores it.
 *
 * A backup used to be compressed twice — once by
 * `CompressionStream("gzip")` for the R2 object and again by
 * `CompressionStream("deflate-raw")` inside the `.sql.7z` — even though the two
 * produce the *same* bytes: a gzip member is a 10-byte header, a raw DEFLATE
 * stream, and an 8-byte trailer, and the runtime's `gzip` and `deflate-raw`
 * codecs are the same DEFLATE. Compressing the same input twice is what pushed
 * a large "Save to R2" past the Worker's CPU limit
 * (`outcome: "exceededCpu"`).
 *
 * So compress once here and hand the packed stream to both:
 * {@link SharedDeflate.deflate} yields it chunk by chunk, and
 * {@link SharedDeflate.sizes} reports the CRC-32 and byte counts once the
 * stream ends. {@link gzipHeader} and {@link gzipTrailer} wrap that stream into
 * the gzip member R2 stores.
 * @module lib/admin/deflate
 */

import { crc32 } from "./seven-zip";

/** gzip member header: magic, DEFLATE, no flags, no mtime, no extra name. */
export const GZIP_HEADER = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff]);

/** The 8 bytes closing a gzip member: CRC-32 and the input size, both little-endian. */
export function gzipTrailer(crc: number, uncompressedSize: number): Uint8Array {
  const out = new Uint8Array(8);
  const view = new DataView(out.buffer);
  view.setUint32(0, crc >>> 0, true);
  view.setUint32(4, uncompressedSize >>> 0, true);
  return out;
}

export interface DeflateSizes {
  /** CRC-32 of the *uncompressed* input, as both gzip and 7z record it. */
  crc: number;
  /** Bytes of the DEFLATE stream itself. */
  packedSize: number;
  /** Bytes of the original input. */
  uncompressedSize: number;
}

/**
 * Compresses an async sequence of byte chunks exactly once.
 *
 * Call {@link deflate} and iterate it to the end — the CRC and sizes are only
 * final once the stream closes, so read them from {@link sizes} afterwards
 * rather than expecting them mid-stream.
 */
export class SharedDeflate {
  private crc = 0;
  private packedSize = 0;
  private uncompressedSize = 0;

  /** Valid once the {@link deflate} generator has run to completion. */
  get sizes(): DeflateSizes {
    return { crc: this.crc, packedSize: this.packedSize, uncompressedSize: this.uncompressedSize };
  }

  /**
   * Yields the DEFLATE stream for `chunks`, feeding the compressor and reading
   * its output concurrently so neither side's backpressure stalls the other.
   * The CRC and the uncompressed length are tallied on the way in.
   */
  async *deflate(chunks: AsyncIterable<Uint8Array>): AsyncGenerator<Uint8Array, void, unknown> {
    const deflate = new CompressionStream("deflate-raw");
    const writer = deflate.writable.getWriter();
    const reader = deflate.readable.getReader();

    const feeding = (async () => {
      try {
        for await (const chunk of chunks) {
          this.crc = crc32(chunk, this.crc);
          this.uncompressedSize += chunk.byteLength;
          await writer.write(chunk as Uint8Array<ArrayBuffer>);
        }
        await writer.close();
      } catch (error) {
        await writer.abort(error).catch(() => {});
        throw error;
      }
    })();

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        this.packedSize += value.byteLength;
        yield value;
      }
      await feeding;
    } catch (error) {
      await feeding.catch(() => {});
      throw error;
    }
  }
}