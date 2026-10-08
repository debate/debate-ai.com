/**
 * @fileoverview B-tree indexes behind the card search's non-text sorts.
 *
 * Text matching goes through the FTS5 inverted index (`card-fts.ts`). The
 * other half of a search is ordering: the page opens on the newest cards
 * (`ORDER BY imported_at DESC, id DESC`) and "Most read" orders by
 * `duplicate_count`. Without an index on those columns D1 sorts the whole
 * `debate_cards` table on every such request.
 *
 * There is no tracked migration folder for the app, so these are created by
 * {@link ensureCardSortIndexes} from the weekly cron and the admin
 * search-index route — never from a search request, because building an index
 * over a large corpus holds the database for the length of the build.
 *
 * @module lib/search/card-search-indexes
 */

import { sql } from "drizzle-orm";

/** Statements creating the sort indexes. Each is idempotent. */
export const CARD_SORT_INDEX_STATEMENTS = [
  // SQLite walks this backwards for `imported_at DESC, id DESC`.
  "CREATE INDEX IF NOT EXISTS idx_debate_cards_imported_at ON debate_cards(imported_at, id)",
  "CREATE INDEX IF NOT EXISTS idx_debate_cards_duplicate_count ON debate_cards(duplicate_count)",
] as const;

type RawDB = { run(query: ReturnType<typeof sql.raw>): Promise<unknown> };

/** Creates the card sort indexes that are missing. Safe to call repeatedly. */
export async function ensureCardSortIndexes(db: unknown): Promise<void> {
  for (const statement of CARD_SORT_INDEX_STATEMENTS) await (db as RawDB).run(sql.raw(statement));
}
