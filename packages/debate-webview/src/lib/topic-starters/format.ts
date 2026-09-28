/**
 * @fileoverview How a Topic Starter row's `content` column is encoded.
 *
 * The rules are the app's, not this table's — the reader's own `documents`
 * store files the same way — so they live in `lib/cardmirror/format.ts` and
 * this module is the Topic Starter names for them, kept so existing callers
 * and their tests keep reading in this table's vocabulary.
 *
 * @module lib/topic-starters/format
 */
// Relative rather than through the `@/` alias: this module is pulled into a
// unit test, and the app's alias does not resolve under the test runner.
import { STORED_FORMATS, type StoredContent } from "../cardmirror/format";
import { isCmirContent } from "../cardmirror/content-format";

/** Storage formats a row's `content` can be in. */
export const TOPIC_STARTER_FORMATS = STORED_FORMATS;

export type TopicStarterFormat =
  (typeof TOPIC_STARTER_FORMATS)[keyof typeof TOPIC_STARTER_FORMATS];

/** The subset of a Topic Starter row this module needs. */
export type StoredTopicStarterContent = StoredContent;

/** Whether a row holds a base64 `.cmir` rather than HTML. */
export { isCmirContent };
