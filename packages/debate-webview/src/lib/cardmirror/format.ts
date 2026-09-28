/**
 * @fileoverview How a stored CardMirror file's `content` column is encoded.
 *
 * Two tables hold files the editor opens — the reader's own `documents` and
 * the public `topic_starter_items` — and both keep the same two shapes in a
 * SQLite text column: CardMirror's native `.cmir` (gzipped JSON, base64) for
 * anything imported since the app switched to it, and HTML for rows written
 * before that. The `format` column says which, so a reader never has to guess.
 *
 * Kept table-agnostic so the documents sidebar and the Topic Starter
 * catalogue cannot drift apart on what "a stored file" means, and kept free of
 * any import so a route that only has to validate the column doesn't pull the
 * editor engine into its bundle — the content sniff that does need it lives
 * next door in `./content-format`.
 *
 * @module lib/cardmirror/format
 */

/** Storage formats a row's `content` can be in. */
export const STORED_FORMATS = {
  /** Base64-encoded `.cmir` — what every import writes now. */
  cmir: "cmir",
  /** Card HTML — rows written before the `.cmir` importer landed, and blank
   *  documents created in the editor itself. */
  html: "html",
} as const;

export type StoredFormat = (typeof STORED_FORMATS)[keyof typeof STORED_FORMATS];

/** The subset of a stored row the format helpers need. */
export interface StoredContent {
  content?: string | null;
  format?: string | null;
}

/** Narrows an arbitrary value to a format the columns accept, defaulting to
 *  HTML — the shape a row has when nothing says otherwise. Unrecognized input
 *  is narrowed rather than trusted: `format` is what tells a reader whether to
 *  gunzip the column or hand it to the editor as markup, so a value nothing
 *  understands would make the row unreadable. */
export function normalizeFormat(value: unknown): StoredFormat {
  return value === STORED_FORMATS.cmir ? STORED_FORMATS.cmir : STORED_FORMATS.html;
}
