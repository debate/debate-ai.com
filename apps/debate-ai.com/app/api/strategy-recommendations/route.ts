import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedStrategyRecommendations } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * Account-linked strategy-recommendation-history sync — the "🧭
 * Scout-to-Strategy Workflow" bullet's "a history log of past strategy
 * recommendations per matchup" follow-up. One `saved_strategy_recommendations`
 * row per built recommendation (many rows can share a `matchupId`), keyed by
 * the caller-generated `StrategyRecommendationRecord.id`. Same account-only
 * shape as `/api/judge-decisions`/`/api/counsel-panel-assessments` — no
 * anonymous/signed-out mode, 401 without a session — since a synced
 * recommendation only exists once explicitly built.
 *
 * GET — every one of the current user's synced strategy recommendations, in
 *   full (`StrategyRecommendationRecord[]`), across every matchup. Like
 *   `/api/judge-decisions`, this returns full records rather than
 *   label-only summaries — a recommendation's payload is small enough that
 *   `useStrategyRecommendations`'s merge and `StrategyPanel`'s history log
 *   can both use this one call directly without a per-recommendation
 *   follow-up fetch.
 */

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view your synced strategy recommendations." }, { status: 401 })
  }

  const db = await getDBFromContext()
  const rows = await db
    .select({ data: savedStrategyRecommendations.data })
    .from(savedStrategyRecommendations)
    .where(eq(savedStrategyRecommendations.userId, userId))
    .orderBy(asc(savedStrategyRecommendations.createdAt))

  return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
}
