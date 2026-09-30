/**
 * @fileoverview Link rules shared by the app shell's navigation.
 *
 * Every page, dock destinations included, renders as an ordinary React route
 * in the one app document; nothing is loaded into an `<iframe>` any more. What
 * is left here is the handful of rules the shell still needs about links:
 * which clicks belong to the browser, and how the /docs site (which carries
 * its own stylesheet) is left with a real page load.
 *
 * The helpers are pure so `test/lib/layout/frame-navigation.test.ts` can
 * cover them directly.
 *
 * @module lib/layout/frame-navigation
 */

/**
 * Whether a click is asking for the link to open somewhere other than this
 * document — a modifier or any button but the primary one. Those belong to
 * the browser and are never intercepted.
 */
export function opensElsewhere(event: {
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  button: number
}): boolean {
  return (
    event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0
  )
}

/**
 * Whether `pathname` is the help docs site at /docs, which `AppShell` renders
 * with only the site sidebar around it.
 *
 * @param pathname - The current path, as `usePathname` reports it.
 */
export function isDocsPath(pathname: string | null | undefined): boolean {
  return pathname === "/docs" || !!pathname?.startsWith("/docs/")
}

export interface AnchorNavigation {
  /** The anchor's resolved `href`, as the DOM reports it (absolute). */
  href: string | null | undefined
  /** Its `target` attribute, if any. */
  target?: string | null
  /** Whether it carries a `download` attribute. */
  download?: boolean
}

/**
 * The URL a click on `anchor` in a /docs page has to load for real, or `null`
 * when the link is not one to intercept.
 *
 * The docs pages carry the app's sidebar beside Fumadocs' own (see
 * `DocsAppChrome`), and its links — the tool tree, the dock — are client-router
 * links. Followed as such from /docs they would land on an app page with the
 * docs' stylesheet still applied and none of the shell mounted, so anything
 * off /docs on this origin is handed to a full page load instead. Links within
 * /docs, other origins, new tabs and downloads are left alone.
 */
export function docsExitTarget(
  anchor: AnchorNavigation,
  origin: string,
): string | null {
  if (!anchor.href || anchor.download) return null
  if (anchor.target && anchor.target !== "_self") return null

  let url: URL
  try {
    url = new URL(anchor.href, origin)
  } catch {
    return null
  }
  if (url.origin !== origin) return null
  if (isDocsPath(url.pathname)) return null
  return url.href
}
