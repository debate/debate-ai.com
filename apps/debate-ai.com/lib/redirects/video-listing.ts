/**
 * @fileoverview Season and tournament addresses in the video library.
 *
 * A video lives at `/videos/<season>/<tournament>/<round>/<teams>`, so people
 * trim that address to see more of it: `/videos/2025` for the season, and
 * `/videos/2025/ndt` for one tournament in it. Neither has a page of its own —
 * a two-segment path matches no route, and a bare season would be read as a
 * lecture category with no videos in it — so both are sent to the library
 * filtered to them (`/videos?year=2025&q=ndt`), which `LecturesPage` reads
 * from the query string on load.
 *
 * Runs in the Worker after the category-path redirect:
 *
 *     const listing = handleVideoListingRedirect(request);
 *     if (listing) return listing;
 */

/** Temporary: either address may get a page of its own later. */
const REDIRECT_STATUS = 302;

/** A season segment: a year, or `archive` for videos with no usable date. */
const SEASON = /^(\d{4}|archive)$/;

/**
 * The filtered library address for `/videos/<season>` or
 * `/videos/<season>/<tournament>`, or `null` for any other path.
 */
export function videoListingPath(pathname: string, search = ""): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "videos" || segments.length < 2 || segments.length > 3) return null;

  const [, season, tournament] = segments;
  if (!SEASON.test(season)) return null;

  const query = new URLSearchParams(search);
  // `archive` is the path's name for the season filter's `legacy`.
  query.set("year", season === "archive" ? "legacy" : season);
  if (tournament) {
    let words: string;
    try {
      words = decodeURIComponent(tournament);
    } catch {
      words = tournament;
    }
    words = words.replace(/[-_]+/g, " ").trim();
    if (words) query.set("q", words);
  }
  return `/videos?${query.toString()}`;
}

/** The redirect for a season or tournament address, or `null` for every other request. */
export function handleVideoListingRedirect(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }

  const path = videoListingPath(url.pathname, url.search);
  if (path == null) return null;

  return new Response(null, {
    status: REDIRECT_STATUS,
    headers: { location: new URL(path, url).toString() },
  });
}
