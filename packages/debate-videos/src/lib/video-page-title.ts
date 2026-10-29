/**
 * @fileoverview The title a watch page carries — in the browser tab, in search
 * results and in its heading — built from the round rather than the upload's
 * own title: the tournament's year and name, the level and round, then the
 * two teams, each followed by its rank and argument when they are known.
 *
 * `"2026 NDT College Octas: Kansas #14 OW (K) vs CSULB #7 MO (Policy)"`
 *
 * A video with no teams recorded, and whose title does not read as a round
 * (see `parseRoundTitle`), keeps its own title: a lecture is named well
 * enough by whoever uploaded it.
 * @module lib/video-page-title
 */

import { displayRoundLevel } from "../components/videos/card/round-level";
import { parseRoundTitle, videoRouteParts } from "./video-route";
import { parseTeamLabel } from "@debate-ai/rankings-adapter";
import type { DebateStyle, VideoType } from "../types/videos";

/** A team's rank, as the title prints it after the team's name. */
export interface VideoPageTitleRanks {
  /** The aff team's rank, e.g. `14`. */
  aff?: number | null;
  /** The neg team's rank. */
  neg?: number | null;
  /** The aff team's debaters' last names, e.g. `"Gallow & Stern"`, to print in place of the code. */
  affNames?: string | null;
  /** The neg team's debaters' last names, e.g. `"Gallow & Stern"`, to print in place of the code. */
  negNames?: string | null;
}

/**
 * The level each format is debated at, as the title names it. High-school
 * policy says so, since "Policy" alone would read as the college format.
 */
const STYLE_LEVELS: Record<DebateStyle, string> = {
  1: "HS Policy",
  2: "PF",
  3: "LD",
  4: "College",
  5: "WSD",
  6: "ACC",
  7: "",
};

/** A year the text names, e.g. `"2006"` in `"2006 NDT"`. */
function yearIn(text: string | null | undefined): string | null {
  return (text ?? "").match(/\b(?:19|20)\d{2}\b/)?.[0] ?? null;
}

/** The tournament's name without any year in it. */
function withoutYear(tournament: string): string {
  return tournament.replace(/\b(?:19|20)\d{2}\b/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * The calendar year the round was debated in.
 *
 * A year in the tournament's name or the video's title is taken as is. Else
 * the season decides: a season runs July to June and is named for the year it
 * ends in, so an upload from the season's autumn is of an autumn tournament
 * (Kentucky, Harvard) and one from its spring of a spring one (the NDT).
 */
function tournamentYear(video: VideoType): string | null {
  const named = yearIn(video[7]) ?? yearIn(video[1]);
  if (named) return named;

  const season = typeof video[17] === "number" && video[17] > 1900 ? Math.trunc(video[17]) : null;
  const match = /^(\d{4})-(\d{2})/.exec((video[2] ?? "").trim());
  const published = match ? { year: Number(match[1]), month: Number(match[2]) } : null;
  if (season) {
    return published && published.year === season - 1 && published.month >= 7
      ? String(season - 1)
      : String(season);
  }
  return published ? String(published.year) : null;
}

/** The round's display name: `"Octas"`, `"Final"`, `"Round 3"`. */
function roundName(roundLevel: string | null | undefined): string | null {
  const label = displayRoundLevel(roundLevel);
  if (!label) return roundLevel?.trim() || null;
  return /^R\d+$/.test(label) ? `Round ${label.slice(1)}` : label;
}

/** `"Kansas #14 OW (K)"`: the team with its rank between the school and the
 * code, then its argument when known. When `names` are provided, the code is
 * replaced by the debaters' last names (`"Emory GS"` → `"Emory #1 Gallow &
 * Stern"`). A label with no code (`"Boston College"`) takes the rank after it. */
function teamWithDetails(
  team: string,
  names: string | null | undefined,
  rank: number | null | undefined,
  argument: string | null | undefined,
): string {
  const rankLabel = typeof rank === "number" && rank > 0 ? `#${rank}` : "";
  const parsed = parseTeamLabel(team);
  const displayTeam = parsed
    ? [parsed.school, rankLabel, names || parsed.code].filter(Boolean).join(" ")
    : [team, rankLabel].filter(Boolean).join(" ");
  const arg = argument?.trim();
  return `${displayTeam}${arg ? ` (${arg})` : ""}`;
}

/**
 * The watch page's title for `video`.
 *
 * @param video - The video tuple.
 * @param ranks - Each team's rank in the rankings the watch page reads (the
 *   current season's, or a past college season's table); left out when
 *   neither team is ranked.
 * @returns The round's title, or the video's own title when it is not a round.
 */
export function videoPageTitle(video: VideoType, ranks: VideoPageTitleRanks = {}): string {
  const parts = videoRouteParts(video);
  const fromTitle = parts.affTeam || parts.negTeam ? null : parseRoundTitle(parts.title);
  const affTeam = parts.affTeam?.trim() || fromTitle?.affTeam || null;
  const negTeam = parts.negTeam?.trim() || fromTitle?.negTeam || null;
  if (!affTeam && !negTeam) return parts.title;

  // A round read out of the title has no ranks or arguments attached to it.
  const aff = affTeam
    ? fromTitle
      ? affTeam
      : teamWithDetails(affTeam, ranks.affNames, ranks.aff, parts.arg1ac)
    : null;
  const neg = negTeam
    ? fromTitle
      ? negTeam
      : teamWithDetails(negTeam, ranks.negNames, ranks.neg, parts.arg2nr)
    : null;

  const tournament = withoutYear(fromTitle?.tournament ?? parts.tournament ?? "");
  const level =
    typeof parts.style === "number" && STYLE_LEVELS[parts.style as DebateStyle] !== "College"
      ? STYLE_LEVELS[parts.style as DebateStyle] ?? ""
      : "";
  const heading = [
    fromTitle?.season ?? tournamentYear(video),
    tournament,
    level,
    roundName(fromTitle?.round ?? parts.roundLevel),
  ]
    .filter(Boolean)
    .join(" ");

  const teams = aff && neg ? `${aff} vs ${neg}` : (aff ?? neg)!;
  return heading ? `${heading}: ${teams}` : teams;
}
