/**
 * @fileoverview Deep link to one saved Practice vs AI round: `?debate=<id>`
 * opens Debate History with that round expanded. Settings → Saved data builds
 * the same href server-side (`listOwnSavedItems`).
 *
 * @module ui/history-link
 */

/** `/practice/versus-ai?debate=<id>` for a saved round (ids are the SQL row id as a string). */
export function buildDebateHistoryHref(id: string | number): string {
  return `/practice/versus-ai?debate=${encodeURIComponent(String(id))}`
}

/** The linked round id from a query string, or null when absent or not a plain id. */
export function parseDebateHistoryParam(search: string): string | null {
  const value = new URLSearchParams(search).get("debate")
  return value && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null
}
