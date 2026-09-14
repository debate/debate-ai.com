/**
 * @fileoverview Telling a stored `.cmir` from stored HTML.
 *
 * Split from `./format` (which is import-free on purpose) because the sniff
 * below needs CardMirror's own reader, and a route that only validates the
 * `format` column shouldn't carry the editor engine for it.
 *
 * @module lib/cardmirror/content-format
 */
import { looksLikeCmirBase64 } from "debate-editor/engine";
import { STORED_FORMATS, type StoredContent } from "./format";

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
