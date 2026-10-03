/**
 * @fileoverview Opens prediction markets on its own, from the weekly cron.
 *
 * - **Rating markets** for the top {@link TOP_TEAMS_PER_DIVISION} entries of
 *   each division in {@link AUTO_DIVISIONS}, read from the bundled
 *   `debate-rankings` CSVs. Each closes {@link RATING_MARKET_DAYS} days out
 *   and settles itself (see `resolveDueMarkets`).
 * - **Tournament markets** for the biggest tournaments of the season
 *   ({@link SEASON_TOURNAMENTS}): "who wins it", with the division's current
 *   top {@link TOURNAMENT_FIELD} entries plus "Someone else". These have no
 *   hosted results, so a moderator settles them by hand.
 *
 * Markets are opened with no creator (`creator_id` null), so they never count
 * toward anyone's open-market limit. A market is only opened when none is
 * already open for the same team or tournament, so the weekly tick is safe to
 * repeat. The tournament list is hand-maintained: update it each season.
 *
 * @module lib/predictions/auto-markets
 */

import { and, eq, isNull, like } from "drizzle-orm";
import { RATING_OUTCOMES, manualOutcomes, type MarketOutcome, type MarketSource } from "@debate/predictions";
import { getRankingDatasetInfo, loadRankingDataset, type RankingEntry } from "@debate/rankings-adapter";

import type { getDBFromContext } from "@/lib/database/context";
import { predictionMarkets } from "@/lib/database/schema";
import { insertMarket } from "./queries";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

/** Divisions that get automatic markets: `debate-rankings` dataset ids. */
export const AUTO_DIVISIONS = ["hsld", "hspf"] as const;
export const TOP_TEAMS_PER_DIVISION = 5;
export const RATING_MARKET_DAYS = 28;
export const TOURNAMENT_FIELD = 8;

export interface SeasonTournament {
  name: string;
  /** Unix seconds (UTC) when betting closes — the first day of the tournament. */
  startsAt: number;
  /** Divisions it runs, as dataset ids from {@link AUTO_DIVISIONS}. */
  divisions: readonly string[];
}

const day = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 1000);

/** 2026–27 season, from the published tournament calendars. */
export const SEASON_TOURNAMENTS: readonly SeasonTournament[] = [
  { name: "Florida Blue Key", startsAt: day("2026-10-29"), divisions: ["hsld", "hspf"] },
  { name: "Glenbrooks", startsAt: day("2026-11-21"), divisions: ["hsld", "hspf"] },
  { name: "Barkley Forum (Emory)", startsAt: day("2027-01-21"), divisions: ["hsld", "hspf"] },
  { name: "Harvard", startsAt: day("2027-02-13"), divisions: ["hsld", "hspf"] },
  { name: "Cal Invitational", startsAt: day("2027-02-13"), divisions: ["hsld", "hspf"] },
];

/** Entries ordered by rank, best first. */
export function topEntries(entries: readonly RankingEntry[], count: number): RankingEntry[] {
  return [...entries].sort((a, b) => a.rank - b.rank).slice(0, count);
}

/** The outcomes of a "who wins" market: the field plus a catch-all. */
export function tournamentOutcomes(field: readonly RankingEntry[]): MarketOutcome[] {
  return manualOutcomes([...field.map((entry) => `${entry.name} (${entry.school})`), "Someone else"]);
}

async function hasOpenMarket(db: Db, match: ReturnType<typeof like>, extra?: ReturnType<typeof eq>): Promise<boolean> {
  const rows = await db
    .select({ id: predictionMarkets.id })
    .from(predictionMarkets)
    .where(and(eq(predictionMarkets.status, "open"), match, extra))
    .limit(1);
  return rows.length > 0;
}

export interface AutoMarketResult {
  rating: number;
  tournament: number;
}

/** Opens whatever auto markets are missing. Returns how many it opened. */
export async function openAutoMarkets(db: Db, now: number = Math.floor(Date.now() / 1000)): Promise<AutoMarketResult> {
  const result: AutoMarketResult = { rating: 0, tournament: 0 };
  const fields = new Map<string, RankingEntry[]>();

  for (const id of AUTO_DIVISIONS) {
    const info = getRankingDatasetInfo(id);
    if (!info) continue;
    const label = info.scope ? `${info.label} (${info.scope})` : info.label;
    const dataset = await loadRankingDataset(info.id);
    const top = topEntries(dataset.entries, Math.max(TOP_TEAMS_PER_DIVISION, TOURNAMENT_FIELD));
    fields.set(id, top);

    for (const entry of top.slice(0, TOP_TEAMS_PER_DIVISION)) {
      const hash = entry.hash.toLowerCase();
      const prefix = `{"type":"rating","dataset":${JSON.stringify(id)},"hash":${JSON.stringify(hash)},`;
      if (await hasOpenMarket(db, like(predictionMarkets.source, `${prefix}%`))) continue;
      const source: MarketSource = {
        type: "rating",
        dataset: id,
        hash,
        name: entry.name,
        school: entry.school,
        baseline: entry.rating,
      };
      await insertMarket(db, {
        id: crypto.randomUUID(),
        creatorId: null,
        kind: "rating",
        title: `Will ${entry.name} (${entry.school}) gain rating?`,
        description: `${label}, ranked #${entry.rank}. Settles on the site rating ${RATING_MARKET_DAYS} days from now.`,
        outcomes: [...RATING_OUTCOMES],
        source,
        closesAt: now + RATING_MARKET_DAYS * 24 * 60 * 60,
      });
      result.rating += 1;
    }
  }

  for (const tournament of SEASON_TOURNAMENTS) {
    if (tournament.startsAt <= now + 5 * 60) continue;
    for (const id of tournament.divisions) {
      const field = fields.get(id);
      const info = getRankingDatasetInfo(id);
      if (!field || !info) continue;
      const title = `Who wins ${tournament.name} ${info.label}?`;
      if (await hasOpenMarket(db, eq(predictionMarkets.title, title), isNull(predictionMarkets.creatorId))) continue;
      await insertMarket(db, {
        id: crypto.randomUUID(),
        creatorId: null,
        kind: "tournament",
        title,
        description: `The current top ${TOURNAMENT_FIELD} in the rankings. Bet on "Someone else" if you expect an upset. A moderator settles it from the final results.`,
        outcomes: tournamentOutcomes(field.slice(0, TOURNAMENT_FIELD)),
        source: { type: "manual" },
        closesAt: tournament.startsAt,
      });
      result.tournament += 1;
    }
  }
  return result;
}
