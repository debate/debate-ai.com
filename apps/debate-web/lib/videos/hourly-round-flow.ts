/**
 * @fileoverview The hourly round flow job: once an hour, the newest round
 * that has no flow chart yet gets its last four speeches' LLM summaries and
 * its whole-round flow chart (the watch page's "Flow chart" mind map),
 * generated with the site's shared AI key and saved for every viewer.
 *
 * The per-round work is `precomputeRoundFlow` in `@debate-ai/videos`
 * (`lib/round-flow-precompute.ts`). This file does the I/O: it picks the
 * round (newest upload first, {@link ROUND_FLOW_ORDER}), calls the model, saves
 * through the shared store (`video_ai_results`) first-come, and records each
 * attempt in `video_round_flow_runs` so the admin panel can show progress and
 * a round that was just attempted (failed, or had nothing to work on) is not picked again for
 * {@link RETRY_AFTER_SECONDS}. A pause switch lives in `video_round_flow_state`.
 * Both tables are created on first use, since the app ships no migrations.
 *
 * `wrangler.jsonc` schedules {@link ROUND_FLOW_CRON}; the `scheduled` export
 * in `worker/index.ts` routes it here. The admin panel's "Run next now" calls
 * {@link runRoundFlowOnce} through `/api/admin/videos/round-flow`.
 * @module lib/videos/hourly-round-flow
 */

import { and, asc, count, countDistinct, desc, eq, isNotNull, sql } from "drizzle-orm";
import { isSharedVideoId, type SharedVideoAiItem } from "@debate-ai/videos/src/lib/shared-video-ai";
import { precomputeRoundFlow, type RoundFlowResult } from "@debate-ai/videos/src/lib/round-flow-precompute";
import type { PrecomputeVideo } from "@debate-ai/videos/src/lib/watch-ai-precompute";
import { videoAiResults, videos } from "@/lib/database/schema";
import { getDBFromContext } from "@/lib/database/context";
import { describeError } from "@/lib/database/errors";
import { loadSharedVideoAi, saveSharedVideoAi } from "@/lib/video-ai-results/queries";
import { getVideoDocuments } from "@/lib/videos/video-content";
import { callModel, sharedProviderKey } from "@/lib/videos/transcript-scraper";
import { loadCaptions } from "@/lib/videos/speech-analysis";
import type { ProviderKey } from "@/lib/ai/provider-key";

/** Every hour at :15, off the other crons. Must match wrangler.jsonc's `triggers.crons`. */
export const ROUND_FLOW_CRON = "15 * * * *";

/**
 * A round attempted this recently is left alone: one that failed or had no
 * captions is tried again after this long (a finished one has its chart, so
 * it only comes back if that chart is deleted).
 */
export const RETRY_AFTER_SECONDS = 7 * 24 * 60 * 60;

/** Rounds looked at per run; one with nothing to work on costs no model call. */
export const ROUND_FLOW_SCAN_ROWS = 10;

/** Attempts the admin panel lists. */
export const RECENT_RUNS = 20;

/** Newest upload first; the id breaks ties. */
export const ROUND_FLOW_ORDER = [desc(videos.publishedMs), asc(videos.videoId)];

/** Idempotent DDL for the job's two bookkeeping tables. */
export const ROUND_FLOW_DDL = [
  `CREATE TABLE IF NOT EXISTS "video_round_flow_runs" (
  "video_id" text PRIMARY KEY NOT NULL,
  "title" text DEFAULT '' NOT NULL,
  "status" text NOT NULL,
  "detail" text DEFAULT '{}' NOT NULL,
  "trigger" text DEFAULT 'cron' NOT NULL,
  "ran_at" integer NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS "idx_video_round_flow_runs_ran_at" ON "video_round_flow_runs" ("ran_at")`,
  `CREATE TABLE IF NOT EXISTS "video_round_flow_state" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL
)`,
];

type RawDB = {
  run(query: unknown): Promise<unknown>;
  all(query: unknown): Promise<unknown[]>;
};

const ensured = new WeakMap<object, Promise<void>>();

/** Creates the bookkeeping tables once per database handle; a failure is forgotten and retried. */
export function ensureRoundFlowTables(db: unknown): Promise<void> {
  const handle = db as object;
  let pending = ensured.get(handle);
  if (!pending) {
    pending = (async () => {
      for (const statement of ROUND_FLOW_DDL) await (db as RawDB).run(sql.raw(statement));
    })();
    ensured.set(handle, pending);
    pending.catch(() => ensured.delete(handle));
  }
  return pending;
}

export type RoundFlowTrigger = "cron" | "admin";

/** One recorded attempt, as the panel lists it. */
export interface RoundFlowRun extends RoundFlowResult {
  videoId: string;
  title: string;
  trigger: RoundFlowTrigger;
  /** Unix seconds. */
  ranAt: number;
}

