/**
 * @fileoverview A plain 404 for build output that is not in this deploy.
 *
 * Every file under `/_next/static/` and `/assets/` is content-hashed and is
 * served by the Workers static-assets layer before this Worker ever runs. A
 * request for one that reaches the Worker therefore names a file this deploy
 * does not have — almost always a chunk from the build before (a tab opened
 * before the deploy) or after (an edge that has the new HTML a moment before
 * the new assets).
 *
 * Left to the app, that request rendered the HTML not-found page. Safari then
 * reported `'text/html' is not a valid JavaScript MIME type` for the module
 * script, and an HTML 404 could be cached by a proxy under a script URL. This
 * answers with a short `text/plain` 404 that is never cached, and the page's
 * chunk-reload script (lib/chunk-reload/script.ts) recovers by reloading.
 *
 *     const missing = missingBuildFileResponse(request);
 *     if (missing) return missing;
 */

/** Paths that only ever hold hashed build output served by the assets layer. */
const BUILD_OUTPUT_PREFIXES = ["/_next/static/", "/assets/"];

/** True when `pathname` is under a build-output folder. */
export function isBuildOutputPath(pathname: string): boolean {
  return BUILD_OUTPUT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * A `text/plain` 404 for a GET or HEAD of a build file that reached the
 * Worker, or `null` for every other request.
 */
export function missingBuildFileResponse(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }
  if (!isBuildOutputPath(url.pathname)) return null;
  return new Response(request.method === "HEAD" ? null : "Not found: this file is not part of the current deploy.\n", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
