/**
 * @fileoverview The full-text index of card *bodies* whose text lives in R2.
 *
 * The main card index (`./card-fts`) is an external-content FTS5 table over
 * `debate_cards`, so it can only index what the row holds. Since card text
 * moved to the `CARD_TEXT` bucket (`./card-text-store`), a moved row's
 * `fulltext` is empty, and the main index lost every word of the card that
 * was not also in its tag, highlights, cite or block titles: searching a
 * phrase from a card's body found nothing.
 *
 * This table puts those words back. It is a *contentless* FTS5 table
 * (`content=''`, `contentless_delete=1`), so it stores only the inverted
 * index — no second copy of the text in D1 — and rows can still be deleted by
 * rowid. The rowid is the card id. It is written wherever the body text is in
 * hand on its way to R2:
 *
 * - the Parquet import, for cards whose text goes to R2 (`writeDebateCardBatch`);
 * - the "Move card text to R2" pages (`moveCardTextPage`);
 * - {@link backfillCardBodyIndexPage}, which reads the text back from R2 for
 *   cards moved before this index existed — run by the hourly card-text cron
 *   and by `POST /api/admin/search-index` with `action: "body-backfill"`.
 *
 * Cards whose text is still in D1 are covered by the main index and are never
 * written here. A deleted card is dropped by the `debate_cards_body_fts_ad`
 * trigger.
 *
 * Every function here fails soft: if the table cannot be created (an older
 * SQLite without `contentless_delete`), search simply runs without it.
 * @module lib/search/card-body-fts
 */

