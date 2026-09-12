/**
 * Decides what `/api/leaderboard` can serve for a division+year.
 *
 * Two independent upstreams back the leaderboard — the TOC bid list and
 * DebateDrills' Elo dataset — and they fail independently. This module owns
 * the "what can we still show?" question so that it is unit-testable; the
 * route is left as the HTTP shell around it.
 */

import {
  scrapeDivision,
  getDatasets,
  type LeaderboardEntry,
} from "debate-data-sync/src/rankings/sync-rankings-debatedrills";
import {
  scrapeVCX,
  scrapeVPF,
  scrapeVLD,
} from "debate-data-sync/src/rankings/sync-rankings-tocbidlist";
import { mergeElo } from "debate-data-sync/src/rankings/merge-elo";

/** The season the bid-list sources currently publish. */
export const CURRENT_YEAR = "2026";

/** Divisions for which DebateDrills publishes an Elo dataset. */
export const ELO_DIVISIONS = new Set(["VPF", "VLD"]);

const tocScrapers: Record<string, () => Promise<LeaderboardEntry[]>> = {
  VCX: scrapeVCX,
  VPF: scrapeVPF,
  VLD: scrapeVLD,
};

export type LeaderboardResolution =
  | { status: 200; rows: LeaderboardEntry[] }
  | { status: 400; error: string; details?: string }
  | { status: 502; error: string; details: string };

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const unavailable = (details: string): LeaderboardResolution => ({
  // 502, not 500: the failure is an upstream one and the app itself is fine.
  status: 502,
  error: "Leaderboard data is temporarily unavailable",
  details,
});

/**
 * Fetch DebateDrills Elo rows, or `null` if that source is unavailable.
 *
 * Never throws. Elo is supplementary to the bid list, so losing it must not
 * cost us the leaderboard. The failure is logged rather than swallowed: as a
 * bare `catch {}` a DebateDrills outage was invisible in Workers Logs and
 * indistinguishable from a season with no Elo published yet.
 */
async function fetchElo(
  division: string,
  year: string,
): Promise<LeaderboardEntry[] | null> {
  const config = getDatasets(year).find(
    (d) => d.division.toUpperCase() === division,
  );
  if (!config) return null;

  try {
    return await scrapeDivision(config);
  } catch (error) {
    console.error(
      `[leaderboard] DebateDrills scrape failed for ${division} ${year}:`,
      describe(error),
    );
    return null;
  }
}

/** Fetch TOC bid list rows, or `null` if that source is unavailable. */
async function fetchToc(
  division: string,
  scrape: () => Promise<LeaderboardEntry[]>,
): Promise<LeaderboardEntry[] | null> {
  try {
    return await scrape();
  } catch (error) {
    console.error(
      `[leaderboard] TOC bid list scrape failed for ${division}:`,
      describe(error),
    );
    return null;
  }
}

/**
 * Resolve the leaderboard rows for a division+year, degrading through the
 * sources that are still answering.
 *
 * Prior seasons are DebateDrills-only. For the current season the bid list is
 * the spine of the table and Elo is merged onto it; if the bid list is down we
 * fall back to Elo-only rows, which are still a useful ranking, and only
 * report an error when neither source produced anything.
 */
export async function resolveLeaderboard(
  division: string,
  year: string,
): Promise<LeaderboardResolution> {
  if (year !== CURRENT_YEAR) {
    // Prior years (2021-2025): DebateDrills Elo only, and only for VPF/VLD.
    if (!ELO_DIVISIONS.has(division)) {
      return { status: 200, rows: [] };
    }
    const rows = await fetchElo(division, year);
    return rows
      ? { status: 200, rows }
      : unavailable(`DebateDrills did not return rankings for ${division} ${year}`);
  }

  const tocScraper = tocScrapers[division];
  if (!tocScraper) {
    return { status: 400, error: "Invalid division" };
  }

  // Ask both upstreams at once and decide afterwards. Previously a single
  // throw from either escaped to a catch-all that answered 500 with nothing
  // rendered — which is how VPF, VLD and VCX went down together when the
  // shared TOC fetch broke.
  const [tocRows, drillsRows] = await Promise.all([
    fetchToc(division, tocScraper),
    ELO_DIVISIONS.has(division) ? fetchElo(division, year) : null,
  ]);

  if (tocRows) {
    return {
      status: 200,
      rows: drillsRows ? mergeElo(tocRows, drillsRows, division) : tocRows,
    };
  }

  if (drillsRows && drillsRows.length > 0) {
    return { status: 200, rows: drillsRows };
  }

  return unavailable(`No ranking source responded for ${division} ${year}`);
}
