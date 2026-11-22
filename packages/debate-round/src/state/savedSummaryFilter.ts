/**
 * @fileoverview Search for the "Saved to account" tab of `FlowHistoryDialog`:
 * narrows the account's saved flows (`saved_flows`) and saved rounds
 * (`saved_rounds`) by a typed query. Pure and fetch-free so the dialog and
 * its tests share one definition of "matches".
 *
 * @module state/savedSummaryFilter
 */

/** The fields of a saved flow/round summary the search reads. */
export type SearchableSavedSummary = {
  clientId: number;
  label: string;
};

/**
 * Splits a query into lowercase words. Empty when the query is blank, which
 * callers treat as "no filter".
 */
export function savedSummaryQueryTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Keeps the summaries whose label — plus any `extraText` the caller supplies
 * for that row, such as the name of the local round a flow was saved with —
 * contains every word of the query, case-insensitively and in any order.
 * A blank query returns the list unchanged (same array). Order is preserved.
 */
export function filterSavedSummaries<T extends SearchableSavedSummary>(
  summaries: readonly T[],
  query: string,
  extraText?: (summary: T) => string | undefined,
): T[] {
  const terms = savedSummaryQueryTerms(query);
  if (terms.length === 0) return summaries as T[];
  return summaries.filter((summary) => {
    const haystack = `${summary.label} ${extraText?.(summary) ?? ""}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

/** How the "Saved to account" lists are ordered. */
export type SavedSummarySort = "newest" | "oldest" | "name";

/** The sort options in the order the dialog offers them, with their labels. */
export const SAVED_SUMMARY_SORT_OPTIONS: ReadonlyArray<{ value: SavedSummarySort; label: string }> = [
  { value: "newest", label: "Newest saved first" },
  { value: "oldest", label: "Oldest saved first" },
  { value: "name", label: "Name (A–Z)" },
];

/** Narrows an untrusted value (e.g. a `<select>` value) to a known sort, falling back to `"newest"`. */
export function toSavedSummarySort(value: unknown): SavedSummarySort {
  return value === "oldest" || value === "name" ? value : "newest";
}

/** Milliseconds for an ISO `updatedAt`; an unparsable value sorts as the oldest. */
function savedAtMs(updatedAt: string | undefined): number {
  const ms = updatedAt ? Date.parse(updatedAt) : Number.NaN;
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

/**
 * Returns a sorted copy of the summaries (the input is never mutated).
 * `"newest"` / `"oldest"` order by `updatedAt`; `"name"` orders by label,
 * case-insensitively and with numbers in natural order ("Speech 2" before
 * "Speech 10"). Ties fall back to `clientId` so the order is stable across
 * renders.
 */
export function sortSavedSummaries<T extends SearchableSavedSummary & { updatedAt?: string }>(
  summaries: readonly T[],
  sort: SavedSummarySort,
): T[] {
  const byName = (a: T, b: T) => a.label.localeCompare(b.label, undefined, { sensitivity: "base", numeric: true });
  const byTime = (a: T, b: T) => savedAtMs(a.updatedAt) - savedAtMs(b.updatedAt);
  return [...summaries].sort((a, b) => {
    const primary = sort === "name" ? byName(a, b) : sort === "oldest" ? byTime(a, b) : byTime(b, a);
    return primary !== 0 ? primary : a.clientId - b.clientId;
  });
}

/**
 * The count shown beside a "Saved to account" heading: `"3"` for the whole
 * list, or `"2 of 5"` while a search narrows it.
 */
export function savedSummaryCountLabel(visible: number, total: number): string {
  return visible === total ? String(total) : `${visible} of ${total}`;
}

/** Which "Saved to account" list a load failure came from. */
export type SavedItemKind = "flow" | "round";

/**
 * The line shown under a saved flow or round whose **Load** failed.
 *
 * - `missing` — the client resolved to `null` (a `404`, or a `401` after the
 *   session lapsed): the item is no longer in the account as far as this
 *   browser can tell.
 * - an `Error` with a message — the server's own description (for example
 *   the `422` "This saved flow is damaged and can't be opened. You can remove
 *   it from your account."), or the client's fallback.
 * - anything else — a generic "try again" line.
 */
export function describeSavedLoadFailure(kind: SavedItemKind, failure: unknown): string {
  if (failure === "missing") {
    return `This ${kind} is no longer in your account. It may have been removed on another device, or your sign-in expired.`;
  }
  if (failure instanceof Error && failure.message.trim()) return failure.message.trim();
  return `Couldn't open this ${kind}. Try again.`;
}
