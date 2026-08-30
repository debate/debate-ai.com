/**
 * Shared shape for the `footnote` node's `content` attr — the note
 * body flattened to paragraphs of simplified runs. Deliberately a
 * plain-JSON model (no PM nodes): footnotes in debate source material
 * are read-only citations, and plain JSON survives .cmir, clipboard,
 * and undo round-trips with no sidecar bookkeeping.
 */

export interface FootnoteRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Hyperlink target URL when this run sits inside `<w:hyperlink>`. */
  link?: string;
}

/** Paragraphs of runs. */
export type FootnoteContent = FootnoteRun[][];

/** The note body as plain text — paragraphs joined by newlines. Used
 *  by the popover's plain-text editor and as a tooltip preview. */
export function footnotePlainText(content: FootnoteContent): string {
  return content.map((para) => para.map((r) => r.text).join('')).join('\n');
}

/** Plain text back to content — one run per non-empty line. The
 *  popover's plain-text editing path: formatting within edited notes
 *  is dropped, matching what a plain textarea can express. */
export function plainTextToFootnoteContent(text: string): FootnoteContent {
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? [{ text: line }] : []))
    .filter((para, i, all) => para.length > 0 || (i > 0 && i < all.length - 1));
}