/** The panel's status. */
export interface RoundFlowStats {
  /** Rounds (not lectures) in the library. */
  rounds: number;
  /** Rounds holding a shared flow chart. */
  withFlowChart: number;
  paused: boolean;
  /** The round the next run would start with, if any. */
  next: { videoId: string; title: string } | null;
  recent: RoundFlowRun[];
  schedule: string;
}

/** What one run did. */
export interface RoundFlowRunResult {
  /** Every round attempted, in order; at most one ran the model to completion. */
  runs: RoundFlowRun[];
  /** Set when the run did nothing because the job is paused or has no key. */
  idle?: "paused" | "no-key" | "no-rounds";
}

const COLUMNS = {
  videoId: videos.videoId,
  title: videos.title,
  style: videos.style,
  tournament: videos.tournament,
  roundLevel: videos.roundLevel,
  affTeam: videos.affTeam,
  negTeam: videos.negTeam,
  judgeDecision: videos.judgeDecision,
};

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Rounds still missing a flow chart and not attempted recently, newest first. */
export async function nextRoundFlowCandidates(db: any, limit: number, now = nowSeconds()): Promise<PrecomputeVideo[]> {
  const retryCutoff = now - RETRY_AFTER_SECONDS;
  return db
    .select(COLUMNS)
    .from(videos)
    .where(
      and(
        isNotNull(videos.style),
        sql`NOT EXISTS (SELECT 1 FROM "video_ai_results" r WHERE r."video_id" = ${videos.videoId} AND r."kind" = 'flowchart')`,
        sql`NOT EXISTS (SELECT 1 FROM "video_round_flow_runs" f WHERE f."video_id" = ${videos.videoId} AND f."ran_at" > ${retryCutoff})`,
      ),
    )
    .orderBy(...ROUND_FLOW_ORDER)
    .limit(limit);
}

async function readState(db: any, key: string): Promise<string | null> {
  const rows = (await (db as RawDB).all(
    sql`SELECT "value" FROM "video_round_flow_state" WHERE "key" = ${key}`,
  )) as Array<{ value: string }>;
  return rows[0]?.value ?? null;
}

/** Whether an admin paused the hourly job. */
export async function isRoundFlowPaused(db: any): Promise<boolean> {
  await ensureRoundFlowTables(db);
  return (await readState(db, "paused")) === "1";
}

/** Pauses or resumes the hourly job. */
export async function setRoundFlowPaused(db: any, paused: boolean): Promise<void> {
  await ensureRoundFlowTables(db);
  await (db as RawDB).run(
    sql`INSERT INTO "video_round_flow_state" ("key", "value") VALUES ('paused', ${paused ? "1" : "0"})
        ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value"`,
  );
}

async function recordRun(db: any, run: RoundFlowRun): Promise<void> {
  const { videoId, title, trigger, ranAt, ...result } = run;
  await (db as RawDB).run(
    sql`INSERT INTO "video_round_flow_runs" ("video_id", "title", "status", "detail", "trigger", "ran_at")
        VALUES (${videoId}, ${title}, ${result.status}, ${JSON.stringify(result)}, ${trigger}, ${ranAt})
        ON CONFLICT ("video_id") DO UPDATE SET "title" = excluded."title", "status" = excluded."status",
          "detail" = excluded."detail", "trigger" = excluded."trigger", "ran_at" = excluded."ran_at"`,
  );
}

/** Reads a stored attempt back, tolerating a detail column an older version wrote. */
export function toRoundFlowRun(row: {
  video_id: string;
  title: string;
  status: string;
  detail: string;
  trigger: string;
  ran_at: number;
}): RoundFlowRun {
  let detail: Partial<RoundFlowResult> = {};
  try {
    detail = JSON.parse(row.detail) as Partial<RoundFlowResult>;
  } catch {
    // Unreadable: keep the status line only.
  }
  const status = row.status === "done" || row.status === "skipped" ? row.status : "failed";
  return {
    videoId: row.video_id,
    title: row.title,
    trigger: row.trigger === "admin" ? "admin" : "cron",
    ranAt: Number(row.ran_at) || 0,
    status,
    reason: typeof detail.reason === "string" ? detail.reason : undefined,
    speeches: Array.isArray(detail.speeches) ? detail.speeches : [],
    detected: detail.detected === true,
    summaries: Array.isArray(detail.summaries) ? detail.summaries : [],
    flowChart: detail.flowChart === true,
    nodes: Number(detail.nodes) || 0,
    errors: Array.isArray(detail.errors) ? detail.errors : [],
  };
}

