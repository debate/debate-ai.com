/**
 * Headless `.docx` → `.cmir` conversion, plus the text encoding the web app
 * stores a `.cmir` in.
 *
 * The desktop bulk converter (`editor/bulk-convert-ui.ts`) already pairs
 * `fromDocxFull` with `serializeNative`; this module is the same conversion
 * with no Electron host, no DOM and no ProseMirror view behind it, so a
 * server route (debate-ai.com's admin importer) can run it on an uploaded
 * file. Everything here stays import-safe outside a browser: the schema,
 * the OOXML reader and the gzip codec are all pure.
 *
 * `.cmir` is binary (gzipped JSON), and the library that holds imported
 * files stores its content in a SQLite text column, so the bytes travel as
 * base64. {@link looksLikeCmirBase64} is what lets a reader tell a stored
 * `.cmir` from the HTML that rows imported before this format carry.
 */

import type { Node as PMNode } from 'prosemirror-model';
import { fromDocxFull } from '../import/index.js';
import { bytesToBase64, base64ToBytes } from '../ooxml/base64.js';
import { isGzip } from './codec.js';
import { serializeNative } from './index.js';

export interface DocxToCmirResult {
  /** The `.cmir` file's bytes: gzipped JSON, ready to write to disk. */
  bytes: Uint8Array;
  /** The imported document, for callers that also want to index its text. */
  doc: PMNode;
  /** Comment threads carried over from the `.docx`, embedded in `bytes`. */
  threadCount: number;
}

export interface DocxToCmirOptions {
  /** App version written into the file's `createdBy` field. */
  appVersion?: string;
}

/**
 * Convert `.docx` bytes to a `.cmir` file.
 *
 * The import is CardMirror's own OOXML reader, so Verbatim's card structure
 * (pocket / hat / block / tag / analytic), highlighting, comments and inline
 * images survive into the native document rather than being flattened to
 * markup. Throws whatever `fromDocxFull` throws for bytes that are not a
 * readable `.docx` — callers that import in bulk catch per file.
 */
export async function docxToCmir(
  bytes: Uint8Array | ArrayBuffer,
  opts: DocxToCmirOptions = {},
): Promise<DocxToCmirResult> {
  const { doc, threads, docId } = await fromDocxFull(bytes);
  return {
    bytes: serializeNative(doc, {
      ...(threads.length ? { threads } : {}),
      ...(docId ? { docId } : {}),
      ...(opts.appVersion ? { appVersion: opts.appVersion } : {}),
    }),
    doc,
    threadCount: threads.length,
  };
}

/** Encode `.cmir` bytes for storage in a text column or a JSON payload. */
export function cmirToBase64(bytes: Uint8Array): string {
  return bytesToBase64(bytes);
}

/** Decode what {@link cmirToBase64} stored. Throws on malformed base64. */
export function base64ToCmir(text: string): Uint8Array {
  return base64ToBytes(text);
}

/** How much of a stored string is decoded to identify it: enough base64 for
 *  the gzip magic and, in a legacy uncompressed file, the format identifier
 *  that follows within the first few dozen bytes. */
const SNIFF_CHARS = 256;

/**
 * Whether a stored string is base64-encoded `.cmir` rather than something
 * else (HTML from an older import, plain text, an empty folder row).
 *
 * Decodes only the head, so this is cheap to call on every row of a
 * catalogue listing. The head is not inflated: the two magic bytes that open
 * a gzip stream identify it on their own, and inflating a deliberately
 * truncated one would be reading a partial file to learn what the first two
 * bytes already said. Uncompressed files (written before `.cmir` was
 * gzipped) still carry the format id in the clear.
 */
export function looksLikeCmirBase64(text: string): boolean {
  if (!text || /^\s*</.test(text)) return false;
  // A base64 length is always a multiple of 4; trimming to one keeps `atob`
  // from rejecting the head of an otherwise valid string.
  const head = text.trim().slice(0, SNIFF_CHARS);
  const aligned = head.slice(0, head.length - (head.length % 4));
  if (!aligned) return false;
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(aligned);
  } catch {
    return false;
  }
  if (isGzip(bytes)) return true;
  return new TextDecoder().decode(bytes).includes('"cardmirror-doc"');
}
