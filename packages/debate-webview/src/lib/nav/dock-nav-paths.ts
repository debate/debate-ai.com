/**
 * @fileoverview The paths the app dock owns, and the predicate over them.
 *
 * Split from `dock-nav-items.ts` — which pairs each path with its icon asset —
 * so the routing logic can be imported (and unit-tested) without pulling in
 * `.svg`/`.png` imports that only a bundler can resolve.
 */

/**
 * The dock's destinations and their labels, in dock order — which is also the
 * Alt+<n> shortcut order. `dock-nav-items.ts` pairs each one with its icon
 * and uses the label as the icon's accessible name.
 */
export const DOCK_NAV_LABELS: Record<string, string> = {
  "/videos": "Videos",
  "/research/cards": "Shared",
  "/debate": "Debate",
  "/practice/versus-ai": "Practice vs AI",
  "/research/docs": "Research",
}

export const DOCK_NAV_HREFS = Object.keys(DOCK_NAV_LABELS)

/** The label for a dock destination, falling back to the path itself. */
export function dockNavLabel(path: string): string {
  return DOCK_NAV_LABELS[path] ?? path
}

/**
 * Whether `path` is one of the dock's own destinations.
 *
 * Exact match, not a prefix: `/videos/some-lecture` is a page under a
 * destination, not a destination. A query string and a trailing slash are
 * ignored, so `/research/cards/` and `/research/cards?q=x` are both `/research/cards`.
 */
export function isDockNavPath(path: string): boolean {
  const withoutQuery = path.split("?")[0]?.split("#")[0] ?? ""
  const normalized = withoutQuery.replace(/\/+$/, "") || "/"
  return DOCK_NAV_HREFS.includes(normalized)
}
