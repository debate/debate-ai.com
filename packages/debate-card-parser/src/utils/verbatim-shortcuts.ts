/** @fileoverview Pure logic behind Verbatim/Cardmirror-style card-editing shortcuts:
 *  condensing a card to its read (underlined) text, formatting a short cite
 *  tag, reordering outline nodes (headings/cards), and toggling `<mark>`
 *  text emphasis over a selection range. */
import type { Card, CardYear } from "../types/types";

const UNDERLINE_RE = /<u[^>]*>[\s\S]*?<\/u>/gi;

/**
 * Condenses card HTML down to its underlined ("read") runs, the way
 * Verbatim's condense command hides everything a debater wouldn't read
 * aloud. Nested formatting (e.g. `<mark>` emphasis) inside each underlined
 * run is preserved; adjacent runs separated only by whitespace are joined
 * directly, while runs separated by skipped material get an ellipsis.
 *
 * @param html - Full card HTML, as produced by `finalizeCard`.
 * @param options.ellipsis - Separator inserted between non-adjacent
 *   underlined runs. Defaults to `" … "`.
 * @returns The condensed HTML, or `""` when the card has no underlined text.
 */
export function condenseCardHtml(
  html: string,
  options: { ellipsis?: string } = {},
): string {
  const ellipsis = options.ellipsis ?? " … ";
  if (!html) return "";

  const runs: string[] = [];
  let lastIndex = 0;
  let firstStart = -1;
  let sawGap = false;

  UNDERLINE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = UNDERLINE_RE.exec(html)) !== null) {
    if (firstStart === -1) firstStart = match.index;

    const between = html.slice(lastIndex, match.index);
    // Only whitespace/tags between runs counts as "adjacent"; any visible
    // text in the gap means the runs are not adjacent and need a separator.
    const betweenText = between.replace(/<[^>]*>/g, "").trim();
    if (runs.length > 0 && betweenText.length > 0) sawGap = true;

    runs.push(match[0]);
    lastIndex = UNDERLINE_RE.lastIndex;
  }

  if (runs.length === 0) return "";

  const trailingText = html.slice(lastIndex).replace(/<[^>]*>/g, "").trim();
  const leadingText = html.slice(0, firstStart).replace(/<[^>]*>/g, "").trim();

  const usesEllipsis = sawGap || trailingText.length > 0 || leadingText.length > 0;
  return runs.join(usesEllipsis ? ellipsis : " ");
}

/**
 * Formats a Verbatim-style short cite tag ("Smith 24", "Smith ND") from a
 * card's author and year, for hover/hotkey citation insertion.
 *
 * @param card - Card fields to format from.
 * @returns The short cite tag, or `null` when there is no author to cite.
 */
export function formatShortCiteTag(
  card: Pick<Card, "author"> & { year?: CardYear },
): string | null {
  const author = card.author?.trim();
  if (!author) return null;

  const year = card.year;
  if (typeof year === "number" && Number.isFinite(year)) {
    const twoDigit = String(Math.abs(Math.trunc(year)) % 100).padStart(2, "0");
    return `${author} ${twoDigit}`;
  }

  return `${author} ND`;
}

/**
 * Returns the html-string index of each visible (tag-stripped) character,
 * in order, so a caller can address `html` by what a user actually sees and
 * selects rather than raw markup position.
 */
function buildVisibleCharPositions(html: string): number[] {
  const positions: number[] = [];
  let i = 0;
  while (i < html.length) {
    if (html[i] === "<") {
      const close = html.indexOf(">", i);
      i = close === -1 ? html.length : close + 1;
      continue;
    }
    positions.push(i);
    i += 1;
  }
  return positions;
}

/**
 * Resolves a (clamped) visible-text offset to its html-string index: the raw
 * position of the visible character at that offset, or — for the offset one
 * past the last visible character — the position right after it, excluding
 * any tags that immediately precede or follow.
 */
