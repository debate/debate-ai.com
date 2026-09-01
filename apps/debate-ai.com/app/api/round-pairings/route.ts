import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedRoundPairings } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * Account-linked round-pairing sync — TODO.md idea #12 ("Pre-Round
 * Intelligence Panel"), "A manual pairing/room-assignment entry form as the
 * practical stand-in" follow-up. One `saved_round_pairings` row per (user,
 * round) pair, keyed by the caller-typed `RoundPairingRecord.roundId`. Same
 * account-only shape as `/api/word-count-rounds` — no anonymous/signed-out
 * mode, 401 without a session — since a synced pairing only exists once
 * explicitly saved.
 *
 * GET — every one of the current user's synced round pairings, in full
 *   (`RoundPairingRecord[]`). A pairing's payload is small enough that
 *   `useRoundPairings`'s merge and `PreRoundBriefingsPanel`'s pairing list
 *   can both use this one call directly without a per-pairing follow-up
 *   fetch.
 */

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view your synced round pairings." }, { status: 401 })
  }

  const db = await getDBFromContext()
  const rows = await db
    .select({ data: savedRoundPairings.data })
    .from(savedRoundPairings)
    .where(eq(savedRoundPairings.userId, userId))
    .orderBy(asc(savedRoundPairings.createdAt))

  return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
}
