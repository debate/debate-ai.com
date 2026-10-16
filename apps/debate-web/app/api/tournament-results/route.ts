import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedTournamentResults } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"

/**
 * Account-linked tournament-result history sync —
 * packages/debate-help-docs/content/docs/features/team-rankings.mdx's "Standings data... stored in localStorage
 * only" Known gap. One `saved_tournament_results` row per (user, result)
 * pair, keyed by the caller-generated `TournamentResultRecord.id`. Same
 * account-only shape as `/api/flows`/`/api/rounds`/`/api/word-count-rounds`
 * — no anonymous/signed-out mode, 401 without a session — since a synced
 * result only exists once explicitly logged or imported.
 *
 * GET — every one of the current user's synced tournament results, in full
 *   (`TournamentResultRecord[]`). Mirrors `/api/word-count-rounds`: a
 *   result's payload is small enough that `useStandingsAccountSync`'s merge
 *   can use this one call directly without a per-result follow-up fetch.
 *
 * DELETE — removes every one of the current user's synced tournament
 *   results at once. Single-result deletion still goes through
 *   `/api/tournament-results/[resultId]`; this is the whole-collection
 *   counterpart to that route.
 */

export const GET = withRouteErrors(
  "GET /api/tournament-results",
  async (req: NextRequest) => {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to view your synced tournament results." }, { status: 401 })
    }

    const db = await getDBFromContext()
    const rows = await db
      .select({ data: savedTournamentResults.data })
      .from(savedTournamentResults)
      .where(eq(savedTournamentResults.userId, userId))
      .orderBy(asc(savedTournamentResults.createdAt))

    return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
  },
)

export const DELETE = withRouteErrors(
  "DELETE /api/tournament-results",
  async (req: NextRequest) => {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to manage your synced tournament results." }, { status: 401 })
    }

    const db = await getDBFromContext()
    await db.delete(savedTournamentResults).where(eq(savedTournamentResults.userId, userId))

    return NextResponse.json({ success: true })
  },
)
