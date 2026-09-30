/**
 * @fileoverview How a framed document hands a navigation back to the shell.
 *
 * The shell runs each dock destination in a same-origin `<iframe>` and keeps
 * the dock and the tool sidebar in the top document
 * (`components/layout/AppFrameProvider.tsx`). The sidebar rendered *inside*
 * a framed page — `/videos`' own column — links to tools the dock never
 * frames (`/coaching`, `/practice/drills`, `/practice/judges`, …). Left alone, clicking one
 * navigates the frame: the tool renders inside it with no sidebar and no
 * dock, and `AppShell` then throws the whole tab at a fresh top-level load
 * to recover. Both halves of that are visible — the nav vanishes, then
 * everything reloads.
 *
 * So the framed document doesn't navigate at all: it asks the top document to
 * route there, over `postMessage`, and the top document does it with the
 * client router. The sidebar never unmounts, because the shell document never
 * goes away.
 *
 * The helpers here are pure so `__tests__/frame-navigation.test.ts` can cover
 * the link rules directly — which anchors are handed up, and which are left
 * to the browser.
 *
 * @module lib/layout/frame-navigation
 */

/** A framed document asking the shell to route somewhere. */
export const FRAME_NAV_REQUEST = "debate-frame-navigate"

/** The shell telling the frame it has taken the navigation. */
export const FRAME_NAV_ACK = "debate-frame-navigate-ack"

export interface FrameNavRequest {
  type: typeof FRAME_NAV_REQUEST
  /** Root-relative path, including any query and hash. */
  path: string
}

export interface FrameNavAck {
  type: typeof FRAME_NAV_ACK
  path: string
}

export function isFrameNavRequest(data: unknown): data is FrameNavRequest {
  const message = data as FrameNavRequest | null
  return (
    message != null &&
    typeof message === "object" &&
    message.type === FRAME_NAV_REQUEST &&
    typeof message.path === "string"
  )
}

export function isFrameNavAck(data: unknown): data is FrameNavAck {
  const message = data as FrameNavAck | null
  return (
    message != null &&
    typeof message === "object" &&
    message.type === FRAME_NAV_ACK &&
    typeof message.path === "string"
  )
}

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
 * Paths never handed to the client router. `/api` is not a page at all.
 * `/docs` is the help site (`debate-help-docs`, mounted at `app/docs`): a
 * route of this app, but one `AppShell` renders with only the site sidebar and
 * that loads its own Fumadocs stylesheet, so moving between it and the rest of
 * the app is always a real page load — never the docs' CSS left applied to an
 * app page, or the shell half-torn-down around a docs page.
 */
const NON_ROUTER_PREFIXES = ["/docs", "/api"]

/**
 * Whether `pathname` is the help docs site at /docs, which `AppShell` renders
 * with only the site sidebar around it.
 *
 * @param pathname - The current path, as `usePathname` reports it.
 */
export function isDocsPath(pathname: string | null | undefined): boolean {
  return pathname === "/docs" || !!pathname?.startsWith("/docs/")
}

function isRouterPath(pathname: string): boolean {
  return !NON_ROUTER_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
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
 * The path a framed document should hand to the shell for `anchor`, or `null`
 * when the link is not one to intercept.
 *
 * Left to the browser: anything opening in another tab or downloading,
 * anything off this origin, and anything the client router cannot serve.
 *
 * Left to the frame: a path under the *same* dock destination this document
 * is already showing — `/videos/pf` clicked inside a framed `/videos`
 * is the frame navigating within itself, which is what the frame is for.
 * Another destination's subtree is not: `/research/cards/library` loaded inside the
 * `/videos` frame renders with no sidebar while the top document's URL still
 * says `/videos`, so it goes up like any tool link.
 *
 * @param currentPath - Where this framed document currently is, which decides
 *   which subtree is "its own".
 * @param dockRootFor - `dockNavRootFor`, injected so this module stays pure.
 */
export function topNavigationTarget(
  anchor: AnchorNavigation,
  origin: string,
  currentPath: string,
  dockRootFor: (path: string) => string | null,
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
  if (!isRouterPath(url.pathname)) return null

  const path = `${url.pathname}${url.search}${url.hash}`
  const root = dockRootFor(path)
  if (root != null && root === dockRootFor(currentPath)) return null
  return path
}

/**
 * A framed document telling the shell where it now is.
 *
 * A dock destination navigates *within* its own frame — `/videos` to
 * `/lectures`, `/doc` to `/doc/<name>`, `/research/cards` to `/research/cards/library`,
 * a `?view=` or `?chat=` written by `history.replaceState`. None of that
 * touches the top document, so without this the address bar stayed on the
 * bare dock path: the page changed on screen but the URL didn't, and a
 * reload, bookmark or shared link lost the page. The frame reports every
 * location change and the shell mirrors it into its own URL.
 */
export const FRAME_LOCATION = "debate-frame-location"

export interface FrameLocation {
  type: typeof FRAME_LOCATION
  /** Root-relative path, including any query and hash, `embed` marker removed. */
  path: string
}

export function isFrameLocation(data: unknown): data is FrameLocation {
  const message = data as FrameLocation | null
  return (
    message != null &&
    typeof message === "object" &&
    message.type === FRAME_LOCATION &&
    typeof message.path === "string"
  )
}

/**
 * The address the shell should show for a framed document at `url`: its path,
 * query and hash, minus the frame's own `?embed=1` marker (see `toFrameSrc`),
 * which means nothing outside the frame.
 *
 * @param url - The framed document's location (absolute or root-relative).
 * @param embedParam - The marker's query key, injected so this stays pure.
 */
export function shellPathForFrameLocation(url: string, embedParam: string): string {
  const parsed = new URL(url, "http://frame.invalid")
  parsed.searchParams.delete(embedParam)
  const query = parsed.searchParams.toString()
  return `${parsed.pathname}${query ? `?${query}` : ""}${parsed.hash}`
}

/**
 * Whether a location a frame reported is one the shell should put in its
 * address bar: root-relative on this origin, and under the same dock
 * destination as the frame showing it. A frame that has wandered to another
 * destination's page — or anywhere the dock doesn't own — is handed up with
 * {@link FRAME_NAV_REQUEST} instead, never mirrored.
 *
 * @param path - The reported location.
 * @param framedRoot - The dock destination the reporting frame belongs to.
 * @param dockRootFor - `dockNavRootFor`, injected so this module stays pure.
 */
export function isMirrorableFrameLocation(
  path: string,
  framedRoot: string,
  dockRootFor: (path: string) => string | null,
): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false
  if (!isRouterPath(path.split(/[?#]/)[0] ?? "")) return false
  return dockRootFor(path) === framedRoot
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
