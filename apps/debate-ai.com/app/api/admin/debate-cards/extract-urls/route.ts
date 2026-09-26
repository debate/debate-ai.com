/**
 * @fileoverview Runs `debate-card-parser` over every card's citation and
 * stores the source URL it finds in `debate_cards.source_url`.
 *
 * New imports write the column as they land (`writeDebateCardBatch`); cards
 * imported before it existed hold "", so this walks `debate_cards` in id
 * order and backfills them. The same pass refreshes each card's
 * `evidence_reuse_index` entry, so the on-page reuse check and the URL
 * recheck both read what the parser found. A corpus of millions of rows
 * cannot be walked inside one Worker request, so each call handles one page
 * and hands back the cursor for the next — the caller loops until `done`.
 *
 * `POST { afterId?: number, limit?: number }` →
 * `{ processed, withUrl, updated, nextAfterId, done }`.
 *
 * @module app/api/admin/debate-cards/extract-urls/route
 */
import { NextRequest, NextResponse } from "next/server";
import { asc, gt } from "drizzle-orm";
import {
  authorizeCardImport,
  buildReuseIndexStatements,
  buildSourceUrlStatements,
  extractCardSourceUrl,
} from "@/lib/admin/debate-card-import";
import { getDBFromContext } from "@/lib/database/context";
import { debateCards } from "@/lib/database/schema";

const DEFAULT_PAGE_ROWS = 500;
const MAX_PAGE_ROWS = 2_000;

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
  // Only the cite columns and the stored URL — the card HTML is most of a
  // row's size and the URL lives in the citation.
  const cards = await db
    .select({
      id: debateCards.id,
      tag: debateCards.tag,
      cite: debateCards.cite,
      fullcite: debateCards.fullcite,
      caselistDisplayName: debateCards.caselistDisplayName,
      sourceUrl: debateCards.sourceUrl,
    })
    .from(debateCards)
    .where(gt(debateCards.id, afterId))
    .orderBy(asc(debateCards.id))
    .limit(limit);

  // Only rows whose URL changed are written back, so a re-run over an
  // already-extracted corpus costs reads, not writes.
  const updates: { id: number; sourceUrl: string }[] = [];
  let withUrl = 0;
  for (const card of cards) {
    const sourceUrl = extractCardSourceUrl(card);
    if (sourceUrl) withUrl++;
    if (sourceUrl !== card.sourceUrl) updates.push({ id: card.id, sourceUrl });
  }

  const statements = [
    ...buildSourceUrlStatements(db, updates),
    ...buildReuseIndexStatements(db, cards).statements,
  ];
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
    withUrl,
    updated: updates.length,
    nextAfterId: last ? last.id : afterId,
    done: cards.length < limit,
  });
}