import { type SQL, and, asc, desc, eq, notInArray, sql } from "drizzle-orm";
import { type BaseSQLiteDatabase, integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { debateCards, type DebateCardRow } from "@/lib/database/schema";
import { describeError } from "@/lib/database/errors";
import { type CardTextBucket, readCardTexts } from "./card-text-store";

/** The contentless FTS5 table holding the body-text index. */
export const CARD_BODY_FTS_TABLE = "debate_cards_body_fts";

/** Rows per `INSERT` into the index: two bound values each, well under D1's 100-parameter limit. */
const BODY_ROWS_PER_INSERT = 20;
/** Ids per `DELETE … WHERE rowid IN (…)`. */
const BODY_IDS_PER_DELETE = 90;

/** The statements creating the index and its delete trigger. Idempotent. */
export function cardBodyFtsStatements(): string[] {
  return [
    // Same tokenizer and prefix indexes as the main index, so one MATCH
    // expression means the same thing against both.
    `CREATE VIRTUAL TABLE IF NOT EXISTS ${CARD_BODY_FTS_TABLE} USING fts5(
      body,
      content='',
      contentless_delete=1,
      tokenize='unicode61 remove_diacritics 2',
      detail=full,
      prefix='2 3 4'
    )`,
    `CREATE TRIGGER IF NOT EXISTS debate_cards_body_fts_ad AFTER DELETE ON debate_cards BEGIN
      DELETE FROM ${CARD_BODY_FTS_TABLE} WHERE rowid = old.id;
    END`,
  ];
}

/** Drizzle's view of the index: only the rowid is ever selected. */
const debateCardsBodyFts = sqliteTable(CARD_BODY_FTS_TABLE, {
  rowid: integer("rowid").notNull(),
});

type RawDB = {
  all(query: SQL): Promise<unknown>;
  run(query: SQL): Promise<unknown>;
  batch?(statements: unknown[]): Promise<unknown>;
};

/** Per-isolate memo of {@link ensureCardBodyFts}. */
let ensured: Promise<boolean> | undefined;

/**
 * Creates the index if it is missing. Resolves `false` (and logs) when it
 * cannot be created, so callers skip it rather than fail. A failure is
 * retried on the next call.
 */
export function ensureCardBodyFts(db: unknown): Promise<boolean> {
  if (ensured) return ensured;
  const attempt = (async () => {
    try {
      for (const statement of cardBodyFtsStatements()) await (db as RawDB).run(sql.raw(statement));
      return true;
    } catch (error) {
      console.warn("Card body index unavailable:", describeError(error));
      return false;
    }
  })();
  ensured = attempt;
  void attempt.then((ok) => {
    if (!ok && ensured === attempt) ensured = undefined;
  });
  return attempt;
}

/** Test-only: forget whether this isolate created the index. */
export function resetCardBodyFtsMemo(): void {
  ensured = undefined;
}

/**
 * (Re-)indexes the body text of each card. Earlier entries for the same ids
 * are removed first, so re-importing or re-moving a card never leaves stale
 * words behind. Cards with no text are only removed.
 *
 * @returns How many cards now have body text in the index.
 */
export async function indexCardBodies(
  db: unknown,
  cards: readonly { id: number; fulltext: string }[],
): Promise<number> {
  if (cards.length === 0 || !(await ensureCardBodyFts(db))) return 0;
  const raw = db as RawDB;
  const byId = new Map<number, string>();
  for (const card of cards) byId.set(card.id, card.fulltext ?? "");
  const ids = [...byId.keys()];
  const withText = [...byId].filter(([, text]) => text.trim().length > 0);

  const statements: SQL[] = [];
  for (let start = 0; start < ids.length; start += BODY_IDS_PER_DELETE) {
    const slice = ids.slice(start, start + BODY_IDS_PER_DELETE);
    statements.push(
      sql`DELETE FROM ${sql.raw(CARD_BODY_FTS_TABLE)} WHERE rowid IN (${sql.join(slice.map((id) => sql`${id}`), sql`, `)})`,
    );
  }
  for (let start = 0; start < withText.length; start += BODY_ROWS_PER_INSERT) {
    const slice = withText.slice(start, start + BODY_ROWS_PER_INSERT);
    statements.push(
      sql`INSERT INTO ${sql.raw(CARD_BODY_FTS_TABLE)}(rowid, body) VALUES ${sql.join(
        slice.map(([id, text]) => sql`(${id}, ${text})`),
        sql`, `,
      )}`,
    );
  }

  try {
    for (const statement of statements) await raw.run(statement);
    return withText.length;
  } catch (error) {
    // Search still works from the main index; the backfill will retry.
    console.error("Card body index write failed:", describeError(error));
    return 0;
  }
}

/**
 * Cards whose R2-held body matches an FTS expression, best BM25 match first
 * (or in `orderBy` when an explicit sort was chosen).
 *
 * @param match - An expression from `buildFtsMatch` *without* a column
 *   filter: the index has one column.
 * @param where - The non-text filters (season, school, event…), if any.
 * @param excludeIds - Cards already found by the main index.
 * @param ranked - `false` skips BM25 and stops at `limit` matches.
 * @returns Matching rows, or none when the index is unavailable.
 */
export async function searchCardBodies(
  db: BaseSQLiteDatabase<"async", any, any>,
  match: string,
  where: SQL | undefined,
  limit: number,
  excludeIds: readonly number[] = [],
  orderBy: SQL[] = [],
  ranked = true,
): Promise<DebateCardRow[]> {
  if (!match || limit <= 0 || !(await ensureCardBodyFts(db))) return [];
  const order =
    orderBy.length > 0
      ? orderBy
      : ranked
        ? [sql.raw(`bm25(${CARD_BODY_FTS_TABLE})`), desc(debateCards.duplicateCount), asc(debateCards.id)]
        : [];
  try {
    const rows = await db
      .select({ card: debateCards })
      .from(debateCardsBodyFts)
      .innerJoin(debateCards, eq(debateCards.id, debateCardsBodyFts.rowid))
      .where(
        and(
          sql`${sql.raw(CARD_BODY_FTS_TABLE)} MATCH ${match}`,
          where,
          excludeIds.length > 0 ? notInArray(debateCards.id, [...excludeIds]) : undefined,
        ),
      )
      .orderBy(...order)
      .limit(limit);
    return rows.map((row) => row.card);
  } catch (error) {
    console.error("Card body search failed:", describeError(error));
    return [];
  }
}

/**
 * The words to index for a card: its plain `fulltext`, or — for the rare card
 * stored with markup only — that markup with its tags stripped.
 */
export function cardBodyText(card: { fulltext?: string | null; markup?: string | null }): string {
  if (card.fulltext) return card.fulltext;
  return (card.markup ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** One page of {@link backfillCardBodyIndexPage}. */
export interface CardBodyBackfillPage {
  /** Cards whose body text was indexed. */
  indexed: number;
  /** Cards on the page (moved to R2), indexed or not. */
  scanned: number;
  nextAfterId: number;
  done: boolean;
}

/**
 * Indexes the R2-held body text of the next `limit` moved cards after
 * `afterId` — cards whose `fulltext` and `markup` are both empty in D1.
 * Resumable: pass the returned `nextAfterId` back in.
 */
export async function backfillCardBodyIndexPage(
  db: any,
  bucket: CardTextBucket,
  afterId: number,
  limit: number,
): Promise<CardBodyBackfillPage> {
  const rows: { id: number }[] = await db
    .select({ id: debateCards.id })
    .from(debateCards)
    .where(and(sql`${debateCards.id} > ${afterId}`, eq(debateCards.fulltext, ""), eq(debateCards.markup, "")))
    .orderBy(asc(debateCards.id))
    .limit(limit);
  if (rows.length === 0) return { indexed: 0, scanned: 0, nextAfterId: afterId, done: true };

  const ids = rows.map((row) => row.id);
  const texts = await readCardTexts(bucket, ids);
  const indexed = await indexCardBodies(
    db,
    [...texts].map(([id, text]) => ({ id, fulltext: cardBodyText(text) })),
  );
  return { indexed, scanned: rows.length, nextAfterId: ids[ids.length - 1], done: rows.length < limit };
}
