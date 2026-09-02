import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedStrategyRecommendations } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { isValidStrategyRecommendationRecord, MAX_SAVED_STRATEGY_RECOMMENDATION_BYTES } from "debate-round"

/**
 * Account-linked strategy-recommendation-history sync — the "🧭
 * Scout-to-Strategy Workflow" bullet's "a history log of past strategy
 * recommendations per matchup" follow-up. Single-recommendation CRUD, keyed
 * by `recommendationId` (the recommendation's own generated `id`, not its
 * `matchupId` — many recommendations can share a matchup) within the current
 * user's rows — mirrors `/api/judge-decisions/[decisionId]`'s account-only
 * (401 without a session) mode.
 *
 * PUT    { record: StrategyRecommendationRecord } — validates
 *   (`isValidStrategyRecommendationRecord`) and upserts, keyed by
 *   `(userId, recommendationId)`; the route's `recommendationId` must match
 *   `record.id`. Also used to re-sync a recommendation after its
 *   `aiCaseChoice` is set — same upsert-by-id shape as a fresh append.
 * DELETE — removes the synced recommendation for this `recommendationId`.
 *
 * No GET here: `GET /api/strategy-recommendations` already returns every
 * record in full (see that route's comment for why), so there's no need for
 * a single-recommendation fetch.
 */

export async function PUT(req: NextRequest, { params }: { params: Promise<{ recommendationId: string }> }) {
  const { recommendationId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to sync strategy recommendations to your account." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const record = (body as { record?: unknown } | null)?.record
  if (!isValidStrategyRecommendationRecord(record)) {
    return NextResponse.json(
      { error: "Request body's \"record\" is not a valid strategy recommendation." },
      { status: 400 },
    )
  }
  if (record.id !== recommendationId) {
    return NextResponse.json({ error: "The record's id must match the URL's recommendation id." }, { status: 400 })
  }

  const data = JSON.stringify(record)
  if (data.length > MAX_SAVED_STRATEGY_RECOMMENDATION_BYTES) {
    return NextResponse.json(
      { error: "This strategy recommendation is too large to sync to your account." },
      { status: 413 },
    )
  }

  const db = await getDBFromContext()
  const now = new Date()

  await db
    .insert(savedStrategyRecommendations)
    .values({ userId, clientId: recommendationId, matchupId: record.matchupId, data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [savedStrategyRecommendations.userId, savedStrategyRecommendations.clientId],
      set: { data, updatedAt: now },
    })

  return NextResponse.json({ recommendationId, updatedAt: now.toISOString() })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ recommendationId: string }> }) {
  const { recommendationId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to manage your synced strategy recommendations." }, { status: 401 })
  }

  const db = await getDBFromContext()
  await db
    .delete(savedStrategyRecommendations)
    .where(
      and(eq(savedStrategyRecommendations.userId, userId), eq(savedStrategyRecommendations.clientId, recommendationId)),
    )

  return NextResponse.json({ success: true })
}
