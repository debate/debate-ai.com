import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedWordCountRounds } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { isValidWordCountRoundRecord, MAX_SAVED_WORD_COUNT_ROUND_BYTES } from "debate-round"

/**
 * Account-linked word-count-round history sync — TODO.md idea #2's
 * "account-sync round history itself" follow-up. Single-round CRUD, keyed
 * by `roundId` within the current user's rows — mirrors
 * `/api/rounds/[clientId]`'s account-only (401 without a session) mode.
 *
 * PUT    { record: WordCountRoundRecord } — validates
 *   (`isValidWordCountRoundRecord`) and upserts, keyed by
 *   `(userId, roundId)`; the route's `roundId` must match `record.roundId`.
 * DELETE — removes the synced round for this `roundId`.
 *
 * No GET here: `GET /api/word-count-rounds` already returns every record in
 * full (see that route's comment for why), so there's no need for a
 * single-round fetch.
 */

export async function PUT(req: NextRequest, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to sync word-count rounds to your account." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const record = (body as { record?: unknown } | null)?.record
  if (!isValidWordCountRoundRecord(record)) {
    return NextResponse.json({ error: "Request body's \"record\" is not a valid word-count round." }, { status: 400 })
  }
  if (record.roundId !== roundId) {
    return NextResponse.json({ error: "The record's roundId must match the URL's round id." }, { status: 400 })
  }

  const data = JSON.stringify(record)
  if (data.length > MAX_SAVED_WORD_COUNT_ROUND_BYTES) {
    return NextResponse.json({ error: "This round is too large to sync to your account." }, { status: 413 })
  }

  const db = await getDBFromContext()
  const now = new Date()

  await db
    .insert(savedWordCountRounds)
    .values({ userId, clientId: roundId, data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [savedWordCountRounds.userId, savedWordCountRounds.clientId],
      set: { data, updatedAt: now },
    })

  return NextResponse.json({ roundId, updatedAt: now.toISOString() })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to manage your synced word-count rounds." }, { status: 401 })
  }

  const db = await getDBFromContext()
  await db
    .delete(savedWordCountRounds)
    .where(and(eq(savedWordCountRounds.userId, userId), eq(savedWordCountRounds.clientId, roundId)))

  return NextResponse.json({ success: true })
}
