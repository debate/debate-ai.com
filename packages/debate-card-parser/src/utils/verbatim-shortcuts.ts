/** @fileoverview Pure logic behind Verbatim/Cardmirror-style card-editing shortcuts:
 *  condensing a card to its read (underlined) text, formatting a short cite
 *  tag, and reordering outline nodes (headings/cards). */
import type { Card, CardYear, OutlineNode } from "../types/types";

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
 * Moves an outline node (heading or card) one slot up or down, mirroring
 * Verbatim's "move heading" reorder shortcut. Returns a new array; returns
 * the same array reference unchanged when the move would go out of bounds.
 *
 * @param outline - Outline nodes in document order.
 * @param index - Index of the node to move.
 * @param direction - `"up"` swaps with the previous node, `"down"` with the next.
 */
export function moveOutlineNode(
  outline: OutlineNode[],
  index: number,
  direction: "up" | "down",
): OutlineNode[] {
  if (index < 0 || index >= outline.length) return outline;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= outline.length) return outline;

  const next = outline.slice();
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}
