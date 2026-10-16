/**
 * @fileoverview Sends a page that does not exist to the page above it.
 *
 * A mistyped or stale address — `/tournaments/2026/nope/extra`, a deleted
 * video, a renamed section — used to end on a bare 404. Instead a browser
 * navigation that the app answers with 404 is redirected one segment up
 * (`/tournaments/2026/nope`); if that is missing too it is redirected again,
 * so the viewer lands on the nearest page that exists, at worst `/`.
 *
 * Only document navigations are redirected: `/api` calls, assets, RSC payload
 * fetches and other machine requests keep their honest 404. Client-side
 * navigations that reach a missing page are handled by `app/not-found.tsx`,
 * which uses the same {@link notFoundFallbackPath}.
 *
 * Wraps the app handler's response in the Worker:
 *
 *     return redirectNotFound(request, response) ?? response;
 */

/** Temporary: the page may exist by the next visit. */
const REDIRECT_STATUS = 302;

/** Paths whose 404 is an answer, not a page: the API and build/static output. */
const PASSTHROUGH_PREFIXES = ["/api/", "/_next/", "/_vinext/", "/assets/"];

/**
 * The page above `pathname`: its last segment dropped, `/` for a top-level
 * page. `null` for `/` itself, which has nowhere to go.
 */
export function notFoundFallbackPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  segments.pop();
  return `/${segments.join("/")}`;
}

/** True when `request` is a browser loading a page, as opposed to fetching data or an asset. */
function isDocumentNavigation(request: Request, url: URL): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (url.pathname === "/api" || PASSTHROUGH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return false;
  // A file name (`/logo.png`, `/feed.xml`) is an asset, not a page.
  if (/\.[a-z0-9]+$/i.test(url.pathname)) return false;
  // RSC payload fetches during client navigation.
  if (request.headers.has("rsc") || url.searchParams.has("_rsc")) return false;
  const dest = request.headers.get("sec-fetch-dest");
  if (dest) return dest === "document";
  return (request.headers.get("accept") ?? "").includes("text/html");
}

/**
 * A redirect to the page above when the app answered a page navigation with
 * 404, or `null` to send `response` as it is.
 */
export function redirectNotFound(request: Request, response: Response): Response | null {
  if (response.status !== 404) return null;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }
  if (!isDocumentNavigation(request, url)) return null;

  const path = notFoundFallbackPath(url.pathname);
  if (path == null) return null;

  return new Response(null, {
    status: REDIRECT_STATUS,
    headers: { location: new URL(path, url).toString(), "cache-control": "no-store" },
  });
}
