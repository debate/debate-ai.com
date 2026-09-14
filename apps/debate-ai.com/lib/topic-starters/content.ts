"use client";

/**
 * @fileoverview Renders a stored Topic Starter file for the editor.
 *
 * A thin alias over `lib/cardmirror/stored-cmir.ts`, which does this for every
 * stored file the app opens — the reader's own uploads included — so the
 * public library and the private sidebar cannot disagree about what a `.cmir`
 * row renders as.
 *
 * @module lib/topic-starters/content
 */
import { storedContentToHtml } from "../cardmirror/stored-cmir";
import type { StoredTopicStarterContent } from "./format";

/**
 * Turns a stored Topic Starter row into HTML the editor can open.
 *
 * @param item - The row, or any object carrying its `content` and `format`.
 * @returns HTML for the editor's `content` prop.
 */
export function topicStarterHtml(item: StoredTopicStarterContent): string {
  return storedContentToHtml(item);
}
