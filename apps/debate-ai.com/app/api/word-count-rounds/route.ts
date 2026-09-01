import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedWordCountRounds } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * Account-linked word-count-round history sync — TODO.md idea #2
 * ("Word-Count-Only Speech Format"), "account-sync round history itself...
 * so the trend view follows a signed-in user across devices" follow-up.
 * One `saved_word_count_rounds` row per (user, round) pair, keyed by the
 * caller-typed `WordCountRoundRecord.roundId`. Same account-only shape as
 * `/api/flows`/`/api/rounds` — no anonymous/signed-out mode, 401 without a
 * session — since a synced round only exists once explicitly saved.
 *
 * GET — every one of the current user's synced word-count rounds, in full
 *   (`WordCountRoundRecord[]`). Unlike `/api/flows`/`/api/rounds`, this
 *   returns full records rather than label-only summaries — a word-count
 *   round's payload is small enough that `useWordCountRounds`'s merge and
 *   `WordCountRoundsPanel`'s trend view can both use this one call directly
 *   without a per-round follow-up fetch.
 *
 * DELETE — removes every one of the current user's synced word-count rounds
 *   at once — the "delete all my synced history" bulk action (TODO.md idea
 *   #2's follow-up list). Single-round deletion still goes through
 *   `/api/word-count-rounds/[roundId]`; this is the whole-collection
 *   counterpart to that route.
 */

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view your synced word-count rounds." }, { status: 401 })
  }

  const db = await getDBFromContext()
  const rows = await db
    .select({ data: savedWordCountRounds.data })
    .from(savedWordCountRounds)
    .where(eq(savedWordCountRounds.userId, userId))
    .orderBy(asc(savedWordCountRounds.createdAt))

  return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to manage your synced word-count rounds." }, { status: 401 })
  }

  const db = await getDBFromContext()
  await db.delete(savedWordCountRounds).where(eq(savedWordCountRounds.userId, userId))

  return NextResponse.json({ success: true })
}
