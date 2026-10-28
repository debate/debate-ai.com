/**
 * @fileoverview Moves the full text of cards imported before the R2 split
 * out of D1 and into the `CARD_TEXT` bucket.
 *
 * Each call handles one page of cards in id order: their `fulltext` and
 * `markup` are written to R2 (`lib/search/card-text-store.ts`), then the two
 * D1 columns are emptied and `spoken` is filled from the markup's highlights
 * when the row had none. A corpus of millions of rows cannot be moved inside
 * one Worker request, so the caller loops on the returned cursor until
 * `done`. Re-running is safe: a row whose text is already gone is skipped.
 *
 * @module lib/admin/card-text-migration
 */

import { and, asc, gt, inArray, ne, or, sql } from "drizzle-orm";
import { debateCards } from "@/lib/database/schema";
import { type CardTextBucket, extractHighlightedText, putCardTexts } from "@/lib/search/card-text-store";

/** Cards per `UPDATE … SET spoken = CASE id …` — 2 bound values per card plus its id. */
const ROWS_PER_UPDATE = 30;

/** What one page of the move did. */
export interface CardTextMovePage {
  /** Cards whose text was written to R2 and emptied in D1. */
  moved: number;
  /** Characters of `fulltext` + `markup` removed from D1 on this page. */
  charsFreed: number;
  /** Pass as `afterId` to fetch the next page. */
  nextAfterId: number;
  done: boolean;
}

/**
 * Moves one page of cards' text from D1 to R2.
 *
 * @param db - Drizzle database handle.
 * @param bucket - The `CARD_TEXT` bucket.
 * @param afterId - Only cards with a larger id are read.
 * @param limit - Cards per page.
 */
export async function moveCardTextPage(
  db: any,
  bucket: CardTextBucket,
  afterId: number,
  limit: number,
): Promise<CardTextMovePage> {
  const cards: { id: number; fulltext: string; markup: string; spoken: string }[] = await db
    .select({
      id: debateCards.id,
      fulltext: debateCards.fulltext,
      markup: debateCards.markup,
      spoken: debateCards.spoken,
    })
    .from(debateCards)
    .where(and(gt(debateCards.id, afterId), or(ne(debateCards.fulltext, ""), ne(debateCards.markup, ""))))
    .orderBy(asc(debateCards.id))
    .limit(limit);

  if (cards.length === 0) return { moved: 0, charsFreed: 0, nextAfterId: afterId, done: true };

  // R2 first, so a failure part-way leaves the D1 text in place and the next
  // run picks the page up again.
  await putCardTexts(bucket, cards);

  const statements: unknown[] = [];
  for (let start = 0; start < cards.length; start += ROWS_PER_UPDATE) {
    const slice = cards.slice(start, start + ROWS_PER_UPDATE);
    const spokenUpdates = slice
      .filter((card) => !card.spoken)
      .map((card) => ({ id: card.id, spoken: extractHighlightedText(card.markup) }))
      .filter((card) => card.spoken);
    const set: Record<string, unknown> = { fulltext: "", markup: "" };
    if (spokenUpdates.length > 0) {
      const cases = sql.join(
        spokenUpdates.map((card) => sql`WHEN ${card.id} THEN ${card.spoken}`),
        sql` `,
      );
      set.spoken = sql`CASE ${debateCards.id} ${cases} ELSE ${debateCards.spoken} END`;
    }
    statements.push(
      db
        .update(debateCards)
        .set(set)
        .where(inArray(debateCards.id, slice.map((card) => card.id))),
    );
  }
  if (typeof db.batch === "function") {
    await db.batch(statements);
  } else {
    for (const statement of statements) await statement;
  }

  return {
    moved: cards.length,
    charsFreed: cards.reduce((total, card) => total + card.fulltext.length + card.markup.length, 0),
    nextAfterId: cards[cards.length - 1].id,
    done: cards.length < limit,
  };
}
