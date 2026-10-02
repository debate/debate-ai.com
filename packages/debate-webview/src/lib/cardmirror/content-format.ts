/**
 * @fileoverview Telling a stored `.cmir` from stored HTML.
 *
 * The sniff mirrors CardMirror's `looksLikeCmirBase64` (@debate/editor's
 * `native/convert.ts`) rather than importing it: this module is reached from
 * the docs sidebar on every page, and `@debate/editor/engine` would put the
 * whole editor engine into the app shell's startup bundle for a check that
 * only reads two bytes. `test/lib/cardmirror/content-format.test.ts` keeps
 * the two in step.
 *
 * @module lib/cardmirror/content-format
 */
import { STORED_FORMATS, type StoredContent } from "./format";

/** How much of the base64 text the sniff decodes — enough for the format id
 *  of an uncompressed file, and far more than a gzip header needs. */
const SNIFF_CHARS = 256;

/**
 * Whether base64 text is a `.cmir` file (gzipped, or the older uncompressed
 * JSON carrying the `"cardmirror-doc"` format id) rather than HTML or plain
 * text. Decodes only the head, so it is cheap on every row of a listing.
 */
export function looksLikeCmirBase64(text: string): boolean {
  if (!text || /^\s*</.test(text)) return false;
  // A base64 length is always a multiple of 4; trimming to one keeps `atob`
  // from rejecting the head of an otherwise valid string.
  const head = text.trim().slice(0, SNIFF_CHARS);
  const aligned = head.slice(0, head.length - (head.length % 4));
  if (!aligned) return false;
  let binary: string;
  try {
    binary = atob(aligned);
  } catch {
    return false;
  }
  if (binary.length >= 2 && binary.charCodeAt(0) === 0x1f && binary.charCodeAt(1) === 0x8b) return true;
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes).includes('"cardmirror-doc"');
}

/**
 * Whether a row holds a base64 `.cmir` rather than HTML.
 *
 * The column decides whenever it is present — every row in the database has
 * it, since the migrations that added it default existing (HTML) rows to
 * `"html"`. The sniff is for content that reaches this function without its
 * row: a payload assembled by hand, or a caller that selected only `content`.
 */
export function isCmirContent(item: StoredContent): boolean {
  const content = item.content ?? "";
  if (!content) return false;
  if (item.format === STORED_FORMATS.cmir) return true;
  if (item.format === STORED_FORMATS.html) return false;
  return looksLikeCmirBase64(content);
}
