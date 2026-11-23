/**
 * @fileoverview Admin controls for the card full-text index.
 *
 * `GET` reports how much of `debate_cards` the FTS5 index covers. `POST`
 * takes `{ action }`:
 *
 * - `backfill` — indexes the next chunks of cards the index lacks, and marks
 *   it complete when none are left. Resumable: call it until `complete`.
 *   This is how a corpus too large to index in one statement gets indexed.
 * - `rebuild` — re-indexes every card in one statement. Use after restoring a
 *   SQL backup (its `INSERT OR REPLACE` bypasses the index triggers).
 * - `optimize` — merges index segments; worth running after a large import.
 *
 * Authorized like the card importer: an admin session or `CARD_IMPORT_TOKEN`.
 *
 * @module app/api/admin/search-index/route
 */
import { type NextRequest, NextResponse } from "next/server";
import { authorizeCardImport } from "@/lib/admin/debate-card-import";
import { getDBFromContext } from "@/lib/database/context";
import { describeError } from "@/lib/database/errors";
import {
  backfillCardFts,
  cardFtsStatus,
  optimizeCardFts,
  rebuildCardFts,
  resetCardFtsMemo,
} from "@/lib/search/card-fts";
import { ensureCardSortIndexes } from "@/lib/search/card-search-indexes";
import { backfillCardBodyIndexPage } from "@/lib/search/card-body-fts";
import { getCardTextBucket } from "@/lib/search/card-text-store";

/** Cards per `body-backfill` page; each is one R2 read. */
const BODY_BACKFILL_DEFAULT_ROWS = 200;
const BODY_BACKFILL_MAX_ROWS = 500;

export async function GET(request: NextRequest) {
  const access = await authorizeCardImport(request);
  if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const db = await getDBFromContext();
  return NextResponse.json(await cardFtsStatus(db));
}

export async function POST(request: NextRequest) {
  const access = await authorizeCardImport(request);
  if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let action: unknown;
  let afterId: unknown;
  let limit: unknown;
  try {
    ({ action, afterId, limit } = (await request.json()) as { action?: unknown; afterId?: unknown; limit?: unknown });
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const db = await getDBFromContext();
  try {
    // Every index action also builds the sort indexes the search's
    // newest-first and "Most read" orders read from.
    if (action === "backfill" || action === "rebuild" || action === "optimize") await ensureCardSortIndexes(db);
    if (action === "backfill") {
      const status = await backfillCardFts(db);
      resetCardFtsMemo();
      return NextResponse.json(status);
    }
    if (action === "rebuild") {
      await rebuildCardFts(db);
      resetCardFtsMemo();
      return NextResponse.json(await cardFtsStatus(db));
    }
    // Indexes the R2-held body text of cards moved out of D1 (see
    // lib/search/card-body-fts.ts). Resumable: post the returned nextAfterId
    // back as afterId until done. The hourly card-text cron runs it too.
    if (action === "body-backfill") {
      const bucket = getCardTextBucket();
      if (!bucket) return NextResponse.json({ error: "No R2 bucket bound as CARD_TEXT." }, { status: 503 });
      const rows = Math.min(
        BODY_BACKFILL_MAX_ROWS,
        Math.max(1, Math.trunc(Number(limit) || BODY_BACKFILL_DEFAULT_ROWS)),
      );
      return NextResponse.json(
        await backfillCardBodyIndexPage(db, bucket, Math.max(0, Math.trunc(Number(afterId) || 0)), rows),
      );
    }
    if (action === "optimize") {
      await optimizeCardFts(db);
      return NextResponse.json(await cardFtsStatus(db));
    }
  } catch (error) {
    return NextResponse.json({ error: describeError(error) }, { status: 500 });
  }
  return NextResponse.json({ error: 'action must be "backfill", "rebuild", "optimize" or "body-backfill".' }, { status: 400 });
}
