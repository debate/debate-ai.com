/**
 * Sends the offline build's same-origin `/api/*` requests to the live site.
 *
 * The app is written for debate-ai.com, where `fetch("/api/...")` and
 * better-auth's client (based at `location.origin`) reach the Worker on the
 * same origin. Here that origin is the wrapper's bundled `tauri://localhost`,
 * with nothing behind it. Installed on import, from main.tsx's first import,
 * so it is in place before the app's own modules evaluate.
 */

/** The site behind the offline build: where `/api` and sign-in go. */
export const SITE = "https://debate-ai.com"

export function installApiProxy(): void {
  const nativeFetch = window.fetch.bind(window)
  const pageOrigin = window.location.origin
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const url = new URL(request.url, pageOrigin)
    if (url.origin !== pageOrigin || !url.pathname.startsWith("/api/")) return nativeFetch(request)
    return nativeFetch(new Request(`${SITE}${url.pathname}${url.search}`, request), { credentials: "omit" })
  }
}

installApiProxy()
