/**
 * @fileoverview B-tree indexes behind the card search's non-text sorts.
 *
 * Text matching goes through the FTS5 inverted index (`card-fts.ts`). The
 * other half of a search is ordering: the page opens on the newest cards
 * (`ORDER BY id DESC`, a rowid walk), "Recent & Popular" orders by
 * `year, duplicate_count, id` and "Most read" orders by `duplicate_count`.
 * Without an index on those columns D1 sorts the whole `debate_cards` table on
 * every such request — and "Recent & Popular" is the default sort, so an
 * unindexed one means the card search answers every visit with an empty,
 * timed-out page.
 *
 * There is no tracked migration folder for the app, so these are created by
 * {@link ensureCardSortIndexes} from the weekly cron and the admin
 * search-index route — never from a search request, because building an index
 * over a large corpus holds the database for the length of the build.
 *
 * @module lib/search/card-search-indexes
 */

import { sql } from "drizzle-orm";

/**
 * Statements creating the sort indexes. Each is idempotent.
 *
 * The column order and direction match `buildCardSearchOrderBy` exactly: SQLite
 * can only walk an index in the requested order when the index's own order is
 * the same (or exactly reversed), and a mismatched direction falls back to a
 * temp B-tree sort of every matching row.
 */
export const CARD_SORT_INDEX_STATEMENTS = [
  // `buildRecentCardOrderBy` is a bare rowid walk, but the index keeps
  // "newest imported" cheap for the admin routes that still say
  // `imported_at DESC, id DESC`.
  "CREATE INDEX IF NOT EXISTS idx_debate_cards_imported_at ON debate_cards(imported_at, id)",
  // "Recent & Popular": `ORDER BY year DESC, duplicate_count DESC, id DESC`.
  // A plain (ASC) index is walked backwards for the all-DESC order, so it
  // needs no DESC columns. This is the default sort, so it is the one that
  // decides whether the card search works at all.
  "CREATE INDEX IF NOT EXISTS idx_debate_cards_recent_popular ON debate_cards(year, duplicate_count, id)",
  // "Most read": `ORDER BY duplicate_count DESC, id ASC`. Mixed directions
  // cannot be served by a plain index, so `duplicate_count` is declared DESC.
  "CREATE INDEX IF NOT EXISTS idx_debate_cards_read_count ON debate_cards(duplicate_count DESC, id ASC)",
] as const;

type RawDB = { run(query: ReturnType<typeof sql.raw>): Promise<unknown> };

/** Creates the card sort indexes that are missing. Safe to call repeatedly. */
export async function ensureCardSortIndexes(db: unknown): Promise<void> {
  for (const statement of CARD_SORT_INDEX_STATEMENTS) await (db as RawDB).run(sql.raw(statement));
}
