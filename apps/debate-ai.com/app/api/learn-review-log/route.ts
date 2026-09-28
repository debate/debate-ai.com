import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedLearnReviewLog } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"

/**
 * Account-linked Learn review-log sync — closes the "review history never
 * leaves this device" gap for CardMirror's Learn spaced-repetition store,
 * the same way `/api/learn-cards` closed it for flashcard content and
 * `/api/learn-decks` for custom decks. One `saved_learn_review_log` row per
 * `ReviewLogEntry` (`packages/debate-editor/src/editor/learn-store.ts`),
 * keyed by `reviewLogEntryId(entry)` (`cardId:at`). Account-only — no
 * anonymous/signed-out mode, 401 without a session — since a synced entry
 * only exists once explicitly merged/pushed.
 *
 * GET — every one of the current user's synced review-log entries, in full
 *   (`ReviewLogEntry[]`), for `learn-review-log-sync.ts`'s merge-on-init.
 */

export const GET = withRouteErrors(
  "GET /api/learn-review-log",
  async (req: NextRequest) => {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to view your synced review history." }, { status: 401 })
    }

    const db = await getDBFromContext()
    const rows = await db
      .select({ data: savedLearnReviewLog.data })
      .from(savedLearnReviewLog)
      .where(eq(savedLearnReviewLog.userId, userId))
      .orderBy(asc(savedLearnReviewLog.createdAt))

    return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
  },
)
