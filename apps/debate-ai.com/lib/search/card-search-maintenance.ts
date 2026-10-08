/**
 * @fileoverview Keeps the card search's indexes complete without anyone
 * pressing the admin buttons.
 *
 * A corpus larger than `INLINE_REBUILD_MAX_CARDS` is never indexed by a search
 * request, and until the FTS5 index covers every card, searches fall back to a
 * `LIKE` scan of the whole table. This runs from the weekly cron: it creates
 * the sort indexes, backfills the FTS index in bounded chunks until it is
 * complete, and merges its segments afterwards.
 *
 * @module lib/search/card-search-maintenance
 */

import { backfillCardFts, optimizeCardFts, resetCardFtsMemo, type CardFtsStatus } from "./card-fts";
import { ensureCardSortIndexes } from "./card-search-indexes";

/** Backfill passes per run; each indexes up to 5 × `BACKFILL_CHUNK` cards. */
export const MAX_BACKFILL_PASSES = 25;

/** Brings every card search index up to date, and reports where the FTS index stands. */
export async function maintainCardSearchIndexes(db: unknown, passes = MAX_BACKFILL_PASSES): Promise<CardFtsStatus> {
  await ensureCardSortIndexes(db);
  let status = await backfillCardFts(db);
  let indexedSomething = false;
  for (let pass = 1; pass < passes && !status.complete; pass++) {
    const before = status.indexed;
    status = await backfillCardFts(db);
    indexedSomething ||= status.indexed > before;
    if (status.indexed === before) break;
  }
  if (status.complete || indexedSomething) await optimizeCardFts(db);
  resetCardFtsMemo();
  return status;
}
