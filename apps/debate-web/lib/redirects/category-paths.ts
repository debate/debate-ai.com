/**
 * @fileoverview The redirect from a page's old URL to the one it has under its
 * sidebar category (`/lectures`, `/research`, `/practice`, `/coaching`).
 *
 * One call near the top of the Worker's `fetch`, after the canonical-host hop:
 *
 *     const moved = handleCategoryPathRedirect(request);
 *     if (moved) return moved;
 *
 * The table itself lives in `debate-data-sync` (`routes/category-paths.ts`),
 * shared with the starred and recent tool lists that store these paths.
 */

import { canonicalCategoryPathname } from "@debate/data-sync/src/routes/category-paths";

/** Permanent, and method-preserving — see `canonical-host.ts`. */
const REDIRECT_STATUS = 308;

/**
 * Builds the redirect for a request to a page's old path, carrying the query
 * string over, or returns `null` for every path that did not move.
 */
export function handleCategoryPathRedirect(request: Request): Response | null {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }

  const pathname = canonicalCategoryPathname(url.pathname);
  if (pathname == null) return null;

  const target = new URL(url.toString());
  target.pathname = pathname;

  return new Response(null, {
    status: REDIRECT_STATUS,
    headers: {
      location: target.toString(),
      "cache-control": "public, max-age=3600",
    },
  });
}
