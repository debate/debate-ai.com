/**
 * @fileoverview The canonical address of a video.
 *
 * A tagged debate round lives at
 * `/videos/<season>/<tournament>/<round>/<aff>-<neg>`, e.g.
 * `/videos/21-22/ndt/finals/dartmouth-sv-michigan-pr`, and a video made from
 * that round — its analysis, one part of a split upload — one segment below
 * it: `/videos/21-22/ndt/finals/dartmouth-sv-michigan-pr/analysis`. Everything
 * else — a lecture, or a round nobody has tagged with a round and a team yet —
 * lives at `/videos/<season>/<event>/<matchup>`.
 *
 * The season is spelled as the two years it spans, `21-22`, because a season
 * runs from summer to summer and a bare `2022` could mean either half. Paths
 * from before that spelled it as the year the season ended (`/videos/2022/…`);
 * every path builder takes a {@link SeasonSpelling} to rebuild them, so old
 * links still resolve.
 *
 * The segments are coarse-to-fine, which is what the old flat
 * `/videos/watch/<title-slug>` could never be. Every segment is for
 * readers and for search engines, and is re-derived on every request so a
 * corrected team name or a re-tagged tournament redirects to the
 * current address instead of leaving two indexable URLs for one video.
 * @module lib/video-route
 */

import { formatSeasonLabel } from "@debate/data-sync/src/videos/video-rows";
import { slugifyVideoTitle } from "./video-slug";
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

/**
 * How a path spells its season: `"season"` is the current `21-22`, `"year"`
 * the bare `2022` (or, for an undated season, the publish year) that paths
 * used before it.
 */
export type SeasonSpelling = "season" | "year";

/** A season segment in either spelling: `21-22`, or the older `2022`. */
const SEASON_SEGMENT = /^(?:(\d{2})-(\d{2})|((?:19|20)\d{2}))$/;

/**
 * The year a season segment's season ends in.
 *
 * @param segment - `"21-22"`, or a bare year as older paths spelled it.
 * @returns `2022` for either, or `null` when the segment is not a season
 *   (including `archive` and a pair of years that are not consecutive).
 */
export function parseSeasonSegment(segment: string | null | undefined): number | null {
  const match = (segment ?? "").trim().match(SEASON_SEGMENT);
  if (!match) return null;
  if (match[3]) return Number(match[3]);
  const start = Number(match[1]);
  const end = Number(match[2]);
  if ((start + 1) % 100 !== end) return null;
  // Two digits name a year from 1970 to 2069, far wider than the library.
  return end + (end >= 70 ? 1900 : 2000);
}

/**
 * The season a publish date falls in, by the year it ends: July starts the
 * next one, as `seasonYearForDate` in debate-data-sync has it.
 */
function seasonEndYearForDate(date: Date): number {
  return date.getUTCFullYear() + (date.getUTCMonth() >= 6 ? 1 : 0);
}

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

