/**
 * @fileoverview Admin-only ingest endpoint for the debate-card library.
 *
 * `POST` takes one batch of normalized cards — a few hundred rows out of a
 * Parquet shard the client is streaming — upserts them by card id, and
 * answers with what landed. `GET` reports what the library holds, which is
 * how the admin panel shows an import's progress and what a finished shard
 * contributed.
 *
 * Shards are never uploaded whole: a single file is hundreds of megabytes of
 * card HTML, past both the request limit and the memory a Worker has to
 * decode Parquet in. The decode happens in the CLI or the browser, and this
 * endpoint sees only the rows.
 *
 * @module app/api/admin/debate-cards/route
 */
import { NextRequest, NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";
import {
  MAX_CARDS_PER_REQUEST,
  authorizeCardImport,
  recordCardImportBatch,
  writeDebateCardBatch,
} from "@/lib/admin/debate-card-import";
import { logImportEvent, newImportId } from "@/lib/admin/import-log";
import { getDBFromContext } from "@/lib/database/context";
import { debateCardImports, debateCards } from "@/lib/database/schema";

/** Shards listed by `GET`; enough to see a corpus without paging. */
const MAX_LISTED_IMPORTS = 200;

/**
 * Reports the card library's contents.
 *
 * @returns Total cards, and every shard imported so far, newest first.
 */
export async function GET(request: NextRequest) {
  const access = await authorizeCardImport(request);
  if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = await getDBFromContext();
  const [totals] = await db
    .select({
      cards: sql<number>`count(*)`,
      caselists: sql<number>`count(distinct ${debateCards.caselistDisplayName})`,
    })
    .from(debateCards);

  const files = await db
    .select()
    .from(debateCardImports)
    .orderBy(desc(debateCardImports.lastImportedAt))
    .limit(MAX_LISTED_IMPORTS);

  return NextResponse.json({
    cards: Number(totals?.cards ?? 0),
    caselists: Number(totals?.caselists ?? 0),
    files,
  });
}

/**
 * Imports one batch of cards from a Parquet shard.
 *
 * @param request - Carries `{ fileName, cards, importId? }`.
 * @returns Rows written, rows refused, and the reason for each refusal.
 */
export async function POST(request: NextRequest) {
  const access = await authorizeCardImport(request);
  if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let payload: { fileName?: unknown; cards?: unknown; importId?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const cards = payload.cards;
  if (!Array.isArray(cards)) {
    return NextResponse.json({ error: "`cards` must be an array." }, { status: 400 });
  }
  if (cards.length > MAX_CARDS_PER_REQUEST) {
    return NextResponse.json(
      {
        error: `Batch holds ${cards.length} cards, over the ${MAX_CARDS_PER_REQUEST}-per-request limit. Lower --batch and retry.`,
      },
      { status: 413 },
    );
  }

  const fileName = String(payload.fileName ?? "").trim().slice(0, 200) || "unnamed.parquet";
  const importId = String(payload.importId ?? "").trim().slice(0, 64) || newImportId();

  try {
    const db = await getDBFromContext();
    const result = await writeDebateCardBatch(db, cards, fileName);
    await recordCardImportBatch(db, {
      fileName,
      imported: result.imported,
      skipped: result.skipped,
      importId,
      actor: access.actor,
    });

    if (result.skipped > 0) {
      logImportEvent({
        importId,
        stage: "partial",
        admin: access.actor,
        fileName,
        counts: { found: cards.length, imported: result.imported, failed: result.skipped },
        reason: result.failures[0]?.reason,
      });
    }

    return NextResponse.json({
      importId,
      fileName,
      imported: result.imported,
      skipped: result.skipped,
      failures: result.failures,
    });
  } catch (error) {
    // One failed batch out of thousands is the case that matters here: the
    // importer retries on 5xx, so the log line is the only place the cause
    // survives.
    logImportEvent({
      importId,
      stage: "failed",
      admin: access.actor,
      fileName,
      counts: { found: cards.length, imported: 0, failed: cards.length },
      error,
    });
    return NextResponse.json(
      {
        error: "Failed to write the batch.",
        details: (error as Error).message,
        importId,
      },
      { status: 500 },
    );
  }
}
