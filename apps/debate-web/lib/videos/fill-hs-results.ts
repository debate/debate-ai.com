/**
 * @fileoverview Looks every high school Policy, PF and LD round up on Tabroom
 * and saves what it finds: the winner and ballot count when the video lacks
 * them, the judges, and which judges squirreled (voted for the loser).
 *
 * The high school twin of `fill-college-results.ts`, sharing its batching,
 * request budget, resumability and columns (`results_status`,
 * `results_judges`, `results_squirrels`, `results_checked_at`;
 * `results_tournament_id` holds the Tabroom tournament id here). The lookup is
 * `@debate-ai/videos-admin/src/lib/hs-results.ts`, the same one behind the
 * edit dialog's "Look up results" for high school rounds. Requests are signed
 * in as the site's Tabroom account (`TABROOM_API_KEY`) via `tabroomFetch`.
 * @module lib/videos/fill-hs-results
 */

import { lookupHsResult } from "@debate-ai/videos-admin/src/lib/hs-results";
import { tabroomFetch } from "@/lib/judge-paradigms/tabroom";
import {
  eligibleRounds,
  fillRoundResults,
  listResultRows,
  type CollegeResultListRow,
  type FillCollegeResultsOptions,
  type FillCollegeResultsResult,
  type ResultsSource,
} from "./fill-college-results";

export { UNSETTLED_STATUSES } from "./fill-college-results";

/** High school Policy (1), PF (2) and LD (3) rounds. */
const HS_ELIGIBLE = eligibleRounds([1, 2, 3]);

/** Requests to Tabroom per call: a season's tournament list alone is several pages. */
export const HS_MAX_REQUESTS = 45;

export const HS_RESULTS_SOURCE: ResultsSource = {
  eligible: HS_ELIGIBLE,
  lookup: (row, fetcher) =>
    lookupHsResult(
      {
        style: row.style ?? "",
        tournament: row.tournament,
        roundLevel: row.roundLevel,
        affTeam: row.affTeam,
        negTeam: row.negTeam,
        seasonYear: row.seasonYear,
        publishedAt: row.publishedAt,
      },
      fetcher,
    ),
};

/** Looks up and saves one batch of high school rounds. */
export function fillHsResults(db: unknown, options: FillCollegeResultsOptions = {}): Promise<FillCollegeResultsResult> {
  return fillRoundResults(db, HS_RESULTS_SOURCE, {
    maxRequests: HS_MAX_REQUESTS,
    ...options,
    fetchImpl: options.fetchImpl ?? tabroomFetch(),
  });
}

/** The high school rounds whose last lookup ended in one of `statuses`. */
export function listHsResultRows(
  db: unknown,
  statuses: readonly string[],
): Promise<{ rows: CollegeResultListRow[]; total: number }> {
  return listResultRows(db, HS_ELIGIBLE, statuses);
}
