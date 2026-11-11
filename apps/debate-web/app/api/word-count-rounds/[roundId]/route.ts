import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedWordCountRounds } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { isValidWordCountRoundRecord, MAX_SAVED_WORD_COUNT_ROUND_BYTES } from "@debate-ai/practice-rounds"
import { withRouteErrors } from "@/lib/api/route-errors"

/**
 * Single-round writes for the account-linked word-count rounds, keyed by
 * `roundId` within the current user's rows. Account-only (401 without a
 * session), like `/api/drill-sets/[roundId]`.
 *
 * PUT    { record: WordCountRoundRecord } — validates
 *   (`isValidWordCountRoundRecord`) and upserts on `(userId, roundId)`; the
 *   URL's `roundId` must match `record.roundId`. 413 over
 *   `MAX_SAVED_WORD_COUNT_ROUND_BYTES`.
 * DELETE — removes this user's row for `roundId`; a missing row is not an
 *   error, so a repeated delete is harmless.
 *
 * No GET: `GET /api/word-count-rounds` already returns every round in full.
 */

type Params = { params: Promise<{ roundId: string }> }

export const PUT = withRouteErrors("PUT /api/word-count-rounds/[roundId]", async (req: NextRequest, { params }: Params) => {
  const { roundId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to save word-count rounds to your account." }, { status: 401 })
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
    return NextResponse.json({ error: "This round is too large to save to your account." }, { status: 413 })
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
})

export const DELETE = withRouteErrors("DELETE /api/word-count-rounds/[roundId]", async (_req: NextRequest, { params }: Params) => {
  const { roundId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to manage your saved word-count rounds." }, { status: 401 })
  }

  const db = await getDBFromContext()
  await db
    .delete(savedWordCountRounds)
    .where(and(eq(savedWordCountRounds.userId, userId), eq(savedWordCountRounds.clientId, roundId)))

  return NextResponse.json({ success: true })
})
