/**
 * @fileoverview Where every page moved when the app's routes were regrouped
 * under their sidebar category — `/lectures`, `/research`, `/practice` and
 * `/coaching` — and the one function that maps an old path onto its new one.
 *
 * Three readers share this table so an old URL resolves the same way wherever
 * it turns up:
 *
 * - the Worker (`apps/debate-ai.com/worker/index.ts`), which answers a request
 *   for an old path with a permanent redirect, so bookmarks and shared links
 *   keep working;
 * - the starred-tools list (`debate-round`'s `favoriteTools`), stored in D1 as
 *   route paths, so a tool starred before the move stays starred;
 * - the recently-opened-tools list (`debate-webview`'s `recentTools`, and the
 *   editor overlay's copy), stored the same way in `localStorage` and D1.
 *
 * Lives in `debate-data-sync` because it is the lowest package all of those
 * already depend on, next to the tool-record catalog whose hrefs moved with it.
 *
 * @module routes/category-paths
 */

/**
 * Old path prefix → new path prefix, matched on whole path segments (so
 * `/rank` never catches `/rankings`) and longest-first (so `/cards/level`
 * wins over `/cards`).
 *
 * `/coaching` is deliberately absent: it used to be AI Coach Mode and is now
 * the Coach Workspace (the old `/coach`), so an old `/coaching` link simply
 * lands on the Coaching category's home page. AI Coach Mode itself moved to
 * `/coaching/ai-coach`.
 */
export const LEGACY_PATH_PREFIXES: ReadonlyArray<readonly [from: string, to: string]> = [
  // Research
  ["/cards/progress-tracking", "/coaching/progress"],
  ["/cards/leaderboard", "/coaching/leaderboard"],
  ["/cards/level", "/practice/level"],
  ["/cards", "/research/cards"],
  ["/topics", "/research/topics"],
  // Practice
  ["/practice-round", "/practice"],
  ["/practice-partners", "/practice/partners"],
  ["/rules", "/practice/rules"],
  ["/versus-ai", "/practice/versus-ai"],
  ["/drills", "/practice/drills"],
  ["/briefings", "/practice/briefings"],
  ["/strategy", "/practice/strategy"],
  ["/opponents", "/practice/opponents"],
  ["/forums", "/practice/forums"],
  ["/tournaments", "/practice/tournaments"],
  ["/judge-decision", "/practice/judge-decision"],
  ["/judges", "/practice/judges"],
  ["/prep-notes", "/practice/prep-notes"],
  ["/features", "/practice/features"],
  ["/videos/dictionary", "/practice/glossary"],
  ["/videos/rankings", "/practice/rankings"],
  ["/videos/statistics", "/practice/statistics"],
  ["/videos/stats", "/practice/statistics"],
  // Lectures
  ["/videos/lectures", "/lectures"],
  // Coaching
  ["/coaching-programs", "/coaching/programs"],
  ["/coach-materials", "/coaching/materials"],
  ["/coach", "/coaching"],
  ["/outcomes", "/coaching/outcomes"],
  ["/rank", "/coaching/rankings"],
]

/**
 * `/videos/<slug>` values that are round-archive views and stay under
 * `/videos`. Every other single-segment `/videos/<slug>` is a lecture category
 * (the video page treats an unknown slug as one), so it moves to
 * `/lectures/<slug>`. Mirrors the round-video keys of `debate-videos`'
 * `SLUG_MAP`; that package's tests hold the two together.
 */
export const ROUND_VIDEO_SLUGS: ReadonlySet<string> = new Set([
  "policy",
  "ld",
  "pf",
  "college",
  "toppicks",
  "favoritedebates",
  "favoritelectures",
  "favorites",
  "history",
  "watchhistory",
  "watch",
])

const SORTED_PREFIXES = [...LEGACY_PATH_PREFIXES].sort((a, b) => b[0].length - a[0].length)

function isAtOrUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/**
 * The current pathname for an old one, or `null` when `pathname` did not move.
 * Takes and returns a bare pathname — no query or hash.
 */
export function canonicalCategoryPathname(pathname: string): string | null {
  for (const [from, to] of SORTED_PREFIXES) {
    if (isAtOrUnder(pathname, from)) return to + pathname.slice(from.length)
  }
  const slug = /^\/videos\/([^/]+)\/?$/.exec(pathname)?.[1]
  if (slug && !ROUND_VIDEO_SLUGS.has(slug.toLowerCase())) return `/lectures/${slug}`
  return null
}

/**
 * {@link canonicalCategoryPathname} for a root-relative href that may carry a
 * query and hash, which ride along unchanged. Returns `href` itself when it
 * did not move, so stored lists can be mapped through it unconditionally.
 */
export function canonicalCategoryHref(href: string): string {
  const cut = href.search(/[?#]/)
  const pathname = cut === -1 ? href : href.slice(0, cut)
  const moved = canonicalCategoryPathname(pathname)
  return moved == null ? href : moved + (cut === -1 ? "" : href.slice(cut))
}
