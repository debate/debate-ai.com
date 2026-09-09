import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedTournamentResults } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { isValidTournamentResultRecord, MAX_SAVED_TOURNAMENT_RESULT_BYTES } from "debate-data-sync/src/state/savedTournamentResults"
import { withRouteErrors } from "@/lib/api/route-errors"

/**
 * Account-linked tournament-result history sync — see
 * `/api/tournament-results/route.ts`'s docstring. Single-result CRUD, keyed
 * by `resultId` within the current user's rows — mirrors
 * `/api/word-count-rounds/[roundId]`'s account-only (401 without a session)
 * mode.
 *
 * PUT    { record: TournamentResultRecord } — validates
 *   (`isValidTournamentResultRecord`) and upserts, keyed by
 *   `(userId, resultId)`; the route's `resultId` must match `record.id`.
 * DELETE — removes the synced result for this `resultId`.
 *
 * No GET here: `GET /api/tournament-results` already returns every record
 * in full, so there's no need for a single-result fetch.
 */

export const PUT = withRouteErrors(
  "PUT /api/tournament-results/[resultId]",
  async (req: NextRequest, { params }: { params: Promise<{ resultId: string }> }) => {
    const { resultId } = await params

    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to sync tournament results to your account." }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const record = (body as { record?: unknown } | null)?.record
    if (!isValidTournamentResultRecord(record)) {
      return NextResponse.json({ error: "Request body's \"record\" is not a valid tournament result." }, { status: 400 })
    }
    if (record.id !== resultId) {
      return NextResponse.json({ error: "The record's id must match the URL's result id." }, { status: 400 })
    }

    const data = JSON.stringify(record)
    if (data.length > MAX_SAVED_TOURNAMENT_RESULT_BYTES) {
      return NextResponse.json({ error: "This result is too large to sync to your account." }, { status: 413 })
    }

    const db = await getDBFromContext()
    const now = new Date()

    await db
      .insert(savedTournamentResults)
      .values({ userId, clientId: resultId, data, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [savedTournamentResults.userId, savedTournamentResults.clientId],
        set: { data, updatedAt: now },
      })

    return NextResponse.json({ resultId, updatedAt: now.toISOString() })
  },
)

export const DELETE = withRouteErrors(
  "DELETE /api/tournament-results/[resultId]",
  async (req: NextRequest, { params }: { params: Promise<{ resultId: string }> }) => {
    const { resultId } = await params

    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to manage your synced tournament results." }, { status: 401 })
    }

    const db = await getDBFromContext()
    await db
      .delete(savedTournamentResults)
      .where(and(eq(savedTournamentResults.userId, userId), eq(savedTournamentResults.clientId, resultId)))

    return NextResponse.json({ success: true })
  },
)
