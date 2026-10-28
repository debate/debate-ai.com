/**
 * @fileoverview The one place video totals are turned into display strings.
 *
 * The three surfaces that show a count — the sidebar tree
 * (`TreeItem`), the quick-link tiles (`QuickLinksGrid`) and the search
 * suggestion chips (`VideoSearchSuggestions`) — each had their own copy of
 * the same abbreviation, so changing how a count reads meant finding all
 * three. Every one of them now calls this instead.
 *
 * @module format-count
 */

/**
 * Renders a view count in k format (e.g., 0.3k, 1.3k, 12k).
 * Always shows one decimal place for values under 10k, no decimals for 10k+.
 */
export function formatCount(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1000).toFixed(1)}k`;
}
