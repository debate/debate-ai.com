import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedDailyBestCardComments } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * Account-linked Daily Best Card comment-thread sync — the "🕵️ Daily Best
 * Card Challenge" bullet's "a comment thread on each day's winner"
 * follow-up under Research Crowdsourcing Organizer Features in TODO.md. One
 * `saved_daily_best_card_comments` row per posted comment (many rows can
 * share a `dayKey`), keyed by the caller-generated
 * `DailyBestCardComment.id`. Same account-only shape as
 * `/api/judge-decisions` — no anonymous/signed-out mode, 401 without a
 * session — since a synced comment only exists once explicitly posted.
 *
 * GET — every one of the current user's synced comments, in full
 *   (`DailyBestCardComment[]`), across every day. Like
 *   `/api/judge-decisions`, this returns full records rather than
 *   label-only summaries — a comment's payload is small enough that
 *   `useDailyBestCardComments`'s merge and `DailyBestCardPanel`'s threads
 *   can both use this one call directly without a per-comment follow-up
 *   fetch.
 */

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view your synced comments." }, { status: 401 })
  }

  const db = await getDBFromContext()
  const rows = await db
    .select({ data: savedDailyBestCardComments.data })
    .from(savedDailyBestCardComments)
    .where(eq(savedDailyBestCardComments.userId, userId))
    .orderBy(asc(savedDailyBestCardComments.createdAt))

  return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
}
