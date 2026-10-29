/**
 * @fileoverview Points the embedded qwksearch UI's API clients at
 * qwksearch.com before any of them are evaluated.
 *
 * `qwksearch-api-client` (bundled inside `research-agent-ui`) captures its
 * base URL ONCE at module-evaluation time: `window.NEXT_PUBLIC_BASE_URL`
 * falling back to `window.location.origin` — which on debate-ai.com would
 * resolve every chat/search call against our own (nonexistent) API routes.
 *
 * A `<head>` script can only cover full page loads; when the user reaches
 * /doc via client-side navigation the route's chunk (and with it the
 * api-client module) is evaluated long after any head script ran. Importing
 * this module FIRST in every qwksearch-UI entry file guarantees the global
 * is set before the api-client module evaluates, in both load paths — ES
 * module evaluation order runs this file to completion before
 * `research-agent-ui` (and its bundled api-client) is touched.
 *
 * The global is only read at that one capture point, so leaving it set for
 * the rest of the session is harmless to every other debate-ai page.
 */

export const QWKSEARCH_ORIGIN = "https://qwksearch.com"

/** `qwksearch-api-client` appends `/api` itself; grab-url wants it spelled out. */
export const QWKSEARCH_API_BASE = `${QWKSEARCH_ORIGIN}/api/`

declare global {
  interface Window {
    NEXT_PUBLIC_BASE_URL?: string
  }
}

if (typeof window !== "undefined") {
  window.NEXT_PUBLIC_BASE_URL = QWKSEARCH_ORIGIN
}
