/**
 * @fileoverview Season and tournament addresses in the video library.
 *
 * A video lives at `/videos/<season>/<format>/<tournament>/<round>/<teams>`,
 * so people trim that address to see more of it: `/videos/24-25` for the
 * season, `/videos/24-25/ld` for one format in it, and `/videos/24-25/ndt`
 * for one tournament (or the same with the bare `2025` older addresses used).
 * None has a page of its own — a two-segment path matches no route, and a
 * bare season would be read as a lecture category with no videos in it — so
 * each is sent to the library filtered to them (`/videos?year=2025&style=3`,
 * `/videos?year=2025&q=ndt`), which `LecturesPage` reads from the query
 * string on load.
 *
 * `/videos/24-25/ld/<tournament>` has the shape of a video's address, so the
 * Worker leaves it to the router, and the watch route sends it here only
 * when it names no video (`allowFormatTournament`).
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

/**
 * The style filter's value for each format segment, as `FORMAT_SEGMENTS` in
 * `@debate-ai/videos` spells them (kept apart so the Worker needn't load it).
 */
const FORMAT_STYLES: Record<string, string> = {
  vcx: "1",
  pf: "2",
  ld: "3",
  cpd: "4",
  wsd: "5",
  acc: "6",
  misc: "7",
};

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
 * The filtered library address for `/videos/<season>`,
 * `/videos/<season>/<format>` or `/videos/<season>/<tournament>` — and with
 * `allowFormatTournament`, `/videos/<season>/<format>/<tournament>` — or
 * `null` for any other path.
 */
export function videoListingPath(
  pathname: string,
  search = "",
  { allowFormatTournament = false }: { allowFormatTournament?: boolean } = {},
): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const style = segments[2] ? FORMAT_STYLES[segments[2].toLowerCase()] : undefined;
  const maxLength = style && allowFormatTournament ? 4 : 3;
  if (segments[0] !== "videos" || segments.length < 2 || segments.length > maxLength) return null;

  const season = segments[1];
  const tournament = style ? segments[3] : segments[2];
  if (!SEASON.test(season)) return null;
  const year = seasonFilter(season);
  if (year === null) return null;

  const query = new URLSearchParams(search);
  // `archive` is the path's name for the season filter's `legacy`.
  query.set("year", year);
  if (style) query.set("style", style);
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
