/**
 * @fileoverview Presentation logic for evidence result cards.
 *
 * The result list is how a debater picks evidence under time pressure, so what
 * each card shows — and in what order — is real logic, not styling. Keeping it
 * here (React-free) means the tag/citation hierarchy, the query highlighting,
 * the metadata ordering and the accessible label can all be unit tested
 * without rendering anything.
 *
 * @module lib/card-display
 */

import type { SearchResult } from "../types";

/**
 * Debate argument categories, in the order a card's badge should read them.
 *
 * The colour carries meaning here: a scanning debater picks a disadvantage out
 * of a list of counterplans by hue long before reading the label.
 */
export const CATEGORY_STYLES: Record<string, { label: string; badge: string; accent: string }> = {
  DA: { label: "DA", badge: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300", accent: "bg-rose-500" },
  CP: { label: "CP", badge: "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300", accent: "bg-violet-500" },
  K: { label: "K", badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300", accent: "bg-amber-500" },
  T: { label: "T", badge: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300", accent: "bg-sky-500" },
  I: { label: "Impact", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300", accent: "bg-emerald-500" },
  AFF: { label: "Aff", badge: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300", accent: "bg-blue-500" },
  NEG: { label: "Neg", badge: "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300", accent: "bg-orange-500" },
};

/** Fallback styling for a category the palette does not know. */
const DEFAULT_CATEGORY_STYLE = {
  label: "Card",
  badge: "bg-muted text-muted-foreground",
  accent: "bg-muted-foreground/40",
};

/**
 * Resolves the badge and accent styling for a card's category.
 *
 * @param category - Raw category string from the search index.
 * @returns Display label plus the badge and accent-bar class names.
 */
export function categoryStyle(category: string | undefined) {
  if (!category) return DEFAULT_CATEGORY_STYLE;
  const style = CATEGORY_STYLES[category.trim().toUpperCase()];
  return style ?? { ...DEFAULT_CATEGORY_STYLE, label: category };
}

/**
 * Abbreviates a count for a badge that has room for four characters.
 *
 * @param count - A non-negative count.
 * @returns A compact label such as `"1.2k"` or `"14k"`.
 */
export function formatCompactCount(count: number | undefined): string {
  if (!count || count < 0) return "0";
  if (count < 1000) return String(Math.round(count));
  const thousands = count / 1000;
  if (thousands < 10) return `${(Math.floor(thousands * 10) / 10).toFixed(1)}k`;
  if (count < 1_000_000) return `${Math.floor(thousands)}k`;
  return `${(Math.floor((count / 1_000_000) * 10) / 10).toFixed(1)}m`;
}

/**
 * Renders a card's two-digit year as the debate season it belongs to.
 *
 * `"24"` is not a year to a debater, it is the 2023-24 season — spelling that
 * out removes a mental step from every card in the list.
 *
 * @param year - Two- or four-digit year from the card.
 * @returns A season label such as `"2023-24"`, or `""` when unparseable.
 */
export function formatSeason(year: string | undefined): string {
  if (!year) return "";
  const digits = year.trim().replace(/\D/g, "");
  if (!digits) return "";
  const full = digits.length <= 2 ? 2000 + Number(digits) : Number(digits.slice(0, 4));
  if (!Number.isFinite(full) || full < 1900 || full > 2999) return "";
  return `${full - 1}-${String(full).slice(2)}`;
}

/**
 * Builds the provenance line under a card, in the order it is scanned.
 *
 * School and tournament identify whether the evidence has already been read
 * against you; side and season qualify it. Blank fields are dropped rather
 * than rendered as separators with nothing between them.
 *
 * @param result - The search result.
 * @returns Ordered, non-empty provenance fragments.
 */
export function cardProvenance(result: SearchResult): string[] {
  return [
    result.school,
    result.team,
    result.tournament,
    result.round,
    result.side,
    formatSeason(result.year),
  ]
    .map((part) => part?.toString().trim())
    .filter((part): part is string => Boolean(part));
}

/**
 * Picks the best available body text for a card and trims it to one preview.
 *
 * Falls back through summary → tag → argument block, because a card indexed
 * without a summary would otherwise render as a blank row.
 *
 * @param result - The search result.
 * @param maxChars - Longest preview to return.
 * @returns Preview text, truncated on a word boundary with an ellipsis.
 */
export function cardPreview(result: SearchResult, maxChars = 240): string {
  const source = [result.summary, result.tag, result.argBlock]
    .map((value) => value?.toString().trim())
    .find(Boolean);
  if (!source) return "";
  const collapsed = source.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxChars) return collapsed;
  const clipped = collapsed.slice(0, maxChars);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > maxChars * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

/**
 * Fraction of a card that is highlighted for reading.
 *
 * A card that is 5% highlighted reads in seconds; one that is 60% highlighted
 * is a wall. Surfacing the ratio lets that be judged before opening the card.
 *
 * @param result - The search result.
 * @returns A ratio in `[0, 1]`, or `null` when the card has no length data.
 */
export function highlightRatio(result: SearchResult): number | null {
  const total = Number(result.textLength);
  const highlighted = Number(result.highlightLength);
  if (!Number.isFinite(total) || total <= 0) return null;
  if (!Number.isFinite(highlighted) || highlighted < 0) return null;
  return Math.min(1, highlighted / total);
}

/** One run of text in a preview, flagged as matching the query or not. */
export interface HighlightSegment {
  text: string;
  match: boolean;
}

/**
 * Splits text into matched and unmatched runs against the search query.
 *
 * Showing *why* a card matched is what makes a long result list scannable.
 * Query text is treated as plain words: it is stripped of regex metacharacters
 * and of the quoting/operator punctuation a search box collects, so a query
 * like `"warming" -econ` cannot produce a broken pattern.
 *
 * @param text - The text to segment.
 * @param query - The raw search term.
 * @returns Consecutive segments that re-join to exactly the input text.
 */
export function splitHighlightSegments(text: string, query: string): HighlightSegment[] {
  if (!text) return [];
  const terms = Array.from(
    new Set(
      (query ?? "")
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((term) => term.length >= 2),
    ),
  ).sort((a, b) => b.length - a.length);

  if (terms.length === 0) return [{ text, match: false }];

  const pattern = new RegExp(
    `(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ text: text.slice(cursor, start), match: false });
    segments.push({ text: match[0], match: true });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
  return segments;
}

/**
 * Builds the screen-reader label for a result card.
 *
 * The visual card leans on colour and badge position; the label has to say the
 * same things in words, in the same order.
 *
 * @param result - The search result.
 * @param position - 1-based position in the result list.
 * @param total - Number of results shown.
 * @returns A single sentence describing the card.
 */
export function cardAriaLabel(result: SearchResult, position: number, total: number): string {
  const parts = [
    `Result ${position} of ${total}`,
    categoryStyle(result.category).label,
    result.tag?.trim() || result.argBlock?.trim() || "Untitled card",
  ];
  const cite = result.cite_short?.trim();
  if (cite) parts.push(cite);
  const provenance = cardProvenance(result);
  if (provenance.length > 0) parts.push(provenance.join(", "));
  if (result.word_count) parts.push(`${result.word_count} words`);
  return parts.join(". ");
}

/**
 * Describes the current result list for the count line above it.
 *
 * @param shown - Results currently rendered.
 * @param total - Results the query matched overall.
 * @returns A short status line, or `""` when there is nothing to say.
 */
export function resultCountLabel(shown: number, total: number): string {
  if (shown === 0) return "";
  if (!total || total <= shown) return `${shown} card${shown === 1 ? "" : "s"}`;
  return `${shown} of ${total.toLocaleString()} cards`;
}
