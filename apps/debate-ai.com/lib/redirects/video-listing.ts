/**
 * @fileoverview Season and tournament addresses in the video library.
 *
 * A video lives at `/videos/<season>/<tournament>/<round>/<teams>`, so people
 * trim that address to see more of it: `/videos/24-25` for the season, and
 * `/videos/24-25/ndt` for one tournament in it (or the same with the bare
 * `2025` older addresses used). Neither has a page of its own —
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

/**
 * A season segment: `24-25`, the bare end year `2025` older addresses used,
 * or `archive` for videos with no usable date.
 */
const SEASON = /^(\d{2}-\d{2}|\d{4}|archive)$/;

/** The season filter's value — the year a season ends — for a season segment. */
function seasonFilter(season: string): string | null {
  if (season === "archive") return "legacy";
  if (/^\d{4}$/.test(season)) return season;
  const [start, end] = season.split("-").map(Number);
  if ((start + 1) % 100 !== end) return null;
  // Two digits name a year from 1970 to 2069, as `parseSeasonSegment` reads them.
  return String(end + (end >= 70 ? 1900 : 2000));
}

/**
 * The filtered library address for `/videos/<season>` or
 * `/videos/<season>/<tournament>`, or `null` for any other path.
 */
export function videoListingPath(pathname: string, search = ""): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "videos" || segments.length < 2 || segments.length > 3) return null;

  const [, season, tournament] = segments;
  if (!SEASON.test(season)) return null;
  const year = seasonFilter(season);
  if (year === null) return null;

  const query = new URLSearchParams(search);
  // `archive` is the path's name for the season filter's `legacy`.
  query.set("year", year);
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
