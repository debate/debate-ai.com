/**
 * @fileoverview The app frame's keep-alive pool.
 *
 * `AppFrameSurface` renders one `<iframe>` per entry, keyed by path, and hides
 * all but the active one — so each dock destination is loaded once, when first
 * needed, and then shown or hidden instantly, with its scroll position and
 * in-flight state intact. Nothing is ever evicted: the pool only holds dock destinations, so
 * it is bounded by the dock itself.
 *
 * Split out of the component so the ordering invariant below can be tested;
 * getting it wrong is invisible in review and shows up only as pages that
 * reload when they should not.
 */

/**
 * Adds `href` to the pool if it isn't already there.
 *
 * Insertion order is never rearranged, and that is the point rather than an
 * accident: the pool is rendered as a keyed list, so reordering it would move
 * the iframe elements in the DOM — and moving an iframe reloads its document,
 * which is exactly the cost keeping them alive is meant to avoid. An LRU that
 * promoted the path just used would reload a page on every visit.
 */
export function keepAlive(paths: string[], href: string): string[] {
  return paths.includes(href) ? paths : [...paths, href]
}

