/**
 * @fileoverview The one place video totals are turned into display strings.
 *
 * The three surfaces that show a count — the sidebar tree
 * (`TreeItem`), the quick-link tiles (`QuickLinksGrid`) and the search
 * suggestion chips (`VideoSearchSuggestions`) — each had their own copy of
 * the same abbreviation, so changing how a count reads meant finding all
 * three. Every one of them now calls this instead.
 *
 * @module components/category-gallery/format-count
 */

/**
 * Renders a video total, shortening thousands to `1.4k` to keep the count
 * from crowding out the title it sits next to.
 *
 * Pass `exact` for a total that reads better in full. The College Debates
 * total is the case for it: it is the round archive's headline number, the
 * one a visitor checks the site by, and rounding it to `1.4k` both hides the
 * digits and understates a collection that is past fourteen hundred.
 */
export function formatCount(n: number, { exact = false }: { exact?: boolean } = {}): string {
  if (!exact && n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}
