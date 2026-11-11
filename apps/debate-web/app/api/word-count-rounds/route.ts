import { NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedWordCountRounds } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"

/**
 * Account-linked word-count rounds (`/word-count`). One
 * `saved_word_count_rounds` row per (user, round), keyed by the caller-typed
 * `WordCountRoundRecord.roundId`. Account-only like `/api/drill-sets`: 401
 * without a session, and `useWordCountRounds` keeps working from
 * `localStorage` alone.
 *
 * GET — every one of the current user's word-count rounds in full
 *   (`WordCountRoundRecord[]`), oldest first. A round is a style key plus a
 *   handful of speech texts, so the hook's merge needs no per-round fetch.
 *   A row whose JSON no longer parses is skipped rather than failing the list.
 */

export const GET = withRouteErrors("GET /api/word-count-rounds", async () => {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view your saved word-count rounds." }, { status: 401 })
  }

  const db = await getDBFromContext()
  const rows: { data: string }[] = await db
    .select({ data: savedWordCountRounds.data })
    .from(savedWordCountRounds)
    .where(eq(savedWordCountRounds.userId, userId))
    .orderBy(asc(savedWordCountRounds.createdAt), asc(savedWordCountRounds.id))

  const records: unknown[] = []
  for (const row of rows) {
    try {
      records.push(JSON.parse(row.data))
    } catch {
      // A corrupt row shouldn't hide every other round.
    }
  }
  return NextResponse.json(records)
})
