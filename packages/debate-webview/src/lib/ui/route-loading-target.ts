/**
 * @fileoverview Which clicked links start a page transition worth covering
 * with the global loading overlay.
 *
 * Pure so `test/lib/ui/route-loading-target.test.ts` can cover the rules
 * directly. The router hook (`use-route-loading`) arms the overlay for any
 * link this returns a path for, and the new route's `pathname` drops it.
 *
 * @module lib/ui/route-loading-target
 */

import type { AnchorNavigation } from "../layout/frame-navigation"

/**
 * Paths a link can point at without the page ever leaving: `/api` answers
 * downloads and JSON, so a click there may never unload the document nor
 * change `pathname`, and an overlay armed for it would only clear on the
 * safety timeout.
 */
const NON_PAGE_PREFIXES = ["/api"]

/** `/research/cards/` and `/research/cards` are the same page. */
function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/"
}

/** Whether two pathnames name the same page, ignoring a trailing slash. */
export function isSamePage(a: string, b: string): boolean {
  return normalizePath(a) === normalizePath(b)
}

/**
 * The pathname `anchor` navigates this document to, or `null` when clicking
 * it does not start a page transition here.
 *
 * Left alone: anything opening in another tab or downloading, anything off
 * this origin, `/api`, and a link to the page already showing — a hash jump
 * or a query-only change (a filter, a tab) is not a transition, and
 * `pathname` would never change to clear the overlay.
 *
 * @param currentUrl - The document's full URL. Relative hrefs (`#x`, `?q=1`,
 *   `lectures`) resolve against it, as the browser resolves them.
 */
export function routeLoadingTarget(anchor: AnchorNavigation, currentUrl: string): string | null {
  if (!anchor.href || anchor.download) return null
  if (anchor.target && anchor.target !== "_self") return null

  let current: URL
  let url: URL
  try {
    current = new URL(currentUrl)
    url = new URL(anchor.href, current)
  } catch {
    return null
  }
  const { origin } = current
  // `mailto:` and `javascript:` URLs have an opaque `"null"` origin, so this
  // turns them away too.
  if (url.origin !== origin) return null
  if (NON_PAGE_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) {
    return null
  }
  if (isSamePage(url.pathname, current.pathname)) return null
  return url.pathname
}
