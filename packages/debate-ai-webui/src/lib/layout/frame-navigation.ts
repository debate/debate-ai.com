/**
 * @fileoverview How a framed document hands a navigation back to the shell.
 *
 * The shell runs each dock destination in a same-origin `<iframe>` and keeps
 * the dock and the tool sidebar in the top document
 * (`components/layout/AppFrameProvider.tsx`). The sidebar rendered *inside*
 * a framed page — `/videos`' own column — links to tools the dock never
 * frames (`/coach`, `/drills`, `/judges`, …). Left alone, clicking one
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
 * Paths that are not routes of this Next app and so cannot be handed to the
 * client router. `/docs` is the help site: a static export staged in
 * `public/docs` and served by the Worker's asset binding, which only a real
 * browser navigation reaches.
 */
const NON_ROUTER_PREFIXES = ["/docs", "/api"]

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
 * is already showing — `/videos/lectures` clicked inside a framed `/videos`
 * is the frame navigating within itself, which is what the frame is for.
 * Another destination's subtree is not: `/cards/library` loaded inside the
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
