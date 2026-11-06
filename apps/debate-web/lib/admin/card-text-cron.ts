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
 * `wrangler.jsonc` schedules {@link CARD_TEXT_MOVE_CRON}; the `scheduled`
 * export in `worker/index.ts` routes it here.
 * @module lib/admin/card-text-cron
 */

import { type CardTextBucket, getCardTextBucket } from "@/lib/search/card-text-store";
import { getDBFromContext } from "@/lib/database/context";
import { moveCardTextPage, moveCaselistDocHtmlPage } from "./card-text-migration";

/** Every hour at :30, off the other crons' :00. Must match wrangler.jsonc's `triggers.crons`. */
export const CARD_TEXT_MOVE_CRON = "30 * * * *";

/** R2 key of the progress cursor. Outside `cards/` and `caselist-docs/`, so it never collides with a card. */
export const CURSOR_KEY = "cron/move-text-cursor.json";

/** Cards per page — the admin route's ceiling. */
const CARD_PAGE_ROWS = 500;
/** Caselist documents per page; each can be megabytes. */
const DOC_PAGE_ROWS = 10;
/** Wall-clock budget per run, well inside a scheduled Worker's 15 minutes. */
const DEFAULT_TIME_BUDGET_MS = 10 * 60 * 1000;
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
}

export interface CardTextMoveOptions {
  now?: () => number;
  timeBudgetMs?: number;
  maxPages?: number;
  cardPageRows?: number;
  docPageRows?: number;
}

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
  const run: CardTextMoveRun = { cardsMoved: 0, docsMoved: 0, charsFreed: 0, pages: 0, cursor, outOfTime: false };

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
    const docs = cursor.stage === "caselist-docs";
    const page = docs
      ? await moveCaselistDocHtmlPage(db, bucket, cursor.afterId, docPageRows)
      : await moveCardTextPage(db, bucket, cursor.afterId, cardPageRows);
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

/** The cron entry point. Returns null (and logs) when no bucket is bound. */
export async function runHourlyCardTextMove(): Promise<CardTextMoveRun | null> {
  const bucket = getCardTextBucket();
  if (!bucket) {
    console.warn("Hourly card text move skipped: no R2 bucket bound as CARD_TEXT.");
    return null;
  }
  const run = await runCardTextMove(await getDBFromContext(), bucket);
  if (run.pages > 0) {
    console.log(
      `Hourly card text move: ${run.cardsMoved} cards and ${run.docsMoved} caselist docs moved to R2 ` +
        `(${run.charsFreed} chars freed from D1, ${run.pages} pages); ` +
        `now at ${run.cursor.stage}${run.cursor.stage === "done" ? "" : ` after id ${run.cursor.afterId}`}.`,
    );
  }
  return run;
}
