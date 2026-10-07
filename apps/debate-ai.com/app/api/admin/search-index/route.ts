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
  try {
    ({ action } = (await request.json()) as { action?: unknown });
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const db = await getDBFromContext();
  try {
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
    if (action === "optimize") {
      await optimizeCardFts(db);
      return NextResponse.json(await cardFtsStatus(db));
    }
  } catch (error) {
    return NextResponse.json({ error: describeError(error) }, { status: 500 });
  }
  return NextResponse.json({ error: 'action must be "backfill", "rebuild" or "optimize".' }, { status: 400 });
}
