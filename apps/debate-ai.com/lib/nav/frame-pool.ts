/**
 * @fileoverview The app frame's keep-alive pool.
 *
 * `AppFrameSurface` renders one `<iframe>` per entry, keyed by path, and hides
 * all but the active one — so a destination the dock has already opened comes
 * back instantly, with its scroll position and in-flight state intact.
 *
 * Split out of the component so the ordering invariant below can be tested;
 * getting it wrong is invisible in review and shows up only as pages that
 * reload when they should not.
 */

/**
 * How many destination documents stay alive at once. Five is the whole dock,
 * so in practice nothing is ever evicted; the cap exists so a session that
 * somehow frames more paths can't grow without bound.
 */
export const MAX_KEPT_FRAMES = 5

/**
 * Adds `href` to the pool, evicting the oldest entry once it is over
 * {@link MAX_KEPT_FRAMES}.
 *
 * Insertion order is never rearranged, and that is the point rather than an
 * accident: the pool is rendered as a keyed list, so reordering it would move
 * the iframe elements in the DOM — and moving an iframe reloads its document,
 * which is exactly the cost keeping them alive is meant to avoid. An LRU that
 * promoted the path just used would reload a page on every visit.
 *
 * `keep` — the frame currently on screen — is never the one evicted.
 */
export function keepAlive(paths: string[], href: string, keep: string | null): string[] {
  if (paths.includes(href)) return paths

  const next = [...paths, href]
  while (next.length > MAX_KEPT_FRAMES) {
    const evictable = next.findIndex((path) => path !== keep && path !== href)
    if (evictable === -1) break
    next.splice(evictable, 1)
  }
  return next
}
