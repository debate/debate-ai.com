/**
 * @fileoverview The pure half of the app's page transition: deciding whether a
 * click is about to send the client router to a different page, and the
 * timings the transition runs on.
 *
 * The transition never waits for anything. The new page renders the moment
 * the router has it, and only then fades in over {@link PAGE_FADE_MS}; the
 * orbital loader appears only when the router has made the reader wait longer
 * than {@link SLOW_NAVIGATION_MS}. See `components/layout/PageTransition.tsx`.
 *
 * @module lib/nav/page-transition
 */

/** How long the new page takes to fade in once it has rendered. */
export const PAGE_FADE_MS = 160

/** Opacity the old page dims to while the next one is on its way. */
export const PENDING_OPACITY = 0.6

/** How long a navigation may take before the orbital loader is shown. */
export const SLOW_NAVIGATION_MS = 1000

/** Give up on a navigation that never arrives (a handler cancelled it). */
export const NAVIGATION_GIVE_UP_MS = 15000

/** The parts of a click the check looks at, so it works without a DOM. */
export interface NavigationClick {
  button: number
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  target: EventTarget | null
}

/** Minimal anchor shape. */
interface AnchorLike {
  href?: string | { baseVal?: string }
  target?: string | { baseVal?: string }
  hasAttribute?: (name: string) => boolean
  getAttribute?: (name: string) => string | null
}

/** Minimal location shape. */
export interface LocationLike {
  origin: string
  pathname: string
  search: string
}

function closestAnchor(target: EventTarget | null): AnchorLike | null {
  const el = target as { closest?: (selector: string) => unknown } | null
  if (!el || typeof el.closest !== "function") return null
  return (el.closest("a[href]") as AnchorLike | null) ?? null
}

function stringOf(value: AnchorLike["href"]): string {
  if (typeof value === "string") return value
  return value?.baseVal ?? ""
}

/**
 * The `pathname + search` a click will take the client router to, or `null`
 * when it won't change the page: a modified or non-primary click (new tab),
 * a link that opens elsewhere or downloads, another origin, or the same page
 * (including a `#hash` jump on it).
 */
export function navigationTargetOf(event: NavigationClick, location: LocationLike): string | null {
  if (event.button !== 0) return null
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null

  const anchor = closestAnchor(event.target)
  if (!anchor) return null
  if (anchor.hasAttribute?.("download")) return null
  if (anchor.hasAttribute?.("data-no-page-transition")) return null
  const target = stringOf(anchor.target)
  if (target && target !== "_self") return null

  const raw = anchor.getAttribute?.("href") ?? stringOf(anchor.href)
  if (!raw || raw.startsWith("#")) return null

  let url: URL
  try {
    url = new URL(stringOf(anchor.href) || raw, `${location.origin}${location.pathname}${location.search}`)
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  if (url.origin !== location.origin) return null

  const next = `${url.pathname}${url.search}`
  if (next === `${location.pathname}${location.search}`) return null
  return next
}
