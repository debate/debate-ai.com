/**
 * @fileoverview Backfills the on-page reuse check from cards already in the
 * library.
 *
 * New imports register each card's cited URL as they write it
 * (`writeDebateCardBatch`). Cards imported before that did not, so this walks
 * `debate_cards` in id order, runs each cite through `debate-card-parser`, and
 * upserts the same `card:<id>` entries. A corpus of millions of rows cannot be
 * walked inside one Worker request, so each call handles one page and hands
 * back the cursor for the next — the caller loops until `done`.
 *
 * `POST { afterId?: number, limit?: number }` →
 * `{ processed, indexed, nextAfterId, done }`.
 *
 * @module app/api/admin/debate-cards/reuse-index/route
 */
import { NextRequest, NextResponse } from "next/server";
import { asc, gt } from "drizzle-orm";
import { authorizeCardImport, buildReuseIndexStatements } from "@/lib/admin/debate-card-import";
import { getDBFromContext } from "@/lib/database/context";
import { debateCards } from "@/lib/database/schema";

const DEFAULT_PAGE_ROWS = 1_000;
const MAX_PAGE_ROWS = 5_000;

export async function POST(request: NextRequest) {
  const access = await authorizeCardImport(request);
  if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { afterId?: unknown; limit?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // An empty body starts from the beginning with the default page size.
  }
  const afterId = Math.max(0, Math.trunc(Number(body.afterId) || 0));
  const limit = Math.min(MAX_PAGE_ROWS, Math.max(1, Math.trunc(Number(body.limit) || DEFAULT_PAGE_ROWS)));

  const db = await getDBFromContext();
  // Only the cite columns — the card HTML is most of a row's size and the URL
  // lives in the citation.
  const cards = await db
    .select({
      id: debateCards.id,
      tag: debateCards.tag,
      cite: debateCards.cite,
      fullcite: debateCards.fullcite,
      caselistDisplayName: debateCards.caselistDisplayName,
    })
    .from(debateCards)
    .where(gt(debateCards.id, afterId))
    .orderBy(asc(debateCards.id))
    .limit(limit);

  const { statements, indexed } = buildReuseIndexStatements(db, cards);
  if (statements.length > 0) {
    if (typeof (db as { batch?: unknown }).batch === "function") {
      await (db as unknown as { batch: (s: unknown[]) => Promise<unknown> }).batch(statements);
    } else {
      for (const statement of statements) await statement;
    }
  }

  const last = cards[cards.length - 1];
  return NextResponse.json({
    processed: cards.length,
    indexed,
    nextAfterId: last ? last.id : afterId,
    done: cards.length < limit,
  });
}
