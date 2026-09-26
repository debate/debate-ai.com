/**
 * @fileoverview The location a non-Next host routes by: the URL fragment.
 *
 * An extension page is one file (`options.html`). Reloading
 * `chrome-extension://<id>/videos` would ask the browser for a file that does
 * not exist, so the app's path lives after the `#` instead —
 * `options.html#/videos?event=ndt` — which survives a reload, a bookmark and
 * the back button without any server.
 *
 * Everything here speaks in app paths (`/videos?event=ndt`); only this module
 * knows about the `#`.
 */

type Listener = () => void

const listeners = new Set<Listener>()
const CHANGE_EVENT = "debate-webview:navigate"

function notify() {
  for (const listener of listeners) listener()
}

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", notify)
  window.addEventListener("popstate", notify)
  window.addEventListener(CHANGE_EVENT, notify)
}

/** The app path the fragment names, `/` when it names none. */
export function currentHref(): string {
  if (typeof window === "undefined") return "/"
  const hash = window.location.hash.replace(/^#/, "")
  return hash.startsWith("/") ? hash : "/"
}

/** Splits an app path into its pathname and query string. */
export function splitHref(href: string): { pathname: string; search: string } {
  const withoutHash = href.split("#")[0]
  const q = withoutHash.indexOf("?")
  const pathname = q === -1 ? withoutHash : withoutHash.slice(0, q)
  return { pathname: pathname || "/", search: q === -1 ? "" : withoutHash.slice(q + 1) }
}

/** Resolves `href` against the current app path, the way a browser would. */
export function resolveHref(href: string): string {
  if (href.startsWith("/")) return href
  if (href.startsWith("?")) return splitHref(currentHref()).pathname + href
  const base = new URL(currentHref(), "http://app.invalid")
  const url = new URL(href, base)
  return url.pathname + url.search
}

/** True for a link that leaves the app (another origin, `mailto:`, …). */
export function isExternalHref(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")
}

/** The `href` attribute an in-app link renders with. */
export function toFragmentHref(href: string): string {
  return isExternalHref(href) ? href : `#${resolveHref(href)}`
}

export function navigate(href: string, { replace = false }: { replace?: boolean } = {}): void {
  if (typeof window === "undefined") return
  const target = `#${resolveHref(href)}`
  if (replace) window.history.replaceState(window.history.state, "", target)
  else window.history.pushState(null, "", target)
  window.dispatchEvent(new Event(CHANGE_EVENT))
  window.scrollTo?.(0, 0)
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
