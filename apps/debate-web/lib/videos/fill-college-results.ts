/**
 * @fileoverview Looks every college round up on College Debate Results and
 * saves what it finds: the winner and ballot count when the video lacks them,
 * the judges, and which judges squirreled (sat in the minority).
 *
 * Runs one small batch per call so a Worker invocation stays inside its
 * subrequest and D1 budgets; the admin card calls it until `remaining` is 0.
 * The lookup itself is `@debate-ai/videos-admin/src/lib/college-results.ts`
 * — the same one behind the edit dialog's "Look up results" — and keeps its
 * rules: a winner only from the site's explicit decision, ambiguous
 * tournaments and pairings skipped. A saved winner the site contradicts is
 * never overwritten; the row is marked `conflict` instead.
 *
 * Resumable: a row counts as done once `results_checked_at` is at or after
 * the run's `since`. `since = 0` finishes rows never checked; a "recheck
 * all" run passes its own start time.
 * @module lib/videos/fill-college-results
 */

import { sql } from "drizzle-orm";
import {
  RequestBudgetExceeded,
  createBudgetedFetcher,
  lookupCollegeResult,
  planCollegeResultUpdate,
  type CollegeResultUpdate,
} from "@debate-ai/videos-admin/src/lib/college-results";
import { sqlLiteral } from "@debate-ai/videos-admin/src/sync/videos/video-seed-sql";
import { ensureTableColumns } from "@/lib/database/ensure-columns";
import { chunkStatements } from "@/lib/database/query-budget";
import { videos } from "@/lib/database/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Rows per call. Most share a tournament, so a batch costs a few dozen requests. */
export const DEFAULT_BATCH_SIZE = 10;
/** Requests to College Debate Results per call — well under a Worker's subrequest limit. */
export const DEFAULT_MAX_REQUESTS = 40;
/** Gap between requests, to stay polite to the results site. */
export const DEFAULT_REQUEST_DELAY_MS = 150;

/** Only these rows are looked up: college rounds with a tournament and both teams. */
const ELIGIBLE = `"style" = 4 AND "source" = 'round' AND "tournament" IS NOT NULL AND "tournament" != '' AND "aff_team" IS NOT NULL AND "aff_team" != '' AND "neg_team" IS NOT NULL AND "neg_team" != ''`;

export interface FillCollegeResultsOptions {
  /** Unix seconds; rows checked at or after it are done. 0 = only never-checked rows. */
  since?: number;
  batchSize?: number;
  maxRequests?: number;
  requestDelayMs?: number;
  fetchImpl?: typeof fetch;
  /** Unix seconds to stamp as the check time (tests). */
  now?: number;
}

export interface FillCollegeResultsResult {
  /** Rows looked up this call. */
  checked: number;
  /** Outcome counts for this call, e.g. `{ verified: 7, not_found: 2 }`. */
  statuses: Record<string, number>;
  /** Rows given a winner they lacked. */
  winnersFilled: number;
  /** Rows given a ballot count they lacked. */
  decisionsFilled: number;
  /** Eligible rows still to check after this call. */
  remaining: number;
  /** Eligible college rounds in all. */
  total: number;
  /** Requests made to College Debate Results. */
  requests: number;
}

interface Row {
  videoId: string;
  tournament: string;
  roundLevel: string | null;
  affTeam: string;
  negTeam: string;
  seasonYear: number | null;
  publishedAt: string | null;
  affWin: number | boolean | null;
  judgeDecision: string | null;
}

const rowsOf = (result: unknown): Record<string, unknown>[] =>
  (Array.isArray(result) ? result : ((result as { results?: unknown[] })?.results ?? [])) as Record<string, unknown>[];

async function count(db: Db, where: string): Promise<number> {
  const rows = rowsOf(await db.all(sql.raw(`SELECT COUNT(*) AS n FROM "videos" WHERE ${where}`)));
  return Number(rows[0]?.n ?? 0);
}

/** The UPDATE for one row; `updated_at` moves so clients holding the index refetch it. */
export function collegeResultUpdateSql(videoId: string, update: CollegeResultUpdate, checkedAt: number): string {
  const sets = [
    `"results_status" = ${sqlLiteral(update.status)}`,
    `"results_judges" = ${sqlLiteral(update.judges)}`,
    `"results_squirrels" = ${sqlLiteral(update.squirrels)}`,
    `"results_tournament_id" = ${update.tournamentId ?? "NULL"}`,
    `"results_checked_at" = ${checkedAt}`,
  ];
  const fillsRound = update.affWin !== undefined || update.judgeDecision !== undefined;
  if (update.affWin !== undefined) sets.push(`"aff_win" = ${update.affWin ? 1 : 0}`);
  if (update.judgeDecision !== undefined) sets.push(`"judge_decision" = ${sqlLiteral(update.judgeDecision)}`);
  // A filled winner or decision is a correction the JSON re-seed must keep.
  if (fillsRound) sets.push(`"admin_edited" = 1`, `"updated_at" = unixepoch()`);
  return `UPDATE "videos" SET ${sets.join(", ")} WHERE "video_id" = ${sqlLiteral(videoId)}`;
}

