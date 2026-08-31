import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedJudgeDecisions } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * Account-linked judge-decision-history sync — TODO.md idea #5 ("AI Judge
 * Decision Modes"), "(b) a decision history log per round instead of only
 * the latest result" follow-up. One `saved_judge_decisions` row per
 * generated decision (many rows can share a `roundId`), keyed by the
 * caller-generated `JudgeDecisionRecord.id`. Same account-only shape as
 * `/api/word-count-rounds` — no anonymous/signed-out mode, 401 without a
 * session — since a synced decision only exists once explicitly generated.
 *
 * GET — every one of the current user's synced judge decisions, in full
 *   (`JudgeDecisionRecord[]`), across every round. Like
 *   `/api/word-count-rounds`, this returns full records rather than
 *   label-only summaries — a judge decision's payload is small enough that
 *   `useJudgeDecisions`'s merge and `JudgeDecisionPanel`'s history log can
 *   both use this one call directly without a per-decision follow-up fetch.
 */

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view your synced judge decisions." }, { status: 401 })
  }

  const db = await getDBFromContext()
  const rows = await db
    .select({ data: savedJudgeDecisions.data })
    .from(savedJudgeDecisions)
    .where(eq(savedJudgeDecisions.userId, userId))
    .orderBy(asc(savedJudgeDecisions.createdAt))

  return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
}
