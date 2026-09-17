/**
 * @fileoverview The canonical address of a video: `/videos/<season>/<event>/<matchup>`.
 *
 * The first address a video had was `/videos/watch/<title-slug>-<id>`, which
 * put the whole title in one flat segment. That reads as a page title, not as
 * a place in an archive: nothing in it says which season, tournament or format
 * the round belongs to, two rounds of the same bracket share no prefix, and a
 * reader cannot shorten the URL to see what else is there.
 *
 * The shape here is the one an archive wants, coarse to fine:
 *
 * ```
 * /videos/2006/college-ndt/northwestern-vs-michigan-state-finals-dQw4w9WgXcQ
 *         ^season  ^format-tournament  ^who debated, which round, and the id
 * ```
 *
 * Only the trailing 11-character id identifies the video — the same rule
 * {@link parseVideoWatchSlug} already enforces for the old flat slug, and the
 * reason a retitled video, a corrected team name or a re-tagged tournament
 * never breaks a link that is already out in the world. Everything before the
 * id is for readers and for search engines, so the route re-derives the
 * canonical path and redirects when what was asked for no longer matches.
 * @module lib/video-route
 */

import { parseVideoWatchSlug, slugifyVideoTitle } from "./video-slug";
import type { DebateStyle, VideoType } from "../types/videos";

/** URL word for each numeric debate style. */
const STYLE_SLUGS: Record<DebateStyle, string> = {
  1: "policy",
  2: "pf",
  3: "ld",
  4: "college",
};

/** Season segment for a video whose publish date cannot be parsed. */
export const ARCHIVE_SEASON_SEGMENT = "archive";

/** Event segment for a video with no tournament, format or category at all. */
export const UNSORTED_EVENT_SEGMENT = "library";

/**
 * Longest the matchup segment may grow *before* its id is appended. Teams,
 * round and arguments are added in that order and the first one that would
 * overflow this ends the segment, so a URL stays pasteable rather than
 * carrying every argument in a four-off round.
 */
const MAX_MATCHUP_LENGTH = 90;

/** The fields of a video this module reads, named rather than positional. */
export interface VideoRouteParts {
  videoId: string;
  title: string;
  /** Publish date, used for the season when `seasonYear` is absent. */
  date?: string | null;
  /** Season the video belongs to — `2006` for the 2005-06 season. */
  seasonYear?: number | null;
  /** Numeric debate style, or a lecture's category label. */
  style?: DebateStyle | string | null;
  tournament?: string | null;
  roundLevel?: string | null;
  affTeam?: string | null;
  negTeam?: string | null;
  /** The aff's 1AC argument, when recorded. */
  arg1ac?: string | null;
  /** The neg's 2NR argument, when recorded. */
  arg2nr?: string | null;
}

/** The three path segments under `/videos`. */
export interface VideoRouteSegments {
  /** Season, e.g. `"2006"`, or {@link ARCHIVE_SEASON_SEGMENT}. */
  season: string;
  /** Format and tournament, e.g. `"college-ndt"` or `"pf-toc"`. */
  event: string;
  /** Who debated, which round, and the video id. */
  matchup: string;
}

/** Reads the fields this module needs out of a {@link VideoType} tuple. */
export function videoRouteParts(video: VideoType): VideoRouteParts {
  return {
    videoId: video[0],
    title: video[1],
    date: video[2],
    style: video[6] ?? null,
    tournament: video[7] ?? null,
    roundLevel: video[8] ?? null,
    affTeam: video[9] ?? null,
    negTeam: video[10] ?? null,
    arg1ac: video[13] ?? null,
    arg2nr: video[14] ?? null,
    seasonYear: video[17] ?? null,
  };
}

/** Drops a leading event year, so `"2006 NDT"` slugs as `"ndt"`. */
function withoutTournamentYear(tournament: string): string {
  return tournament.replace(/^\s*(19|20)\d{2}\s+/, "").trim();
}

/**
 * The season segment.
 *
 * `seasonYear` is preferred over the publish date because the two disagree
 * exactly where it matters: a round debated in March 2006 belongs to the
 * 2005-06 season, and an upload posted months later still does.
 */
export function seasonSegment(parts: VideoRouteParts): string {
  if (parts.seasonYear && Number.isFinite(parts.seasonYear) && parts.seasonYear > 1900) {
    return String(Math.trunc(parts.seasonYear));
  }
  const year = parts.date ? new Date(parts.date).getUTCFullYear() : Number.NaN;
  return Number.isFinite(year) && year > 1900 ? String(year) : ARCHIVE_SEASON_SEGMENT;
}

