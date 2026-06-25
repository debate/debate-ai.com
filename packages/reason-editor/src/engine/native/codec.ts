/**
 * Gzip codec for the `.cmir` container.
 *
 * `.cmir` files are gzip-wrapped JSON envelopes (the JSON shape and
 * `formatVersion` are unchanged — compression is a container concern).
 * Format is self-describing by magic bytes, so old plaintext files and
 * new compressed files coexist with no version flag:
 *
 *   - legacy plaintext always begins with `{` (0x7B);
 *   - gzip always begins with 0x1F 0x8B.
 *
 * These never collide, so a reader sniffs the first two bytes and decides.
 *
 * Uses `fflate` (synchronous, dependency-free) rather than `node:zlib` so
 * the same code runs in the Electron renderer and the browser build — the
 * read/write path is synchronous and called from many sites, and `node:zlib`
 * isn't available in the browser bundle (and `CompressionStream` is async).
 * The main-process bulk-compress tool uses `node:zlib` directly for raw
 * throughput; both emit standard gzip and are fully interoperable.
 */

import { gzipSync, gunzipSync } from 'fflate';

/** True when `bytes` is a gzip stream (magic 0x1F 0x8B). */
export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/** Gzip `bytes`. `mtime: 0` keeps the output deterministic (identical
 *  content → identical bytes), which helps sync/dedup. Level 6 matches the
 *  repo's existing DEFLATE level and is the size/speed sweet spot. */
export function gzip(bytes: Uint8Array): Uint8Array {
  return gzipSync(bytes, { level: 6, mtime: 0 });
}

/** Inflate a gzip stream produced by `gzip` (or any standard gzip). */
export function gunzip(bytes: Uint8Array): Uint8Array {
  return gunzipSync(bytes);
}