/** Looks up and saves one batch of college rounds. */
export async function fillCollegeResults(db: Db, options: FillCollegeResultsOptions = {}): Promise<FillCollegeResultsResult> {
  await ensureTableColumns(db, videos);
  const since = Math.max(0, Math.floor(options.since ?? 0));
  const pending = `${ELIGIBLE} AND ("results_checked_at" IS NULL OR "results_checked_at" < ${since})`;
  const batchSize = Math.min(Math.max(1, options.batchSize ?? DEFAULT_BATCH_SIZE), 50);

  // Grouped by season and tournament so a batch's rounds share cached requests.
  const rows = rowsOf(
    await db.all(
      sql.raw(
        `SELECT "video_id" AS videoId, "tournament", "round_level" AS roundLevel, "aff_team" AS affTeam, "neg_team" AS negTeam, "season_year" AS seasonYear, "published_at" AS publishedAt, "aff_win" AS affWin, "judge_decision" AS judgeDecision FROM "videos" WHERE ${pending} ORDER BY "season_year" DESC, "tournament", "video_id" LIMIT ${batchSize}`,
      ),
    ),
  ) as unknown as Row[];

  const fetcher = createBudgetedFetcher(options.fetchImpl ?? fetch, {
    maxRequests: options.maxRequests ?? DEFAULT_MAX_REQUESTS,
    delayMs: options.requestDelayMs ?? DEFAULT_REQUEST_DELAY_MS,
  });
  const checkedAt = options.now ?? Math.floor(Date.now() / 1000);
  const statuses: Record<string, number> = {};
  const statements: string[] = [];
  let winnersFilled = 0;
  let decisionsFilled = 0;

  for (const row of rows) {
    let update: CollegeResultUpdate;
    try {
      const lookup = await lookupCollegeResult(
        {
          tournament: row.tournament,
          roundLevel: row.roundLevel,
          affTeam: row.affTeam,
          negTeam: row.negTeam,
          seasonYear: row.seasonYear,
          publishedAt: row.publishedAt,
        },
        fetcher,
      );
      const affWin = row.affWin === null || row.affWin === undefined ? null : Boolean(row.affWin);
      update = planCollegeResultUpdate({ affWin, judgeDecision: row.judgeDecision }, lookup);
    } catch (error) {
      // Out of requests: leave this row and the rest for the next call —
      // unless it is the first, which alone outgrew a call's budget.
      if (error instanceof RequestBudgetExceeded && statements.length > 0) break;
      update = { status: "error", judges: null, squirrels: null, tournamentId: null };
    }
    statuses[update.status] = (statuses[update.status] ?? 0) + 1;
    if (update.affWin !== undefined) winnersFilled++;
    if (update.judgeDecision !== undefined) decisionsFilled++;
    statements.push(collegeResultUpdateSql(row.videoId, update, checkedAt));
  }

  for (const batch of chunkStatements(statements)) await db.batch(batch.map((statement) => db.run(sql.raw(statement))));

  const [remaining, total] = await Promise.all([count(db, pending), count(db, ELIGIBLE)]);
  return {
    checked: statements.length,
    statuses,
    winnersFilled,
    decisionsFilled,
    remaining,
    total,
    requests: fetcher.requests(),
  };
}

/** Outcomes {@link listCollegeResultRows} can list: the rounds a run couldn't settle. */
export const UNSETTLED_STATUSES = ["not_found", "ambiguous", "error", "conflict", "winner_not_explicit"] as const;

export type UnsettledStatus = (typeof UNSETTLED_STATUSES)[number];

/** A looked-up college round, for the admin card's "not found" list. */
export interface CollegeResultListRow {
  videoId: string;
  title: string;
  tournament: string | null;
  roundLevel: string | null;
  affTeam: string | null;
  negTeam: string | null;
  seasonYear: number | null;
  status: string;
  checkedAt: number | null;
}

/** Most rounds listed at once; the card says when there are more. */
export const MAX_LISTED_ROWS = 500;

/** The college rounds whose last lookup ended in one of `statuses`, newest season first. */
export async function listCollegeResultRows(
  db: Db,
  statuses: readonly string[],
): Promise<{ rows: CollegeResultListRow[]; total: number }> {
  await ensureTableColumns(db, videos);
  const wanted = statuses.filter((status): status is UnsettledStatus => (UNSETTLED_STATUSES as readonly string[]).includes(status));
  if (wanted.length === 0) return { rows: [], total: 0 };
  const where = `${ELIGIBLE} AND "results_status" IN (${wanted.map((status) => sqlLiteral(status)).join(", ")})`;
  const [rows, total] = await Promise.all([
    db.all(
      sql.raw(
        `SELECT "video_id" AS videoId, "title", "tournament", "round_level" AS roundLevel, "aff_team" AS affTeam, "neg_team" AS negTeam, "season_year" AS seasonYear, "results_status" AS status, "results_checked_at" AS checkedAt FROM "videos" WHERE ${where} ORDER BY "season_year" DESC, "tournament", "round_level", "video_id" LIMIT ${MAX_LISTED_ROWS}`,
      ),
    ),
    count(db, where),
  ]);
  return { rows: rowsOf(rows) as unknown as CollegeResultListRow[], total };
}
