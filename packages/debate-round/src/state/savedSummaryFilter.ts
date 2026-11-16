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
