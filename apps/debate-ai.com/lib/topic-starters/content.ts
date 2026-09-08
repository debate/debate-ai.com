"use client";

/**
 * @fileoverview Renders a stored Topic Starter file for the editor.
 *
 * Rows hold a `.cmir` (see `./import`), and the editor's props take an HTML
 * string, so the file is parsed with CardMirror's native reader and
 * serialized through its own schema on the way in. That runs in the browser,
 * where the editor bundle already lives, rather than making every catalogue
 * response pay for a conversion the reader may never open.
 *
 * @module lib/topic-starters/content
 */
import { docToHtml } from "debate-editor";
import { base64ToCmir, parseNative } from "debate-editor/engine";
import { isCmirContent, type StoredTopicStarterContent } from "./format";

/** Escapes text for interpolation into the failure notice below. */
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]!,
  );
}

/**
 * Turns a stored Topic Starter row into HTML the editor can open.
 *
 * Legacy HTML rows pass through untouched. A `.cmir` that will not parse
 * returns a notice rather than an empty document — a blank page reads as a
 * file with nothing in it, which is the one thing a damaged file is not.
 *
 * @param item - The row, or any object carrying its `content` and `format`.
 * @returns HTML for the editor's `content` prop.
 */
export function topicStarterHtml(item: StoredTopicStarterContent): string {
  const content = item.content ?? "";
  if (!isCmirContent(item)) return content;
  try {
    return docToHtml(parseNative(base64ToCmir(content)).doc);
  } catch (error) {
    console.error("[topic-starters] could not open stored .cmir", error);
    return `<p>This file could not be opened (${escapeHtml(
      error instanceof Error ? error.message : String(error),
    )}).</p>`;
  }
}
