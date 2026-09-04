import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedDrillSets } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * Account-linked drill-set sync — the "sharing the 'Practice tier' status
 * across devices for a signed-in user" follow-up named under the "📚 AI
 * Drill Generator" bullet in TODO.md's Research Crowdsourcing Organizer
 * Features. One `saved_drill_sets` row per (user, round) pair, keyed by the
 * caller-typed `DrillSetRecord.roundId`. Same account-only shape as
 * `/api/word-count-rounds`/`/api/round-pairings` — no anonymous/signed-out
 * mode, 401 without a session — since a synced drill set only exists once
 * explicitly saved.
 *
 * GET — every one of the current user's synced drill sets, in full
 *   (`DrillSetRecord[]`). Unlike `/api/flows`/`/api/rounds`, this returns
 *   full records rather than label-only summaries — a drill set's payload is
 *   small enough that `useDrillSets`'s merge can use this one call directly
 *   without a per-round follow-up fetch.
 */

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view your synced drill sets." }, { status: 401 })
  }

  const db = await getDBFromContext()
  const rows = await db
    .select({ data: savedDrillSets.data })
    .from(savedDrillSets)
    .where(eq(savedDrillSets.userId, userId))
    .orderBy(asc(savedDrillSets.createdAt))

  return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
}
