/**
 * @fileoverview Looks every high-school round up on Tabroom and saves what it
 * finds: the winner and ballot count when the video lacks them, the judges,
 * and which judges squirreled (sat in the minority).
 *
 * Mirrors {@link ./fill-college-results.ts}: one small batch per call so a
 * Worker stays inside its subrequest budget; the admin card calls it until
 * `remaining` is 0. The lookup itself is
 * `@debate-ai/videos-admin/src/lib/tabroom-results.ts` — the same one behind
 * the edit dialog's "Look up results" for Policy / PF / LD / Parliamentary.
 *
 * Resumable via `results_checked_at` / `since`, same columns as the college
 * fill (a video is either college or HS by `style`, so the columns don't collide).
 * @module lib/videos/fill-tabroom-results
 */

import { sql } from "drizzle-orm";
import {
  RequestBudgetExceeded,
  createBudgetedFetcher,
  lookupTabroomResult,
  planTabroomResultUpdate,
  type TabroomResultUpdate,
} from "@debate-ai/videos-admin/src/lib/tabroom-results";
import { sqlLiteral } from "@debate-ai/videos-admin/src/sync/videos/video-seed-sql";
import { ensureTableColumns } from "@/lib/database/ensure-columns";
import { chunkStatements } from "@/lib/database/query-budget";
import { videos } from "@/lib/database/schema";
import { collegeResultUpdateSql } from "./fill-college-results";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Rows per call. Most share a tournament, so a batch costs a few dozen requests. */
export const DEFAULT_BATCH_SIZE = 10;
/** Requests to Tabroom per call — under a Worker's subrequest limit. */
export const DEFAULT_MAX_REQUESTS = 40;
/** Gap between requests, to stay polite to Tabroom. */
export const DEFAULT_REQUEST_DELAY_MS = 150;

/**
 * High-school debate rounds with a tournament and both teams: Policy (1),
 * PF (2), LD (3), Parliamentary (8).
 */
const ELIGIBLE = `"style" IN (1, 2, 3, 8) AND "source" = 'round' AND "tournament" IS NOT NULL AND "tournament" != '' AND "aff_team" IS NOT NULL AND "aff_team" != '' AND "neg_team" IS NOT NULL AND "neg_team" != ''`;

export interface FillTabroomResultsOptions {
  /** Unix seconds; rows checked at or after it are done. 0 = only never-checked rows. */
  since?: number;
  batchSize?: number;
  maxRequests?: number;
  requestDelayMs?: number;
  fetchImpl?: typeof fetch;
  /** Unix seconds to stamp as the check time (tests). */
  now?: number;
}

export interface FillTabroomResultsResult {
  checked: number;
  statuses: Record<string, number>;
  winnersFilled: number;
  decisionsFilled: number;
  remaining: number;
  total: number;
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
  style: number | null;
  affWin: number | boolean | null;
  judgeDecision: string | null;
}

const rowsOf = (result: unknown): Record<string, unknown>[] =>
  (Array.isArray(result) ? result : ((result as { results?: unknown[] })?.results ?? [])) as Record<string, unknown>[];

async function count(db: Db, where: string): Promise<number> {
  const rows = rowsOf(await db.all(sql.raw(`SELECT COUNT(*) AS n FROM "videos" WHERE ${where}`)));
  return Number(rows[0]?.n ?? 0);
}

/** The UPDATE for one row — same columns as the college fill. */
export function tabroomResultUpdateSql(videoId: string, update: TabroomResultUpdate, checkedAt: number): string {
  return collegeResultUpdateSql(videoId, update, checkedAt);
}

/** Looks up and saves one batch of high-school rounds. */
export async function fillTabroomResults(db: Db, options: FillTabroomResultsOptions = {}): Promise<FillTabroomResultsResult> {
  await ensureTableColumns(db, videos);
  const since = Math.max(0, Math.floor(options.since ?? 0));
  const pending = `${ELIGIBLE} AND ("results_checked_at" IS NULL OR "results_checked_at" < ${since})`;
  const batchSize = Math.min(Math.max(1, options.batchSize ?? DEFAULT_BATCH_SIZE), 50);

  const rows = rowsOf(
    await db.all(
      sql.raw(
        `SELECT "video_id" AS videoId, "tournament", "round_level" AS roundLevel, "aff_team" AS affTeam, "neg_team" AS negTeam, "season_year" AS seasonYear, "published_at" AS publishedAt, "style", "aff_win" AS affWin, "judge_decision" AS judgeDecision FROM "videos" WHERE ${pending} ORDER BY "season_year" DESC, "tournament", "video_id" LIMIT ${batchSize}`,
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
    let update: TabroomResultUpdate;
    try {
      const lookup = await lookupTabroomResult(
        {
          tournament: row.tournament,
          roundLevel: row.roundLevel,
          affTeam: row.affTeam,
          negTeam: row.negTeam,
          seasonYear: row.seasonYear,
          publishedAt: row.publishedAt,
          style: row.style,
        },
        fetcher,
      );
      const affWin = row.affWin === null || row.affWin === undefined ? null : Boolean(row.affWin);
      update = planTabroomResultUpdate({ affWin, judgeDecision: row.judgeDecision }, lookup);
    } catch (error) {
      if (error instanceof RequestBudgetExceeded && statements.length > 0) break;
      update = { status: "error", judges: null, squirrels: null, tournamentId: null };
    }
    statuses[update.status] = (statuses[update.status] ?? 0) + 1;
    if (update.affWin !== undefined) winnersFilled++;
    if (update.judgeDecision !== undefined) decisionsFilled++;
    statements.push(tabroomResultUpdateSql(row.videoId, update, checkedAt));
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

export const UNSETTLED_STATUSES = ["not_found", "ambiguous", "error", "conflict", "winner_not_explicit"] as const;

export type UnsettledStatus = (typeof UNSETTLED_STATUSES)[number];

export interface TabroomResultListRow {
  videoId: string;
  title: string;
  tournament: string | null;
  roundLevel: string | null;
  affTeam: string | null;
  negTeam: string | null;
  seasonYear: number | null;
  style: number | null;
  status: string;
  checkedAt: number | null;
}

export const MAX_LISTED_ROWS = 500;

/** The HS rounds whose last lookup ended in one of `statuses`, newest season first. */
export async function listTabroomResultRows(
  db: Db,
  statuses: readonly string[],
): Promise<{ rows: TabroomResultListRow[]; total: number }> {
  await ensureTableColumns(db, videos);
  const wanted = statuses.filter((status): status is UnsettledStatus => (UNSETTLED_STATUSES as readonly string[]).includes(status));
  if (wanted.length === 0) return { rows: [], total: 0 };
  const where = `${ELIGIBLE} AND "results_status" IN (${wanted.map((status) => sqlLiteral(status)).join(", ")})`;
  const [rows, total] = await Promise.all([
    db.all(
      sql.raw(
        `SELECT "video_id" AS videoId, "title", "tournament", "round_level" AS roundLevel, "aff_team" AS affTeam, "neg_team" AS negTeam, "season_year" AS seasonYear, "style", "results_status" AS status, "results_checked_at" AS checkedAt FROM "videos" WHERE ${where} ORDER BY "season_year" DESC, "tournament", "round_level", "video_id" LIMIT ${MAX_LISTED_ROWS}`,
      ),
    ),
    count(db, where),
  ]);
  return { rows: rowsOf(rows) as unknown as TabroomResultListRow[], total };
}
