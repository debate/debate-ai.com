/**
 * @fileoverview Writes the size stats (quotes, blocks, pages, characters)
 * for stored Debate Editor files into D1, and fills them in for rows saved
 * before the columns existed.
 *
 * Both `documents` (My Files) and `topic_starter_items` (Topic Starters) keep
 * `quote_count`, `block_count`, `page_count` and `char_count`. Every route
 * that writes a file's content spreads {@link fileStatColumns} into the
 * write; {@link backfillFileStats} counts the rows still at null in small
 * batches — from the admin "Count file stats" button and from the daily
 * cron — and fills `documents.author` from each owner's account name.
 *
 * The counting itself is `@debate-ai/reason-docs/lib/file-stats/file-stats`,
 * shared with the sidebar that shows the numbers.
 *
 * @module lib/file-stats/backfill
 */

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { getDBFromContext } from "@/lib/database/context";
import { documents, topicStarterItems } from "@/lib/database/schema";
import { ensureTopicStarterColumns } from "@/lib/topic-starters/changes";
import { ensureDocumentColumns, fileStatColumns } from "./columns";

type Database = Awaited<ReturnType<typeof getDBFromContext>>;

/** Rows read per batch — each carries a whole file's content. */
const BATCH = 20;

/** How one table's backfill went. */
export interface BackfillTableResult {
  updated: number;
  remaining: number;
}

/** What {@link backfillFileStats} did. */
export interface FileStatsBackfillResult {
  topicStarters: BackfillTableResult;
  documents: BackfillTableResult;
  /** Documents whose author was filled from the owner's account name. */
  authorsFilled: number;
  /** True when every file in both tables has stats. */
  done: boolean;
}

type StatTable = typeof documents | typeof topicStarterItems;

async function countMissing(db: Database, table: StatTable): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)` })
    .from(table)
    .where(and(eq(table.isFolder, false), isNull(table.charCount)));
  return Number(row?.value ?? 0);
}

async function backfillTable(db: Database, table: StatTable, deadline: number): Promise<number> {
  let updated = 0;
  // Ids that failed to write this run, so one bad row can't spin the loop.
  const skipped = new Set<number>();
  while (Date.now() < deadline) {
    const rows: Array<{ id: number; content: string; format: string }> = await db
      .select({ id: table.id, content: table.content, format: table.format })
      .from(table)
      .where(and(eq(table.isFolder, false), isNull(table.charCount)))
      .limit(BATCH + skipped.size);
    const batch = rows.filter((row) => !skipped.has(row.id)).slice(0, BATCH);
    if (batch.length === 0) break;
    for (const row of batch) {
      try {
        // `updatedAt` is left alone: counting is not an edit.
        await db.update(table).set(await fileStatColumns(row.content, row.format)).where(eq(table.id, row.id));
        updated++;
      } catch (error) {
        skipped.add(row.id);
        console.error(`[file-stats] could not count row ${row.id}`, error);
      }
      if (Date.now() >= deadline) break;
    }
  }
  return updated;
}

/** Fills `documents.author` with the owner's account name where it's empty. */
async function fillDocumentAuthors(db: Database): Promise<number> {
  const rows: Array<{ id: number }> = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(isNull(documents.author), sql`${documents.userId} IS NOT NULL`))
    .limit(5000);
  if (rows.length === 0) return 0;
  const ids = rows.map((row) => row.id);
  for (let index = 0; index < ids.length; index += 50) {
    await db
      .update(documents)
      .set({ author: sql`(SELECT "name" FROM "user" WHERE "user"."id" = ${documents.userId})` })
      .where(inArray(documents.id, ids.slice(index, index + 50)));
  }
  return ids.length;
}

/**
 * Counts stats for files that have none yet, Topic Starters first, until
 * done or `budgetMs` runs out. Safe to call repeatedly: each call picks up
 * where the last stopped.
 */
export async function backfillFileStats(db: Database, { budgetMs = 20_000 }: { budgetMs?: number } = {}): Promise<FileStatsBackfillResult> {
  await ensureTopicStarterColumns(db);
  await ensureDocumentColumns(db);
  const deadline = Date.now() + budgetMs;
  const topicUpdated = await backfillTable(db, topicStarterItems, deadline);
  const documentUpdated = await backfillTable(db, documents, deadline);
  const authorsFilled = await fillDocumentAuthors(db).catch((error) => {
    console.error("[file-stats] could not fill document authors", error);
    return 0;
  });
  const topicRemaining = await countMissing(db, topicStarterItems);
  const documentRemaining = await countMissing(db, documents);
  return {
    topicStarters: { updated: topicUpdated, remaining: topicRemaining },
    documents: { updated: documentUpdated, remaining: documentRemaining },
    authorsFilled,
    done: topicRemaining === 0 && documentRemaining === 0,
  };
}

/** How many files in each table still have no stats. */
export async function fileStatsRemaining(db: Database): Promise<{ topicStarters: number; documents: number }> {
  await ensureTopicStarterColumns(db);
  await ensureDocumentColumns(db);
  return { topicStarters: await countMissing(db, topicStarterItems), documents: await countMissing(db, documents) };
}
