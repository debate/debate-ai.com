/**
 * @fileoverview The paths the app dock owns, and the predicate over them.
 *
 * Split from `dock-nav-items.ts` — which pairs each path with its icon asset —
 * so the routing logic can be imported (and unit-tested) without pulling in
 * `.svg`/`.png` imports that only a bundler can resolve.
 */

/**
 * The dock's destinations and their labels, in dock order — which is also the
 * Alt+<n> shortcut order. `dock-nav-items.ts` pairs each one with its icon;
 * the app frame names its `<iframe>` from the same labels, so a screen reader
 * announces "Videos" rather than a URL.
 */
export const DOCK_NAV_LABELS: Record<string, string> = {
  "/videos": "Videos",
  "/cards": "Shared",
  "/debate": "Debate",
  "/versus-ai": "Practice vs AI",
  "/doc": "Docs",
}

export const DOCK_NAV_HREFS = Object.keys(DOCK_NAV_LABELS)

/** The label for a dock destination, falling back to the path itself. */
export function dockNavLabel(path: string): string {
  return DOCK_NAV_LABELS[path] ?? path
}

/**
 * Whether `path` is one of the dock's own destinations, and so is opened in
 * the app frame rather than by a route change.
 *
 * Exact match, not a prefix: `/videos/some-lecture` is somewhere the framed
 * `/videos` document navigates itself, not a separate frame the dock opens.
 * A query string and a trailing slash are ignored so `/cards/` and
 * `/cards?q=x` still resolve to the frame already holding `/cards`.
 */
export function isDockNavPath(path: string): boolean {
  const withoutQuery = path.split("?")[0]?.split("#")[0] ?? ""
  const normalized = withoutQuery.replace(/\/+$/, "") || "/"
  return DOCK_NAV_HREFS.includes(normalized)
}

/**
 * Whether `path` belongs to a dock destination that is already framed — the
 * destination itself, or a page it navigates to on its own (`/videos/some-
 * lecture` under a framed `/videos`). Unlike {@link isDockNavPath}, this is a
 * prefix match, and it answers a different question: not "should the dock
 * open this as a new frame" but "does the frame currently showing this path
 * still own it, or has the page inside it wandered off to a tool the dock
 * never framed in the first place."
 *
 * `AppShell` uses this to decide whether a framed document that navigated
 * itself (a tool-tree link, not a dock click) should break out of the frame:
 * a page under a dock destination stays embedded, same as before; anything
 * else renders chrome-less inside the frame with no way back to the top
 * document's dock, address bar, or history, so it breaks out to a normal
 * top-level load instead.
 */
export function isDockOwnedPath(path: string): boolean {
  return dockNavRootFor(path) != null
}

/**
 * The dock destination `path` belongs to — itself, or the one it hangs under
 * (`/videos/lectures` → `/videos`) — or `null` for a path no dock icon owns.
 *
 * The finer-grained half of {@link isDockOwnedPath}, and what a framed
 * document compares against to tell its *own* pages apart from another
 * destination's: a framed `/videos` linking to `/videos/lectures` is
 * navigating within itself, but linking to `/cards/library` is not — that is
 * a different frame's subtree, and letting it load inside this one leaves the
 * page with no sidebar while the top document's URL still says `/videos`.
 */
export function dockNavRootFor(path: string): string | null {
  const withoutQuery = path.split("?")[0]?.split("#")[0] ?? ""
  const normalized = withoutQuery.replace(/\/+$/, "") || "/"
  return (
    DOCK_NAV_HREFS.find((href) => normalized === href || normalized.startsWith(`${href}/`)) ?? null
  )
}

/** Query marker on a frame's URL, so the framed document is identifiable. */
export const EMBED_PARAM = "embed"
export const EMBED_VALUE = "1"

/**
 * The URL the app frame loads for `path`.
 *
 * The marker is not how the framed document decides to drop its chrome — it
 * checks whether it is framed, which survives navigating within the frame.
 * It is here so a framed document is distinguishable in logs and in the
 * network panel, and so the frame's URL is never byte-identical to the top
 * document's.
 */
export function toFrameSrc(path: string): string {
  const url = new URL(path, "http://frame.invalid")
  url.searchParams.set(EMBED_PARAM, EMBED_VALUE)
  return `${url.pathname}${url.search}${url.hash}`
}