/** The path segments under `/videos`. */
export interface VideoRouteSegments {
  /** Season, e.g. `"05-06"`, or {@link ARCHIVE_SEASON_SEGMENT}. */
  season: string;
  /**
   * The tournament for a round (`"ndt"`), else format and tournament or a
   * lecture category (`"college-ndt"`, `"critique-critical-theory"`).
   */
  event: string;
  /**
   * The round (`"finals"`) when {@link VideoRouteSegments.teams} is set;
   * otherwise who debated, which round and what was run, or the title.
   */
  matchup: string;
  /** Who debated (`"dartmouth-sv-michigan-pr"`), for a tagged round only. */
  teams?: string;
  /**
   * Which video of that round this is, when it is not the round itself:
   * `"analysis"`, `"part-2"`. Only ever set alongside `teams`.
   */
  variant?: string;
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
 * The season segment, e.g. `"05-06"`.
 *
 * `seasonYear` is preferred over the publish date because the two disagree
 * exactly where it matters: a round debated in March 2006 belongs to the
 * 2005-06 season, and an upload posted months later still does. Without one,
 * the season is the one the publish date falls in.
 *
 * @param spelling - `"year"` rebuilds the bare-year segment older paths used:
 *   the season's end year, or for an undated season the publish year itself.
 */
export function seasonSegment(parts: VideoRouteParts, spelling: SeasonSpelling = "season"): string {
  if (parts.seasonYear && Number.isFinite(parts.seasonYear) && parts.seasonYear > 1900) {
    const year = Math.trunc(parts.seasonYear);
    return spelling === "year" ? String(year) : formatSeasonLabel(year);
  }
  const date = parts.date ? new Date(parts.date) : null;
  const year = date ? date.getUTCFullYear() : Number.NaN;
  if (!date || !Number.isFinite(year) || year <= 1900) return ARCHIVE_SEASON_SEGMENT;
  return spelling === "year" ? String(year) : formatSeasonLabel(seasonEndYearForDate(date));
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
 * Longest a matchup segment may grow once the title is added to it, for a
 * video whose tags alone do not say which one it is.
 */
const MAX_TITLED_MATCHUP_LENGTH = 110;

/** The matchup segment built from the tags alone, before any title is added. */
function taggedMatchupSegment(parts: VideoRouteParts): string {
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

  return pieces.join("-");
}

/** Clips a slug to `max` characters, at the last whole word when it can. */
function clipSlug(slug: string, max: number): string {
  if (slug.length <= max) return slug;
  const clipped = slug.slice(0, max);
  const lastBreak = clipped.lastIndexOf("-");
  return (lastBreak > max / 2 ? clipped.slice(0, lastBreak) : clipped).replace(/-+$/, "");
}

/**
 * The matchup segment, naming who debated and which round.
 *
 * Teams first, then the round, then the arguments that were run — each only
 * while the segment has room for it. A video with no teams recorded (a
 * lecture, or a round nobody has tagged yet) falls back to its title, which
 * is what the old flat slug carried and is still better than a bare id.
 *
 * A video with a round or arguments but no team would otherwise get a
 * partial address that names no one video — every untagged policy final of a
 * season at `/videos/26-27/policy/finals` — so its title is added after the
 * tags: `finals-<title-slug>`, or the title alone when it already says them.
 *
 * The video id is no longer appended — clean URLs are the point.
 */
export function matchupSegment(parts: VideoRouteParts): string {
  const tagged = taggedMatchupSegment(parts);
  const titleSlug = slugifyVideoTitle(parts.title);
  if (!tagged) return titleSlug || "video";
  if (parts.affTeam || parts.negTeam || !titleSlug) return tagged;
  if (`-${titleSlug}-`.includes(`-${tagged}-`)) return titleSlug;
  return clipSlug(`${tagged}-${titleSlug}`, MAX_TITLED_MATCHUP_LENGTH);
}

/**
 * The teams segment of a round: `aff-neg`, or the one team recorded.
 *
 * The `vs` the segment used to carry is dropped: the aff always comes first,
 * so it said nothing the order does not.
 *
 * @returns The slug, or `""` when no team is recorded.
 */
export function teamsSegment(parts: VideoRouteParts): string {
  if (parts.affTeam && parts.negTeam) {
    return slugifyVideoTitle(`${parts.affTeam} ${parts.negTeam}`);
  }
  return slugifyVideoTitle(parts.affTeam ?? parts.negTeam ?? "");
}

/** The teams segment as it was spelled before `vs` was dropped from it. */
function teamsSegmentWithVs(parts: VideoRouteParts): string {
  if (parts.affTeam && parts.negTeam) {
    return slugifyVideoTitle(`${parts.affTeam} vs ${parts.negTeam}`);
  }
  return teamsSegment(parts);
}

/** Drops a trailing event year too, so `"NDT 2026"` slugs as `"ndt"`. */
function withoutAnyTournamentYear(tournament: string): string {
  return withoutTournamentYear(tournament)
    .replace(/\s+(19|20)\d{2}(?=\s|$)/g, "")
    .trim();
}

/** A round as read from a video's title, for a video nobody has tagged. */
export interface TitleRound {
  /** The year the title names, e.g. `"2022"`, taken as the season's end. */
  season: string;
  tournament: string;
  round: string;
  affTeam: string;
  negTeam: string;
}

/**
 * Round names a title can carry: elimination rounds by any of their usual
 * spellings, and numbered prelims (`Round 3`, `Rd 3`, `R3`). A bare `Round`
 * with no number is not one — "Round Analysis" is a lecture series.
 */
const TITLE_ROUND =
  /\b(?:(?:double|triple)[- ]?oct(?:a|o)(?:final)?s|oct(?:a|o)(?:final)?s|quarter(?:final)?s|semi(?:final)?s|finals?|doubles|triples|runoffs|round\s*\d{1,2}|rd\.?\s*\d{1,2}|r\d{1,2})\b/i;

/** What separates the parts of a title: a spaced dash, a pipe, a colon. */
const TITLE_SEPARATOR = /\s[-–—]\s|\s*[|│]\s*|:\s/;

/** Strips side labels and trim noise from a team name read out of a title. */
function cleanTitleTeam(team: string): string {
  return team
    .replace(/\((?:aff|neg)\)/gi, "")
    .replace(/^\s*(?:aff|neg)\s+/i, "")
    .replace(/[\s.,]+$/, "")
    .trim();
}

/**
 * Reads a round out of a title like
 * `"2022 NDT Finals - Dartmouth SV vs Michigan PR - Round Analysis"`.
 *
 * Only a title that names a year, a tournament, a round and two teams counts,
 * so a lecture titled `"DDI 2020 - Cap K vs Critical Affs"` is left alone.
 *
 * @returns The round, or `null` when the title does not read as one.
 */
export function parseRoundTitle(title: string | null | undefined): TitleRound | null {
  if (!title) return null;
  const year = title.match(/\b(19|20)\d{2}\b/)?.[0];
  const roundMatch = title.match(TITLE_ROUND);
  if (!year || !roundMatch || roundMatch.index === undefined) return null;

  const before = title.slice(0, roundMatch.index);
  const after = title.slice(roundMatch.index + roundMatch[0].length);
  const vs = after.match(/\s+vs\.?\s+/i);
  if (!vs || vs.index === undefined) return null;

  // The tournament is the last part of the title before the round, with any
  // year and brackets taken out; the teams sit either side of the "vs".
  const tournament = withoutAnyTournamentYear(
    (before.split(TITLE_SEPARATOR).filter((part) => part.trim()).pop() ?? "")
      .replace(/[[\]()]/g, " ")
      .replace(/\b(19|20)\d{2}\b/g, " ")
      .replace(/\s+/g, " "),
  );
  const affTeam = cleanTitleTeam(after.slice(0, vs.index).split(TITLE_SEPARATOR).pop() ?? "");
  const negTeam = cleanTitleTeam(
    after
      .slice(vs.index + vs[0].length)
      .split(TITLE_SEPARATOR)[0]
      .split(/[[(]|\s+(?:round analysis|part|pt)\b/i)[0],
  );
  if (!tournament || !affTeam || !negTeam) return null;

  return { season: year, tournament, round: roundMatch[0], affTeam, negTeam };
}

/**
 * The part number of a round uploaded in pieces — `"Part 2"`, `"Pt 2"`,
 * `"[2/2]"` — so each piece gets its own address.
 */
function titlePart(title: string | null | undefined): string | null {
  const match = (title ?? "").match(/\b(?:part|pt)\.?\s*(\d{1,2})\b|\[(\d{1,2})\s*\/\s*\d{1,2}\]/i);
  return match ? (match[1] ?? match[2]) : null;
}

/** Slugifies and joins the non-empty pieces with `-`. */
function joinSlugs(...pieces: (string | null | undefined)[]): string {
  return pieces
    .map((piece) => slugifyVideoTitle(piece ?? ""))
    .filter(Boolean)
    .join("-");
}

/**
 * The variant word for a lecture filed under a round: its category, less a
 * leading "round" the round segment already says — `Round Analysis` is
 * `analysis`.
 */
function categoryVariant(style: VideoRouteParts["style"]): string | null {
  if (typeof style !== "string") return null;
  return slugifyVideoTitle(style).replace(/^round-(?=.)/, "");
}

/** The pieces a round's segments are built from, before they are spelled. */
interface RoundRoute {
  season: string;
  event: string;
  round: string;
  parts: VideoRouteParts;
  /** A lecture read as a round carries its category; see {@link categoryVariant}. */
  category: string | null;
  part: string | null;
}

/** Reads a video as a round, from its tags or failing that its title. */
function roundRoute(parts: VideoRouteParts, spelling: SeasonSpelling = "season"): RoundRoute | null {
  const round = slugifyVideoTitle(parts.roundLevel ?? "");
  const part = titlePart(parts.title);

  if (round && teamsSegment(parts)) {
    const tournament = parts.tournament
      ? slugifyVideoTitle(withoutAnyTournamentYear(parts.tournament))
      : "";
    return {
      season: seasonSegment(parts, spelling),
      event: tournament || eventSegment(parts),
      round,
      parts,
      category: null,
      part,
    };
  }

  const fromTitle = parseRoundTitle(parts.title);
  if (!fromTitle) return null;
  return {
    season: spelling === "year" ? fromTitle.season : formatSeasonLabel(Number(fromTitle.season)),
    event: slugifyVideoTitle(fromTitle.tournament),
    round: slugifyVideoTitle(fromTitle.round),
    parts: { ...parts, affTeam: fromTitle.affTeam, negTeam: fromTitle.negTeam },
    category: categoryVariant(parts.style),
    part,
  };
}

/**
 * Builds the segments of a video's canonical path.
 *
 * A round with a recorded round level and at least one team gets the
 * four-segment `<season>/<tournament>/<round>/<teams>` form; the tournament
 * falls back to the format when none is recorded. A video without those tags
 * whose title reads as a round (see {@link parseRoundTitle}) gets the same
 * form from its title. Anything else gets `<season>/<event>/<matchup>`.
 *
 * A video that is not the round itself gets a fifth, `variant` segment so it
 * does not take the round's address: a lecture read as a round carries its
 * category (`analysis`), a round uploaded in pieces its part (`part-2`).
 */
export function videoRouteSegments(
  parts: VideoRouteParts,
  spelling: SeasonSpelling = "season",
): VideoRouteSegments {
  const round = roundRoute(parts, spelling);
  if (!round) {
    return {
      season: seasonSegment(parts, spelling),
      event: eventSegment(parts),
      matchup: matchupSegment(parts),
    };
  }

  const variant = joinSlugs(round.category, round.part && `part ${round.part}`);
  return {
    season: round.season,
    event: round.event,
    matchup: round.round,
    teams: teamsSegment(round.parts),
    ...(variant ? { variant } : {}),
  };
}

/** Joins route segments into a `/videos/...` path. */
function hrefFromSegments({ season, event, matchup, teams, variant }: VideoRouteSegments): string {
  return ["/videos", season, event, matchup, teams, variant].filter(Boolean).join("/");
}

/**
 * Builds a video's canonical path.
 *
 * @param video - The video, as a tuple or as named parts.
 * @returns e.g. `/videos/21-22/ndt/finals/dartmouth-sv-michigan-pr`, or
 *   `/videos/19-20/critique-critical-theory/how-to-give-a-2nr` for a lecture.
 */
export function videoRouteHref(
  video: VideoType | VideoRouteParts,
  spelling: SeasonSpelling = "season",
): string {
  const parts = Array.isArray(video) ? videoRouteParts(video) : video;
  return hrefFromSegments(videoRouteSegments(parts, spelling));
}

/**
 * The three-segment path a round had before rounds moved to
 * `<season>/<tournament>/<round>/<teams>`, e.g.
 * `/videos/05-06/college-ndt/northwestern-gw-vs-michigan-state-bp-finals`.
 *
 * Kept so links shared under that scheme still resolve and redirect.
 */
export function legacyVideoRouteHref(
  video: VideoType | VideoRouteParts,
  spelling: SeasonSpelling = "season",
): string {
  const parts = Array.isArray(video) ? videoRouteParts(video) : video;
  const matchup = taggedMatchupSegment(parts) || slugifyVideoTitle(parts.title) || "video";
  return `/videos/${seasonSegment(parts, spelling)}/${eventSegment(parts)}/${matchup}`;
}

/**
 * The three-segment path a video with no team recorded had before its title
 * was added to it, e.g. `/videos/26-27/policy/finals`.
 *
 * Several videos can share it, so it only ever redirects; see
 * `getVideoByRouteSegments` in the app.
 *
 * @returns The path, or `null` when it is the video's current one or the
 *   video is filed as a round.
 */
export function untitledVideoRouteHref(
  video: VideoType | VideoRouteParts,
  spelling: SeasonSpelling = "season",
): string | null {
  const parts = Array.isArray(video) ? videoRouteParts(video) : video;
  if (roundRoute(parts)) return null;
  const tagged = taggedMatchupSegment(parts);
  if (!tagged || tagged === matchupSegment(parts)) return null;
  return `/videos/${seasonSegment(parts, spelling)}/${eventSegment(parts)}/${tagged}`;
}

/**
 * The four-segment path a round had before `vs` was dropped from its teams
 * and its variant moved into a segment of its own, e.g.
 * `/videos/21-22/ndt/finals/dartmouth-sv-vs-michigan-pr-round-analysis`.
 *
 * Kept so links shared under that scheme still resolve and redirect.
 *
 * @returns The path, or `null` for a video that is not filed as a round.
 */
export function previousVideoRouteHref(
  video: VideoType | VideoRouteParts,
  spelling: SeasonSpelling = "season",
): string | null {
  const parts = Array.isArray(video) ? videoRouteParts(video) : video;
  const round = roundRoute(parts, spelling);
  if (!round) return null;
  const teams = [
    teamsSegmentWithVs(round.parts),
    joinSlugs(typeof parts.style === "string" && round.category ? parts.style : null),
    joinSlugs(round.part && `part ${round.part}`),
  ]
    .filter(Boolean)
    .join("-");
  return `/videos/${round.season}/${round.event}/${round.round}/${teams}`;
}

/**
 * Reads the matchup segment back from a canonical path.
 *
 * The URL no longer carries a video id, so the matchup segment
 * is returned as-is for use as a lookup key.
 *
 * @param matchup - The `[matchup]` route segment.
 * @returns The matchup segment, or `null` when absent.
 */
export function parseVideoRouteMatchup(matchup: string | null | undefined): string | null {
  if (!matchup) return null;
  return matchup.trim().replace(/\/+$/, "");
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
    same(requested.matchup, canonical.matchup) &&
    same(requested.teams, canonical.teams ?? "") &&
    same(requested.variant, canonical.variant ?? "")
  );
}
