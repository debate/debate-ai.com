/**
 * @fileoverview The redirect onto the rankings page's short address,
 * `/rank/<format>?season=…`.
 *
 * `/coaching/rankings?format=VCX&season=all-time` (and the older
 * `/practice/rankings` and `/videos/rankings` copies) 308 to
 * `/rank/VCX?season=all-time`: the format moves out of the query into the
 * path, every other query key rides along. `/rank?format=VCX` and a
 * lower-case `/rank/vcx` are folded into the same form. The address itself is
 * built by `rankingsUrl` in `@debate-ai/rankings`, which the page shares.
 *
 * Runs in the Worker ahead of {@link handleCategoryPathRedirect}, whose table
 * also maps those paths to `/rank` (for stored tool lists) but would leave
 * `?format=` in the query.
 */

import { canonicalRankingsHref } from "@debate-ai/rankings/src/leaderboard/rankingsUrl";

/** Permanent, and method-preserving — see `canonical-host.ts`. */
const REDIRECT_STATUS = 308;

/**
 * Builds the redirect for a request to an old or non-canonical rankings
 * address, or returns `null` for every other request.
 */
export function handleRankingsRedirect(request: Request): Response | null {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }

  const href = canonicalRankingsHref(url.pathname, url.search);
  if (href == null) return null;

  const target = new URL(href, url);
  target.hash = url.hash;

  return new Response(null, {
    status: REDIRECT_STATUS,
    headers: {
      location: target.toString(),
      "cache-control": "public, max-age=3600",
    },
  });
}
