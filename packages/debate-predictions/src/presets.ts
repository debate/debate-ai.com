/**
 * @fileoverview The markets the site opens by itself, so the board is never
 * empty:
 *
 * - **Top teams** — for each division, a rating market on each of its five
 *   highest-ranked teams, one per calendar month. Each settles itself at the
 *   end of the month against the team's rating when it opened.
 * - **Major tournaments** — for each of the season's major tournaments, a
 *   winner market in every division it runs, listing that division's
 *   top-rated teams plus "anyone else". Betting closes when the tournament
 *   starts; a moderator settles it from the published results.
 *
 * Everything here is pure: {@link planPresetMarkets} turns the rankings and
 * the clock into the markets that should exist, and the app inserts whichever
 * are missing. Preset markets have stable ids, so planning twice never opens
 * a market twice.
 *
 * @module debate-predictions/presets
 */

import { RATING_OUTCOMES } from "./settle";
import type { PresetInfo } from "debate";
import type { MarketKind, MarketOutcome, MarketSource } from "./types";

/** A division the presets cover: a `debate-rankings` dataset. */
export interface PresetDivision {
  /** The `debate-rankings` dataset id. */
  dataset: string;
  label: string;
}

/**
 * The divisions with presets, in display order. `hsld_sepoct` is left out:
 * it ranks the same LD teams over a shorter window.
 */
export const PRESET_DIVISIONS: readonly PresetDivision[] = [
  { dataset: "hspf", label: "Public Forum" },
  { dataset: "hsld", label: "Lincoln-Douglas" },
  { dataset: "hscx", label: "Policy" },
  { dataset: "cpd", label: "College Policy" },
];

/** How many teams per division get a rating market. */
export const PRESET_TOP_TEAMS = 5;

/** How many top-rated teams a tournament winner market lists by name. */
export const PRESET_TOURNAMENT_FIELD = 8;

/** The catch-all outcome of every preset tournament market. */
export const FIELD_OUTCOME: MarketOutcome = { id: "field", label: "Anyone else" };

/** A major tournament of the season. */
export interface MajorTournament {
  /** Stable, and part of the market id. Matches `debate-rankings`' `majors` where it lists one. */
  slug: string;
  name: string;
  /** First and last day, ISO dates. */
  start: string;
  end: string;
  /** The datasets of the divisions it runs. */
  divisions: readonly string[];
  /**
   * False when the dates are the tournament's usual weekend rather than a
   * published invitation; betting closes on `start` either way.
   */
  datesConfirmed: boolean;
}

const HS = ["hspf", "hsld", "hscx"] as const;

/**
 * The fifteen biggest tournaments left in the 2026–27 season, in date order:
 * the national-circuit majors `debate-rankings` weights most, the national
 * championships (TOC, NDCA, NSDA) and the NDT for college policy. Greenhill,
 * Grapevine and the Mid America Cup were over before these markets opened.
 */
export const MAJOR_TOURNAMENTS: readonly MajorTournament[] = [
  { slug: "heart-of-texas", name: "Heart of Texas Invitational", start: "2026-10-09", end: "2026-10-12", divisions: ["hsld", "hscx"], datesConfirmed: false },
  { slug: "florida-blue-key", name: "Florida Blue Key", start: "2026-10-30", end: "2026-11-01", divisions: HS, datesConfirmed: false },
  { slug: "apple-valley", name: "Apple Valley (Minneapolis) Invitational", start: "2026-11-07", end: "2026-11-09", divisions: HS, datesConfirmed: true },
  { slug: "glenbrooks", name: "Glenbrooks", start: "2026-11-21", end: "2026-11-23", divisions: HS, datesConfirmed: true },
  { slug: "princeton", name: "Princeton Classic", start: "2026-12-04", end: "2026-12-06", divisions: HS, datesConfirmed: false },
  { slug: "blake", name: "Blake Holiday Classic", start: "2026-12-18", end: "2026-12-21", divisions: HS, datesConfirmed: true },
  { slug: "harvard-westlake", name: "Harvard-Westlake Invitational", start: "2027-01-15", end: "2027-01-18", divisions: HS, datesConfirmed: false },
  { slug: "emory", name: "Barkley Forum (Emory)", start: "2027-01-22", end: "2027-01-24", divisions: HS, datesConfirmed: false },
  { slug: "stanford", name: "Stanford Invitational", start: "2027-02-06", end: "2027-02-08", divisions: HS, datesConfirmed: false },
  { slug: "harvard", name: "Harvard National Tournament", start: "2027-02-13", end: "2027-02-15", divisions: HS, datesConfirmed: true },
  { slug: "cal", name: "Cal Invitational (Berkeley)", start: "2027-02-13", end: "2027-02-15", divisions: HS, datesConfirmed: false },
  { slug: "ndt", name: "National Debate Tournament", start: "2027-03-26", end: "2027-03-29", divisions: ["cpd"], datesConfirmed: false },
  { slug: "ndca", name: "NDCA Championship", start: "2027-04-02", end: "2027-04-05", divisions: HS, datesConfirmed: false },
  { slug: "toc", name: "Tournament of Champions", start: "2027-04-17", end: "2027-04-19", divisions: HS, datesConfirmed: true },
  { slug: "nsda", name: "NSDA National Tournament", start: "2027-06-13", end: "2027-06-18", divisions: HS, datesConfirmed: false },
];

/** A ranked team, as the presets need it. */
export interface PresetTeam {
  hash: string;
  name: string;
  school: string;
  /** Site-scale rating. */
  rating: number;
  rank: number;
}

