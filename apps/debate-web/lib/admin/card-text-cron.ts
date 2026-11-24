/**
 * @fileoverview The hourly cron that moves card text out of D1 into R2.
 *
 * Runs the same pages as the admin panel's "Move card text to R2" button
 * (`lib/admin/card-text-migration.ts`) without anyone having to keep the tab
 * open: first the full text and markup of cards imported before the R2 split,
 * then the HTML of the caselist speech documents card search lists as
 * Outlines. Each run moves pages until its time budget is spent, then stops.
 *
 * Where it got to is kept in the `CARD_TEXT` bucket itself, at
 * {@link CURSOR_KEY}, so the next run carries on from the last moved id
 * instead of rescanning rows that are already empty. Losing the cursor costs
 * nothing but a rescan: the page queries skip moved rows either way. Once
 * both stages are done the cron idles, and once a day it starts over from the
 * beginning to pick up any stragglers.
 *
 * After the move, the same run spends what is left of its budget indexing the
 * body text of moved cards into the body search index
 * (`lib/search/card-body-fts.ts`), reading it back from R2, for cards moved
 * before that index existed. It keeps its own cursor at
 * {@link BODY_INDEX_CURSOR_KEY} and, once done, stays idle (delete that object
 * to run it again).
 *
 * The run shares one D1 database with every live request, so it is throttled
 * on purpose: small pages, a pause after each page so user reads get the
 * database in between, a short budget, and it gives up for the hour the
 * moment D1 reports it is overloaded. Running pages back to back for ten
 * minutes overloaded D1 every hour at :30, and every signed-in page (settings,
 * contacts, tool records, the session) answered 500/503 until it ended.
 *
 * `wrangler.jsonc` schedules {@link CARD_TEXT_MOVE_CRON}; the `scheduled`
 * export in `worker/index.ts` routes it here.
 * @module lib/admin/card-text-cron
 */

import { type CardTextBucket, getCardTextBucket } from "@/lib/search/card-text-store";
import { getDBFromContext } from "@/lib/database/context";
import { moveCardTextPage, moveCaselistDocHtmlPage } from "./card-text-migration";
import { backfillCardBodyIndexPage } from "@/lib/search/card-body-fts";
import { isD1Overloaded } from "@/lib/database/errors";

/** Every hour at :30, off the other crons' :00. Must match wrangler.jsonc's `triggers.crons`. */
export const CARD_TEXT_MOVE_CRON = "30 * * * *";

/** R2 key of the progress cursor. Outside `cards/` and `caselist-docs/`, so it never collides with a card. */
export const CURSOR_KEY = "cron/move-text-cursor.json";

/** R2 key of the body-index backfill cursor. */
export const BODY_INDEX_CURSOR_KEY = "cron/body-index-cursor.json";

/** Cards per body-index page; each is one R2 read. */
const BODY_PAGE_ROWS = 100;

/**
 * Cards per page. Each moved card rewrites its row and both FTS indexes, so a
 * 500-card page (the admin route's ceiling) was enough on its own to push D1
 * into "overloaded" for everyone else.
 */
const CARD_PAGE_ROWS = 100;
/** Caselist documents per page; each can be megabytes. */
const DOC_PAGE_ROWS = 10;
/** Wall-clock budget per run, pauses included. */
const DEFAULT_TIME_BUDGET_MS = 4 * 60 * 1000;
/**
 * Idle time after each page of the hourly run, so live requests queued behind
 * the cron's writes drain before the next page. The cron entry point passes
 * it; direct callers (tests, the admin button) default to no pause.
 */
export const CRON_PAGE_PAUSE_MS = 3000;
/** Hard cap on pages per run, in case the clock never runs out (tests, tiny pages). */
const DEFAULT_MAX_PAGES = 1000;
/** After finishing, how long to idle before rescanning from the start. */
const RESCAN_AFTER_MS = 24 * 60 * 60 * 1000;

type Stage = "cards" | "caselist-docs" | "done";

/** What is stored at {@link CURSOR_KEY}. */
export interface CardTextMoveCursor {
  stage: Stage;
  /** Last id moved (or skipped past) in the current stage. */
  afterId: number;
  /** When the last stage finished; set only while `stage` is `"done"`. */
  finishedAt?: string;
  updatedAt: string;
}

/** What one cron run did. */
export interface CardTextMoveRun {
  cardsMoved: number;
  docsMoved: number;
  charsFreed: number;
  pages: number;
  cursor: CardTextMoveCursor;
  /** True when the run stopped on its time budget or page cap with work left. */
  outOfTime: boolean;
  /** True when the run stopped early because D1 said it was overloaded. */
  overloaded: boolean;
}

