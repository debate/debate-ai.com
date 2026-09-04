import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedDrillSets } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { isValidDrillSetRecord, MAX_SAVED_DRILL_SET_BYTES } from "debate-round"

/**
 * Account-linked drill-set sync — the "sharing the 'Practice tier' status
 * across devices for a signed-in user" follow-up named under the "📚 AI
 * Drill Generator" bullet in TODO.md. Single-round CRUD, keyed by `roundId`
 * within the current user's rows — mirrors
 * `/api/word-count-rounds/[roundId]`'s account-only (401 without a session)
 * mode.
 *
 * PUT    { record: DrillSetRecord } — validates (`isValidDrillSetRecord`)
 *   and upserts, keyed by `(userId, roundId)`; the route's `roundId` must
 *   match `record.roundId`.
 * DELETE — removes the synced drill set for this `roundId`.
 *
 * No GET here: `GET /api/drill-sets` already returns every record in full
 * (see that route's comment for why), so there's no need for a
 * single-round fetch.
 */

export async function PUT(req: NextRequest, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to sync drill sets to your account." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const record = (body as { record?: unknown } | null)?.record
  if (!isValidDrillSetRecord(record)) {
    return NextResponse.json({ error: "Request body's \"record\" is not a valid drill set." }, { status: 400 })
  }
  if (record.roundId !== roundId) {
    return NextResponse.json({ error: "The record's roundId must match the URL's round id." }, { status: 400 })
  }

  const data = JSON.stringify(record)
  if (data.length > MAX_SAVED_DRILL_SET_BYTES) {
    return NextResponse.json({ error: "This drill set is too large to sync to your account." }, { status: 413 })
  }

  const db = await getDBFromContext()
  const now = new Date()

  await db
    .insert(savedDrillSets)
    .values({ userId, clientId: roundId, data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [savedDrillSets.userId, savedDrillSets.clientId],
      set: { data, updatedAt: now },
    })

  return NextResponse.json({ roundId, updatedAt: now.toISOString() })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to manage your synced drill sets." }, { status: 401 })
  }

  const db = await getDBFromContext()
  await db
    .delete(savedDrillSets)
    .where(and(eq(savedDrillSets.userId, userId), eq(savedDrillSets.clientId, roundId)))

  return NextResponse.json({ success: true })
}