function resolveHtmlBoundary(positions: number[], offset: number): number {
  const n = positions.length;
  const clamped = Math.min(Math.max(offset, 0), n);
  if (clamped < n) return positions[clamped]!;
  return n > 0 ? positions[n - 1]! + 1 : 0;
}

const MARK_OPEN = "<mark>";
const MARK_CLOSE = "</mark>";

/**
 * Toggles Verbatim/Cardmirror-style `<mark>` text emphasis over `[start,
 * end)` of `html`'s *visible* (tag-stripped) text, mirroring the editor's
 * "emphasize selection" shortcut. Offsets are visible-character positions,
 * not raw HTML string indices, so a selection lands correctly around
 * existing markup (e.g. `<u>` runs) — out-of-range offsets are clamped to
 * the visible text's bounds.
 *
 * - A collapsed selection (`start === end`) is a no-op.
 * - When the selection exactly matches an existing `<mark>` run's bounds,
 *   that `<mark>`/`</mark>` pair is removed (un-emphasize).
 * - Otherwise the selection is wrapped in a new `<mark>`/`</mark>` pair. Any
 *   `<mark>`/`</mark>` tags already touching the selection — inside it, or
 *   immediately adjacent on either side — are absorbed into the new pair
 *   rather than left nested, so overlapping emphasis merges into one run.
 *
 * @param html - Full card HTML.
 * @param start - Visible-text offset where the selection begins.
 * @param end - Visible-text offset where the selection ends (exclusive).
 * @returns The updated HTML with emphasis toggled over the selection.
 */
export function toggleEmphasisHtml(html: string, start: number, end: number): string {
  if (start === end) return html;

  const positions = buildVisibleCharPositions(html);
  const [from, to] = start < end ? [start, end] : [end, start];
  const htmlStart = resolveHtmlBoundary(positions, from);
  const htmlEnd = resolveHtmlBoundary(positions, to);
  if (htmlStart === htmlEnd) return html;

  const before = html.slice(0, htmlStart);
  const after = html.slice(htmlEnd);

  if (before.endsWith(MARK_OPEN) && after.startsWith(MARK_CLOSE)) {
    return (
      before.slice(0, before.length - MARK_OPEN.length) +
      html.slice(htmlStart, htmlEnd) +
      after.slice(MARK_CLOSE.length)
    );
  }

  const absorbedBefore = before.endsWith(MARK_OPEN) ? before.slice(0, before.length - MARK_OPEN.length) : before;
  const absorbedAfter = after.startsWith(MARK_CLOSE) ? after.slice(MARK_CLOSE.length) : after;
  const inner = html.slice(htmlStart, htmlEnd).replace(/<\/?mark>/gi, "");
  return `${absorbedBefore}${MARK_OPEN}${inner}${MARK_CLOSE}${absorbedAfter}`;
}

/**
 * Moves an outline entry (heading or card, or any other document-ordered
 * list an outline is built from — e.g. a live editor's heading outline)
 * one slot up or down, mirroring Verbatim's "move heading" reorder
 * shortcut. Returns a new array; returns the same array reference
 * unchanged when the move would go out of bounds.
 *
 * Generic over the entry type so callers with their own outline shape
 * (this module's `OutlineNode`, or e.g. `reason-editor`'s live-document
 * `OutlineHeading`) can reuse the same bounds-checked swap directly
 * instead of reimplementing it.
 *
 * @param outline - Outline entries in document order.
 * @param index - Index of the entry to move.
 * @param direction - `"up"` swaps with the previous entry, `"down"` with the next.
 */
export function moveOutlineNode<T>(
  outline: T[],
  index: number,
  direction: "up" | "down",
): T[] {
  if (index < 0 || index >= outline.length) return outline;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= outline.length) return outline;

  const next = outline.slice();
  const moved = next[index]!;
  next[index] = next[targetIndex]!;
  next[targetIndex] = moved;
  return next;
}
