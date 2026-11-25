/**
 * @fileoverview The rankings page's address: `/rank/<format>?season=…&by=…`.
 *
 * The format (`VPF`, `VLD`, `VCX`, `NDT` or `PARLI`) is a path segment, and
 * only the season and the Teams/Schools toggle ride in the query. The page
 * used to live at `/coaching/rankings?format=VCX` (and an older copy at
 * `/practice/rankings`); the Worker 308s those to this form
 * (`apps/debate-web/lib/redirects/rankings.ts`), and the panel still reads a
 * stray `?format=` so a link that skipped the Worker lands on the right tab.
 *
 * React-free so the Worker can import it.
 * @module leaderboard/rankingsUrl
 */

/** The rankings page's base path. */
export const RANKINGS_PATH = "/rank"

/** Old addresses of the rankings page, each redirected to {@link RANKINGS_PATH}. */
export const LEGACY_RANKINGS_PATHS: readonly string[] = [
  "/coaching/rankings",
  "/practice/rankings",
  "/videos/rankings",
]

/**
 * The format a rankings pathname names — `/rank/vcx` → `"VCX"` — upper-cased,
 * or `null` for `/rank` itself and for any other path.
 */
export function rankingsFormatFromPath(pathname: string | null | undefined): string | null {
  const match = /^\/rank\/([^/?#]+)\/?$/i.exec(pathname ?? "")
  if (!match) return null
  try {
    return decodeURIComponent(match[1]).toUpperCase()
  } catch {
    return null
  }
}

/**
 * The rankings address for `format`, carrying `params` (minus any `format`
 * key, which the path now holds) as the query: `/rank/VCX?season=all-time`.
 */
export function rankingsHref(format?: string | null, params?: URLSearchParams | string): string {
  const query = new URLSearchParams(params)
  query.delete("format")
  const segment = format ? `/${encodeURIComponent(format.toUpperCase())}` : ""
  const search = query.toString()
  return `${RANKINGS_PATH}${segment}${search ? `?${search}` : ""}`
}

/**
 * The canonical address for a request to an old rankings path, or to `/rank`
 * with a `?format=` query: `/coaching/rankings?format=VCX&season=all-time` →
 * `/rank/VCX?season=all-time`. `null` when `pathname` + `search` is already
 * canonical or is not a rankings address at all.
 */
export function canonicalRankingsHref(pathname: string, search: string): string | null {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  const params = new URLSearchParams(search)
  const queryFormat = params.get("format")?.trim() || null
  if (LEGACY_RANKINGS_PATHS.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
    return rankingsHref(queryFormat, params)
  }
  if (trimmed.toLowerCase() === RANKINGS_PATH && queryFormat) return rankingsHref(queryFormat, params)
  const pathFormat = rankingsFormatFromPath(trimmed)
  if (pathFormat) {
    // `/rank/VCX?format=NDT`: the path wins; drop the stray query key.
    // `/rank/vcx`: upper-case the segment so every link shares one address.
    const segment = trimmed.slice(RANKINGS_PATH.length + 1)
    if (params.has("format") || segment !== pathFormat) return rankingsHref(pathFormat, params)
  }
  return null
}