/**
 * The format-and-tournament segment.
 *
 * Both halves are kept when both are known — the format is what a reader
 * scanning a URL recognises, the tournament is what makes the segment worth
 * shortening to — and whichever exists alone stands on its own. A lecture,
 * whose "style" slot holds a category label rather than a number, is filed
 * under that category.
 */
export function eventSegment(parts: VideoRouteParts): string {
  const styleSlug =
    typeof parts.style === "number" ? STYLE_SLUGS[parts.style as DebateStyle] : undefined;
  const categorySlug =
    typeof parts.style === "string" ? slugifyVideoTitle(parts.style) : "";
  const tournamentSlug = parts.tournament
    ? slugifyVideoTitle(withoutTournamentYear(parts.tournament))
    : "";

  if (styleSlug && tournamentSlug) return `${styleSlug}-${tournamentSlug}`;
  return tournamentSlug || styleSlug || categorySlug || UNSORTED_EVENT_SEGMENT;
}

/**
 * The matchup segment, ending in the video id.
 *
 * Teams first, then the round, then the arguments that were run — each only
 * while the segment has room for it. A video with no teams recorded (a
 * lecture, or a round nobody has tagged yet) falls back to its title, which
 * is what the old flat slug carried and is still better than a bare id.
 */
export function matchupSegment(parts: VideoRouteParts): string {
  const pieces: string[] = [];
  let length = 0;

  /** Appends a slugified piece while the segment still has room for it. */
  const add = (value: string | null | undefined) => {
    const slug = slugifyVideoTitle(value ?? "");
    if (!slug) return;
    const cost = slug.length + (pieces.length > 0 ? 1 : 0);
    if (length + cost > MAX_MATCHUP_LENGTH) return;
    pieces.push(slug);
    length += cost;
  };

  if (parts.affTeam && parts.negTeam) {
    add(`${parts.affTeam} vs ${parts.negTeam}`);
  } else {
    add(parts.affTeam ?? parts.negTeam);
  }
  add(parts.roundLevel);
  add(parts.arg1ac);
  add(parts.arg2nr);

  const described = pieces.join("-") || slugifyVideoTitle(parts.title);
  return described ? `${described}-${parts.videoId}` : parts.videoId;
}

/** Builds all three segments of a video's canonical path. */
export function videoRouteSegments(parts: VideoRouteParts): VideoRouteSegments {
  return {
    season: seasonSegment(parts),
    event: eventSegment(parts),
    matchup: matchupSegment(parts),
  };
}

/**
 * Builds a video's canonical path.
 *
 * @param video - The video, as a tuple or as named parts.
 * @returns e.g. `/videos/2006/college-ndt/northwestern-vs-michigan-state-finals-dQw4w9WgXcQ`.
 */
export function videoRouteHref(video: VideoType | VideoRouteParts): string {
  const parts = Array.isArray(video) ? videoRouteParts(video) : video;
  const { season, event, matchup } = videoRouteSegments(parts);
  return `/videos/${season}/${event}/${matchup}`;
}

/**
 * Reads the video id back out of a canonical path's last segment.
 *
 * Delegates to the flat slug's parser: both shapes end in `-<id>`, and the
 * id is read from the end rather than by splitting, because YouTube ids may
 * themselves contain `-`.
 *
 * @param matchup - The `[matchup]` route segment.
 * @returns The YouTube video id, or `null` when the segment carries none.
 */
export function parseVideoRouteMatchup(matchup: string | null | undefined): string | null {
  return parseVideoWatchSlug(matchup);
}

/**
 * Whether a request's segments are already the video's canonical ones.
 *
 * The season and event segments are compared case-insensitively so an
 * uppercase link is not bounced through a redirect it does not need, while a
 * genuinely stale segment — a corrected tournament, a retitled lecture — is
 * still sent to the current address.
 */
export function isCanonicalVideoRoute(
  parts: VideoRouteParts,
  requested: Partial<VideoRouteSegments>,
): boolean {
  const canonical = videoRouteSegments(parts);
  const same = (a: string | undefined, b: string) => (a ?? "").toLowerCase() === b.toLowerCase();
  return (
    same(requested.season, canonical.season) &&
    same(requested.event, canonical.event) &&
    same(requested.matchup, canonical.matchup)
  );
}
