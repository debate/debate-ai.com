import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedJudgeDecisions } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { isValidJudgeDecisionRecord, MAX_SAVED_JUDGE_DECISION_BYTES } from "debate-practice-rounds"

/**
 * Account-linked judge-decision-history sync — TODO.md idea #5's "(b) a
 * decision history log per round instead of only the latest result"
 * follow-up. Single-decision CRUD, keyed by `decisionId` (the decision's
 * own generated `id`, not its `roundId` — many decisions can share a
 * round) within the current user's rows — mirrors
 * `/api/word-count-rounds/[roundId]`'s account-only (401 without a
 * session) mode.
 *
 * PUT    { record: JudgeDecisionRecord } — validates
 *   (`isValidJudgeDecisionRecord`) and upserts, keyed by
 *   `(userId, decisionId)`; the route's `decisionId` must match `record.id`.
 * DELETE — removes the synced decision for this `decisionId`.
 *
 * No GET here: `GET /api/judge-decisions` already returns every record in
 * full (see that route's comment for why), so there's no need for a
 * single-decision fetch.
 */

export async function PUT(req: NextRequest, { params }: { params: Promise<{ decisionId: string }> }) {
  const { decisionId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to sync judge decisions to your account." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const record = (body as { record?: unknown } | null)?.record
  if (!isValidJudgeDecisionRecord(record)) {
    return NextResponse.json({ error: "Request body's \"record\" is not a valid judge decision." }, { status: 400 })
  }
  if (record.id !== decisionId) {
    return NextResponse.json({ error: "The record's id must match the URL's decision id." }, { status: 400 })
  }

  const data = JSON.stringify(record)
  if (data.length > MAX_SAVED_JUDGE_DECISION_BYTES) {
    return NextResponse.json({ error: "This judge decision is too large to sync to your account." }, { status: 413 })
  }

  const db = await getDBFromContext()
  const now = new Date()

  await db
    .insert(savedJudgeDecisions)
    .values({ userId, clientId: decisionId, roundId: record.roundId, data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [savedJudgeDecisions.userId, savedJudgeDecisions.clientId],
      set: { data, updatedAt: now },
    })

  return NextResponse.json({ decisionId, updatedAt: now.toISOString() })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ decisionId: string }> }) {
  const { decisionId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to manage your synced judge decisions." }, { status: 401 })
  }

  const db = await getDBFromContext()
  await db
    .delete(savedJudgeDecisions)
    .where(and(eq(savedJudgeDecisions.userId, userId), eq(savedJudgeDecisions.clientId, decisionId)))

  return NextResponse.json({ success: true })
}