export interface CardTextMoveOptions {
  now?: () => number;
  timeBudgetMs?: number;
  maxPages?: number;
  cardPageRows?: number;
  docPageRows?: number;
  /** Idle time after each page; 0 (the default) for none. */
  pauseMs?: number;
  /** How to wait `pauseMs`; injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function startCursor(now: number): CardTextMoveCursor {
  return { stage: "cards", afterId: 0, updatedAt: new Date(now).toISOString() };
}

/** Reads the stored cursor, or a fresh one when it is missing or unreadable. */
export async function readMoveCursor(bucket: CardTextBucket, now: number): Promise<CardTextMoveCursor> {
  try {
    const object = await bucket.get(CURSOR_KEY);
    if (!object) return startCursor(now);
    const parsed = JSON.parse(await object.text()) as Partial<CardTextMoveCursor>;
    const stage: Stage =
      parsed.stage === "caselist-docs" || parsed.stage === "done" ? parsed.stage : "cards";
    const afterId = Math.max(0, Math.trunc(Number(parsed.afterId) || 0));
    return {
      stage,
      afterId,
      finishedAt: typeof parsed.finishedAt === "string" ? parsed.finishedAt : undefined,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(now).toISOString(),
    };
  } catch (error) {
    console.error("card-text-cron: unreadable cursor, starting over", error);
    return startCursor(now);
  }
}

async function writeMoveCursor(bucket: CardTextBucket, cursor: CardTextMoveCursor): Promise<void> {
  await bucket.put(CURSOR_KEY, JSON.stringify(cursor), { httpMetadata: { contentType: "application/json" } });
}

/**
 * Moves card text and caselist document HTML from D1 to R2 until the time
 * budget runs out, saving the cursor after every page.
 *
 * @param db - Drizzle database handle.
 * @param bucket - The `CARD_TEXT` bucket.
 */
export async function runCardTextMove(
  db: any,
  bucket: CardTextBucket,
  options: CardTextMoveOptions = {},
): Promise<CardTextMoveRun> {
  const now = options.now ?? Date.now;
  const started = now();
  const timeBudgetMs = options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const cardPageRows = options.cardPageRows ?? CARD_PAGE_ROWS;
  const docPageRows = options.docPageRows ?? DOC_PAGE_ROWS;

  let cursor = await readMoveCursor(bucket, started);
  const pauseMs = Math.max(0, options.pauseMs ?? 0);
  const sleep = options.sleep ?? realSleep;
  const run: CardTextMoveRun = {
    cardsMoved: 0,
    docsMoved: 0,
    charsFreed: 0,
    pages: 0,
    cursor,
    outOfTime: false,
    overloaded: false,
  };

  if (cursor.stage === "done") {
    const finished = cursor.finishedAt ? Date.parse(cursor.finishedAt) : NaN;
    if (Number.isFinite(finished) && started - finished < RESCAN_AFTER_MS) return run;
    cursor = startCursor(started);
  }

  while (cursor.stage !== "done") {
    if (run.pages >= maxPages || now() - started >= timeBudgetMs) {
      run.outOfTime = true;
      break;
    }
    if (run.pages > 0 && pauseMs > 0) await sleep(pauseMs);
    const docs = cursor.stage === "caselist-docs";
    let page;
    try {
      page = docs
        ? await moveCaselistDocHtmlPage(db, bucket, cursor.afterId, docPageRows)
        : await moveCardTextPage(db, bucket, cursor.afterId, cardPageRows);
    } catch (error) {
      // Overload wants fewer statements, not a retry: leave D1 to live
      // traffic and pick the page up next hour from the saved cursor.
      if (!isD1Overloaded(error)) throw error;
      console.warn("card-text-cron: D1 overloaded, stopping until the next run");
      run.overloaded = true;
      break;
    }
    run.pages += 1;
    run.charsFreed += page.charsFreed;
    if (docs) run.docsMoved += page.moved;
    else run.cardsMoved += page.moved;

    const updatedAt = new Date(now()).toISOString();
    if (!page.done) cursor = { stage: cursor.stage, afterId: page.nextAfterId, updatedAt };
    else if (!docs) cursor = { stage: "caselist-docs", afterId: 0, updatedAt };
    else cursor = { stage: "done", afterId: 0, finishedAt: updatedAt, updatedAt };
    await writeMoveCursor(bucket, cursor);
  }

  run.cursor = cursor;
  return run;
}

/** What is stored at {@link BODY_INDEX_CURSOR_KEY}. */
export interface CardBodyIndexCursor {
  afterId: number;
  done: boolean;
  /** When the backfill last reached the end. */
  finishedAt?: string;
  updatedAt: string;
}

/** What one body-index backfill run did. */
export interface CardBodyIndexRun {
  indexed: number;
  pages: number;
  cursor: CardBodyIndexCursor;
  outOfTime: boolean;
  /** True when the run stopped early because D1 said it was overloaded. */
  overloaded: boolean;
}

async function readBodyCursor(bucket: CardTextBucket, now: number): Promise<CardBodyIndexCursor> {
  const fresh = { afterId: 0, done: false, updatedAt: new Date(now).toISOString() };
  try {
    const object = await bucket.get(BODY_INDEX_CURSOR_KEY);
    if (!object) return fresh;
    const parsed = JSON.parse(await object.text()) as Partial<CardBodyIndexCursor>;
    return {
      afterId: Math.max(0, Math.trunc(Number(parsed.afterId) || 0)),
      done: parsed.done === true,
      finishedAt: typeof parsed.finishedAt === "string" ? parsed.finishedAt : undefined,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : fresh.updatedAt,
    };
  } catch (error) {
    console.error("card-text-cron: unreadable body-index cursor, starting over", error);
    return fresh;
  }
}

/**
 * Indexes the R2-held body text of moved cards until the time budget runs
 * out, saving the cursor after every page. Once it reaches the end it stays
 * idle.
 */
export async function runCardBodyIndexBackfill(
  db: any,
  bucket: CardTextBucket,
  options: {
    now?: () => number;
    timeBudgetMs?: number;
    maxPages?: number;
    pageRows?: number;
    pauseMs?: number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<CardBodyIndexRun> {
  const now = options.now ?? Date.now;
  const started = now();
  const timeBudgetMs = options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const pageRows = options.pageRows ?? BODY_PAGE_ROWS;

  let cursor = await readBodyCursor(bucket, started);
  const pauseMs = Math.max(0, options.pauseMs ?? 0);
  const sleep = options.sleep ?? realSleep;
  const run: CardBodyIndexRun = { indexed: 0, pages: 0, cursor, outOfTime: false, overloaded: false };
  // Cards imported or moved later are indexed as they go, so once the
  // backfill reaches the end it stays done; a rescan would re-read every
  // card from R2. Delete the cursor object to force one.
  if (cursor.done) return run;

  while (!cursor.done) {
    if (run.pages >= maxPages || now() - started >= timeBudgetMs) {
      run.outOfTime = true;
      break;
    }
    if (run.pages > 0 && pauseMs > 0) await sleep(pauseMs);
    let page;
    try {
      page = await backfillCardBodyIndexPage(db, bucket, cursor.afterId, pageRows);
    } catch (error) {
      if (!isD1Overloaded(error)) throw error;
      console.warn("card-text-cron: D1 overloaded during body indexing, stopping until the next run");
      run.overloaded = true;
      break;
    }
    run.pages += 1;
    run.indexed += page.indexed;
    const updatedAt = new Date(now()).toISOString();
    cursor = page.done
      ? { afterId: 0, done: true, finishedAt: updatedAt, updatedAt }
      : { afterId: page.nextAfterId, done: false, updatedAt };
    await bucket.put(BODY_INDEX_CURSOR_KEY, JSON.stringify(cursor), { httpMetadata: { contentType: "application/json" } });
  }
  run.cursor = cursor;
  return run;
}

/** The cron entry point. Returns null (and logs) when no bucket is bound. */
export async function runHourlyCardTextMove(): Promise<CardTextMoveRun | null> {
  const bucket = getCardTextBucket();
  if (!bucket) {
    console.warn("Hourly card text move skipped: no R2 bucket bound as CARD_TEXT.");
    return null;
  }
  const db = await getDBFromContext();
  const started = Date.now();
  const run = await runCardTextMove(db, bucket, { pauseMs: CRON_PAGE_PAUSE_MS });
  const left = DEFAULT_TIME_BUDGET_MS - (Date.now() - started);
  // After an overload, leave D1 alone for the rest of the hour.
  if (left > 0 && !run.overloaded) {
    try {
      const body = await runCardBodyIndexBackfill(db, bucket, { timeBudgetMs: left, pauseMs: CRON_PAGE_PAUSE_MS });
      if (body.pages > 0) {
        console.log(
          `Hourly card body index: ${body.indexed} cards indexed from R2 (${body.pages} pages); ` +
            (body.cursor.done ? "done." : `now after id ${body.cursor.afterId}.`),
        );
      }
    } catch (error) {
      console.error("Hourly card body index failed:", error);
    }
  }
  if (run.pages > 0) {
    console.log(
      `Hourly card text move: ${run.cardsMoved} cards and ${run.docsMoved} caselist docs moved to R2 ` +
        `(${run.charsFreed} chars freed from D1, ${run.pages} pages); ` +
        `now at ${run.cursor.stage}${run.cursor.stage === "done" ? "" : ` after id ${run.cursor.afterId}`}.`,
    );
  }
  return run;
}