/** The admin panel's status. */
export async function getRoundFlowStats(db: any): Promise<RoundFlowStats> {
  await ensureRoundFlowTables(db);
  const [rounds] = await db.select({ rows: count() }).from(videos).where(isNotNull(videos.style));
  const [charted] = await db
    .select({ rows: countDistinct(videoAiResults.videoId) })
    .from(videoAiResults)
    .innerJoin(videos, eq(videos.videoId, videoAiResults.videoId))
    .where(and(eq(videoAiResults.kind, "flowchart"), isNotNull(videos.style)));
  const recentRows = (await (db as RawDB).all(
    sql`SELECT "video_id", "title", "status", "detail", "trigger", "ran_at" FROM "video_round_flow_runs"
        ORDER BY "ran_at" DESC LIMIT ${RECENT_RUNS}`,
  )) as Parameters<typeof toRoundFlowRun>[0][];
  const [next] = await nextRoundFlowCandidates(db, 1);
  return {
    rounds: Number(rounds?.rows ?? 0),
    withFlowChart: Number(charted?.rows ?? 0),
    paused: (await readState(db, "paused")) === "1",
    next: next ? { videoId: next.videoId, title: next.title } : null,
    recent: recentRows.map(toRoundFlowRun),
    schedule: ROUND_FLOW_CRON,
  };
}

/** Runs one round, saving each result as it lands. */
async function runRound(db: any, video: PrecomputeVideo, providerKey: ProviderKey, userId: string | null) {
  const [documents, shared] = await Promise.all([
    getVideoDocuments(video.videoId),
    loadSharedVideoAi(db, video.videoId),
  ]);
  return precomputeRoundFlow(video, documents, shared, {
    ask: (system, prompt, maxTokens) => callModel(providerKey, system, prompt, maxTokens),
    share: async (item: SharedVideoAiItem) => {
      // First-come, as a reader's own run: a result someone saved meanwhile stands.
      const saved = await saveSharedVideoAi(
        db,
        { videoId: video.videoId, replace: false, ...item },
        { userId, canReplace: false },
      );
      if (!saved) throw new Error("This video already holds as many AI results as it can.");
    },
    loadCaptions: () => loadCaptions(video.videoId),
  });
}

export interface RoundFlowOnceOptions {
  trigger: RoundFlowTrigger;
  /** The admin pressing "Run", recorded as the results' author; `null` for the cron. */
  userId?: string | null;
  /** Run just this round, whatever the order. */
  videoId?: string | null;
}

/**
 * Works through the newest rounds missing a flow chart until one is run (or
 * {@link ROUND_FLOW_SCAN_ROWS} have been looked at), recording every attempt.
 */
export async function runRoundFlowOnce(
  db: any,
  providerKey: ProviderKey,
  { trigger, userId = null, videoId = null }: RoundFlowOnceOptions,
): Promise<RoundFlowRunResult> {
  await ensureRoundFlowTables(db);
  let rows: PrecomputeVideo[];
  if (videoId) {
    rows = await db.select(COLUMNS).from(videos).where(eq(videos.videoId, videoId)).limit(1);
    if (rows.length === 0) throw new Error(`No video ${videoId} in the library.`);
  } else {
    rows = await nextRoundFlowCandidates(db, ROUND_FLOW_SCAN_ROWS);
  }
  if (rows.length === 0) return { runs: [], idle: "no-rounds" };

  const runs: RoundFlowRun[] = [];
  for (const row of rows) {
    let result: RoundFlowResult;
    if (!isSharedVideoId(row.videoId)) {
      result = { status: "skipped", reason: "Not a YouTube video.", speeches: [], detected: false, summaries: [], flowChart: false, nodes: 0, errors: [] };
    } else {
      try {
        result = await runRound(db, row, providerKey, userId);
      } catch (error) {
        const reason = describeError(error);
        result = { status: "failed", reason, speeches: [], detected: false, summaries: [], flowChart: false, nodes: 0, errors: [reason] };
      }
    }
    const run: RoundFlowRun = { videoId: row.videoId, title: row.title, trigger, ranAt: nowSeconds(), ...result };
    await recordRun(db, run);
    runs.push(run);
    // A skipped round cost nothing; anything else spent this run's model calls.
    if (result.status !== "skipped") break;
  }
  return { runs };
}

/** The cron's entry point: one round an hour, unless paused or no key is set. */
export async function runHourlyRoundFlow(): Promise<RoundFlowRunResult> {
  const db = await getDBFromContext();
  if (await isRoundFlowPaused(db)) return { runs: [], idle: "paused" };
  const providerKey = sharedProviderKey();
  if (!providerKey) {
    console.warn("[round-flow] no shared AI key (OPENROUTER_API_KEY or ANTHROPIC_API_KEY); skipping");
    return { runs: [], idle: "no-key" };
  }
  const result = await runRoundFlowOnce(db, providerKey, { trigger: "cron" });
  for (const run of result.runs) {
    console.log(`[round-flow] ${run.videoId} ${run.status}${run.reason ? `: ${run.reason}` : ""}`);
  }
  return result;
}
