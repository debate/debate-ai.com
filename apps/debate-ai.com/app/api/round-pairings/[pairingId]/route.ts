import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedRoundPairings } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { isValidRoundPairingRecord, MAX_SAVED_ROUND_PAIRING_BYTES } from "debate-round"

/**
 * Account-linked round-pairing sync — TODO.md idea #12's "A manual
 * pairing/room-assignment entry form as the practical stand-in" follow-up.
 * Single-pairing CRUD, keyed by `pairingId` (the pairing's `roundId`) within
 * the current user's rows — mirrors `/api/word-count-rounds/[roundId]`'s
 * account-only (401 without a session) mode.
 *
 * PUT    { record: RoundPairingRecord } — validates
 *   (`isValidRoundPairingRecord`) and upserts, keyed by `(userId, pairingId)`;
 *   the route's `pairingId` must match `record.roundId`.
 * DELETE — removes the synced pairing for this `pairingId`.
 *
 * No GET here: `GET /api/round-pairings` already returns every record in
 * full (see that route's comment for why), so there's no need for a
 * single-pairing fetch.
 */

export async function PUT(req: NextRequest, { params }: { params: Promise<{ pairingId: string }> }) {
  const { pairingId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to sync round pairings to your account." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const record = (body as { record?: unknown } | null)?.record
  if (!isValidRoundPairingRecord(record)) {
    return NextResponse.json({ error: "Request body's \"record\" is not a valid round pairing." }, { status: 400 })
  }
  if (record.roundId !== pairingId) {
    return NextResponse.json({ error: "The record's roundId must match the URL's pairing id." }, { status: 400 })
  }

  const data = JSON.stringify(record)
  if (data.length > MAX_SAVED_ROUND_PAIRING_BYTES) {
    return NextResponse.json({ error: "This pairing is too large to sync to your account." }, { status: 413 })
  }

  const db = await getDBFromContext()
  const now = new Date()

  await db
    .insert(savedRoundPairings)
    .values({ userId, clientId: pairingId, data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [savedRoundPairings.userId, savedRoundPairings.clientId],
      set: { data, updatedAt: now },
    })

  return NextResponse.json({ pairingId, updatedAt: now.toISOString() })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ pairingId: string }> }) {
  const { pairingId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to manage your synced round pairings." }, { status: 401 })
  }

  const db = await getDBFromContext()
  await db
    .delete(savedRoundPairings)
    .where(and(eq(savedRoundPairings.userId, userId), eq(savedRoundPairings.clientId, pairingId)))

  return NextResponse.json({ success: true })
}
