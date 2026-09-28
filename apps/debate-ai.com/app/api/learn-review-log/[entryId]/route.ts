import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedLearnReviewLog } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import {
  isValidReviewLogEntry,
  MAX_SAVED_REVIEW_LOG_ENTRY_BYTES,
  reviewLogEntryId,
} from "debate-editor/engine"
import { withRouteErrors } from "@/lib/api/route-errors"

/**
 * Account-linked Learn review-log sync — single-entry CRUD, keyed by
 * `entryId` (`reviewLogEntryId(entry)`, i.e. `cardId:at`) within the
 * current user's rows. Mirrors `/api/learn-cards/[cardId]`'s account-only
 * (401 without a session) mode.
 *
 * PUT    { entry: ReviewLogEntry } — validates (`isValidReviewLogEntry`)
 *   and upserts, keyed by `(userId, entryId)`; the route's `entryId` must
 *   match `reviewLogEntryId(entry)`. Unlike `/api/learn-cards/[cardId]`,
 *   there is no conflict response: an entry's content for a given id never
 *   changes (`grade()` only appends new entries, never edits one), so this
 *   is a plain idempotent upsert.
 * DELETE — removes the synced entry for this `entryId`.
 *
 * No GET here: `GET /api/learn-review-log` already returns every record in
 * full (see that route's comment for why), so there's no need for a
 * single-entry fetch.
 */

export const PUT = withRouteErrors(
  "PUT /api/learn-review-log/[entryId]",
  async (req: NextRequest, { params }: { params: Promise<{ entryId: string }> }) => {
    const { entryId } = await params

    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to sync review history to your account." }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const entry = (body as { entry?: unknown } | null)?.entry
    if (!isValidReviewLogEntry(entry)) {
      return NextResponse.json({ error: "Request body's \"entry\" is not a valid review-log entry." }, { status: 400 })
    }
    if (reviewLogEntryId(entry) !== entryId) {
      return NextResponse.json({ error: "The entry's id must match the URL's entry id." }, { status: 400 })
    }

    const data = JSON.stringify(entry)
    if (data.length > MAX_SAVED_REVIEW_LOG_ENTRY_BYTES) {
      return NextResponse.json({ error: "This review-log entry is too large to sync to your account." }, { status: 413 })
    }

    const db = await getDBFromContext()
    const now = new Date()

    await db
      .insert(savedLearnReviewLog)
      .values({ userId, clientId: entryId, data, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [savedLearnReviewLog.userId, savedLearnReviewLog.clientId],
        set: { data, updatedAt: now },
      })

    return NextResponse.json({ entryId, updatedAt: now.toISOString() })
  },
)

export const DELETE = withRouteErrors(
  "DELETE /api/learn-review-log/[entryId]",
  async (req: NextRequest, { params }: { params: Promise<{ entryId: string }> }) => {
    const { entryId } = await params

    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to manage your synced review history." }, { status: 401 })
    }

    const db = await getDBFromContext()
    await db
      .delete(savedLearnReviewLog)
      .where(and(eq(savedLearnReviewLog.userId, userId), eq(savedLearnReviewLog.clientId, entryId)))

    return NextResponse.json({ success: true })
  },
)
