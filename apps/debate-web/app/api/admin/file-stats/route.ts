/**
 * @fileoverview Admin "Count file stats": fills in the size stats (quotes,
 * blocks, pages, characters) for Topic Starters and My Files rows saved
 * before those columns existed, plus each My Files row's author.
 *
 * `GET` says how many files still have no stats; `POST` counts as many as
 * fit in about 20 seconds and says how many remain, so the admin button
 * calls it again until nothing does. The daily cron runs the same backfill
 * (`lib/file-stats/backfill.ts`), so this only hurries it along. New files
 * are counted on save and import, never here.
 *
 * @module app/api/admin/file-stats/route
 */
import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { backfillFileStats, fileStatsRemaining } from "@/lib/file-stats/backfill";
import { refreshTopicStarterFileIndexQuietly } from "@/lib/topic-starters/file-index";

export async function GET() {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const db = await getDBFromContext();
  return NextResponse.json({ remaining: await fileStatsRemaining(db) });
}

export async function POST() {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const db = await getDBFromContext();
  try {
    const result = await backfillFileStats(db, { budgetMs: 20_000 });
    // The Topic Starters index is a stored snapshot: rebuild it so every
    // visitor's tree shows the new numbers now, not after the daily run.
    if (result.topicStarters.updated > 0) await refreshTopicStarterFileIndexQuietly(db);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[file-stats] backfill failed", error);
    return NextResponse.json(
      { error: `Counting file stats failed (${error instanceof Error ? error.message : String(error)}).` },
      { status: 500 },
    );
  }
}
