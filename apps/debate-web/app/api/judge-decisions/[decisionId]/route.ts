import { NextRequest, NextResponse } from "next/server"
import { and, eq, inArray } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedJudgeDecisions } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import {
  isValidJudgeDecisionRecord,
  judgeDecisionIdsOverCap,
  MAX_SAVED_JUDGE_DECISION_BYTES,
  type JudgeDecisionCapEntry,
} from "@debate-ai/practice-rounds"
import { parseSavedRowData } from "@/lib/api/saved-rows"
import { withRouteErrors } from "@/lib/api/route-errors"

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
 *   Then re-applies the per-round cap (`MAX_JUDGE_DECISIONS_PER_ROUND`, 20)
 *   to that round's rows in the account, deleting the oldest beyond it with
 *   the same tie rule the device uses (`judgeDecisionIdsOverCap`), so an older
 *   client that never trims can't grow a round without bound. Answers
 *   `{ decisionId, updatedAt, trimmedIds }`; `trimmedIds` can include
 *   `decisionId` itself when the saved decision is older than the round's 20
 *   newest. Rows whose `data` can't be read are neither counted nor deleted.
 * DELETE — removes the synced decision for this `decisionId`.
 *
 * No GET here: `GET /api/judge-decisions` already returns every record in
 * full (see that route's comment for why), so there's no need for a
 * single-decision fetch.
 */

export const PUT = withRouteErrors(
  "PUT /api/judge-decisions/[decisionId]",
  async (req: NextRequest, { params }: { params: Promise<{ decisionId: string }> }) => {
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

    const trimmedIds = await trimRoundToCap(db, userId, record.roundId)

    return NextResponse.json({ decisionId, updatedAt: now.toISOString(), trimmedIds })
  },
)

/** D1 caps bound parameters per statement at 100; stay well under it alongside `userId`. */
const DELETE_CHUNK = 50

/**
 * Deletes the caller's decisions for `roundId` beyond the per-round cap and
 * returns their ids (oldest first). Only this user's rows are read or deleted.
 */
async function trimRoundToCap(
  db: Awaited<ReturnType<typeof getDBFromContext>>,
  userId: string,
  roundId: string,
): Promise<string[]> {
  const rows = await db
    .select({ clientId: savedJudgeDecisions.clientId, data: savedJudgeDecisions.data })
    .from(savedJudgeDecisions)
    .where(and(eq(savedJudgeDecisions.userId, userId), eq(savedJudgeDecisions.roundId, roundId)))

  const entries: JudgeDecisionCapEntry[] = []
  for (const row of rows) {
    const parsed = parseSavedRowData(row.data)
    if (!parsed.ok || !isValidJudgeDecisionRecord(parsed.value)) continue
    // Key by the row's own client_id: that's what the delete below matches.
    entries.push({ id: row.clientId, roundId, generatedAt: parsed.value.generatedAt })
  }

  const trimmedIds = judgeDecisionIdsOverCap(entries)
  for (let i = 0; i < trimmedIds.length; i += DELETE_CHUNK) {
    await db
      .delete(savedJudgeDecisions)
      .where(
        and(
          eq(savedJudgeDecisions.userId, userId),
          inArray(savedJudgeDecisions.clientId, trimmedIds.slice(i, i + DELETE_CHUNK)),
        ),
      )
  }
  return trimmedIds
}

export const DELETE = withRouteErrors(
  "DELETE /api/judge-decisions/[decisionId]",
  async (req: NextRequest, { params }: { params: Promise<{ decisionId: string }> }) => {
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
  },
)