/** One division's rankings, highest first or not — the plan sorts by rank. */
export interface PresetRankings {
  dataset: string;
  teams: readonly PresetTeam[];
}

/** A market the presets want open. */
export interface PlannedMarket {
  id: string;
  kind: MarketKind;
  title: string;
  description: string;
  outcomes: MarketOutcome[];
  source: MarketSource;
  closesAt: number;
}

export type { PresetInfo } from "debate";

const RATING_PREFIX = "preset:rating:";
const MAJOR_PREFIX = "preset:major:";

/** The calendar month `now` falls in (UTC): its key and when it ends. */
export function ratingPeriod(now: number): { key: string; closesAt: number } {
  const date = new Date(now * 1000);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return {
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    closesAt: Date.UTC(year, month + 1, 1) / 1000,
  };
}

export function presetRatingMarketId(dataset: string, hash: string, periodKey: string): string {
  return `${RATING_PREFIX}${dataset}:${hash.toLowerCase().slice(0, 16)}:${periodKey}`;
}

export function presetMajorMarketId(slug: string, dataset: string): string {
  return `${MAJOR_PREFIX}${slug}:${dataset}`;
}

/** The preset section a market id belongs to, or `null` for a market someone opened. */
export function parsePresetId(id: string): PresetInfo | null {
  if (id.startsWith(RATING_PREFIX)) {
    const [dataset] = id.slice(RATING_PREFIX.length).split(":");
    return dataset ? { group: "top-teams", dataset, tournament: null } : null;
  }
  if (id.startsWith(MAJOR_PREFIX)) {
    const [tournament, dataset] = id.slice(MAJOR_PREFIX.length).split(":");
    return tournament && dataset ? { group: "majors", dataset, tournament } : null;
  }
  return null;
}

/** When betting on a tournament closes: noon UTC on its first day. */
export function tournamentClose(tournament: MajorTournament): number {
  return Date.parse(`${tournament.start}T12:00:00Z`) / 1000;
}

function divisionLabel(dataset: string): string {
  return PRESET_DIVISIONS.find((division) => division.dataset === dataset)?.label ?? dataset;
}

function teamLabel(team: PresetTeam): string {
  return `${team.name} (${team.school})`;
}

function byRank(teams: readonly PresetTeam[]): PresetTeam[] {
  return [...teams].sort((a, b) => a.rank - b.rank);
}

/**
 * Every preset market that should be open at `now`: this month's rating
 * markets for each division's top five, and a winner market for every major
 * tournament that hasn't started, in each division it runs. A division with
 * no rankings gets neither.
 */
export function planPresetMarkets(now: number, rankings: readonly PresetRankings[]): PlannedMarket[] {
  const period = ratingPeriod(now);
  const planned: PlannedMarket[] = [];

  for (const division of PRESET_DIVISIONS) {
    const teams = byRank(rankings.find((r) => r.dataset === division.dataset)?.teams ?? []);
    for (const team of teams.slice(0, PRESET_TOP_TEAMS)) {
      planned.push({
        id: presetRatingMarketId(division.dataset, team.hash, period.key),
        kind: "rating",
        title: `Will ${team.name} (${team.school}) gain rating this month?`,
        description: `#${team.rank} in ${division.label}. Opened by the site for the ${division.label} top ${PRESET_TOP_TEAMS}.`,
        outcomes: [...RATING_OUTCOMES],
        source: {
          type: "rating",
          dataset: division.dataset,
          hash: team.hash.toLowerCase(),
          name: team.name,
          school: team.school,
          baseline: team.rating,
        },
        closesAt: period.closesAt,
      });
    }
  }

  for (const tournament of MAJOR_TOURNAMENTS) {
    const closesAt = tournamentClose(tournament);
    if (closesAt <= now) continue;
    for (const dataset of tournament.divisions) {
      const teams = byRank(rankings.find((r) => r.dataset === dataset)?.teams ?? []).slice(0, PRESET_TOURNAMENT_FIELD);
      if (teams.length === 0) continue;
      const label = divisionLabel(dataset);
      planned.push({
        id: presetMajorMarketId(tournament.slug, dataset),
        kind: "tournament",
        title: `Who wins ${label} at ${tournament.name}?`,
        description:
          `${formatDates(tournament)}${tournament.datesConfirmed ? "" : " (expected dates)"}. ` +
          `The ${teams.length} top-rated ${label} teams, plus everyone else. A moderator settles it from the published results.`,
        outcomes: [...teams.map((team) => ({ id: `team:${team.hash.toLowerCase().slice(0, 16)}`, label: teamLabel(team) })), FIELD_OUTCOME],
        source: { type: "manual" },
        closesAt,
      });
    }
  }

  return planned;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Nov 21–23, 2026" or "Jan 30 – Feb 1, 2027". */
export function formatDates(tournament: Pick<MajorTournament, "start" | "end">): string {
  const [sy, sm, sd] = tournament.start.split("-").map(Number);
  const [ey, em, ed] = tournament.end.split("-").map(Number);
  if (sy === ey && sm === em) return `${MONTHS[sm - 1]} ${sd}–${ed}, ${ey}`;
  if (sy === ey) return `${MONTHS[sm - 1]} ${sd} – ${MONTHS[em - 1]} ${ed}, ${ey}`;
  return `${MONTHS[sm - 1]} ${sd}, ${sy} – ${MONTHS[em - 1]} ${ed}, ${ey}`;
}
