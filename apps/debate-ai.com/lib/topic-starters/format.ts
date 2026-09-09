/**
 * @fileoverview How a Topic Starter row's `content` column is encoded.
 *
 * Imported files are stored as CardMirror native files (`.cmir`, gzipped
 * JSON, base64-encoded to fit a text column). Rows imported before that are
 * HTML, and stay readable: the `format` column says which a row is, and
 * {@link isCmirContent} reads it — sniffing the content only when it arrives
 * without that column.
 *
 * @module lib/topic-starters/format
 */
import { looksLikeCmirBase64 } from "debate-editor/engine";

/** Storage formats a row's `content` can be in. */
export const TOPIC_STARTER_FORMATS = {
  /** Base64-encoded `.cmir` — what every import writes now. */
  cmir: "cmir",
  /** Card HTML — rows imported before the `.cmir` importer landed. */
  html: "html",
} as const;

export type TopicStarterFormat =
  (typeof TOPIC_STARTER_FORMATS)[keyof typeof TOPIC_STARTER_FORMATS];

/** The subset of a Topic Starter row this module needs. */
export interface StoredTopicStarterContent {
  content?: string | null;
  format?: string | null;
}

/**
 * Whether a row holds a base64 `.cmir` rather than HTML.
 *
 * The column decides whenever it is present — every row in the database has
 * it, since the migration that added it defaults existing (HTML) rows to
 * `"html"`. The sniff is for content that reaches this function without its
 * row: a payload assembled by hand, or a caller that selected only
 * `content`.
 */
export function isCmirContent(item: StoredTopicStarterContent): boolean {
  const content = item.content ?? "";
  if (!content) return false;
  if (item.format === TOPIC_STARTER_FORMATS.cmir) return true;
  if (item.format === TOPIC_STARTER_FORMATS.html) return false;
  return looksLikeCmirBase64(content);
}
