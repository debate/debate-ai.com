import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedDailyBestCardComments } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { isValidDailyBestCardComment, MAX_SAVED_DAILY_BEST_CARD_COMMENT_BYTES } from "debate-community"

/**
 * Account-linked Daily Best Card comment-thread sync — the "🕵️ Daily Best
 * Card Challenge" bullet's "a comment thread on each day's winner"
 * follow-up under Research Crowdsourcing Organizer Features in TODO.md.
 * Single-comment CRUD, keyed by `commentId` (the comment's own generated
 * `id`, not its `dayKey` — many comments can share a day) within the
 * current user's rows — mirrors `/api/judge-decisions/[decisionId]`'s
 * account-only (401 without a session) mode.
 *
 * PUT    { comment: DailyBestCardComment } — validates
 *   (`isValidDailyBestCardComment`) and upserts, keyed by
 *   `(userId, commentId)`; the route's `commentId` must match `comment.id`.
 * DELETE — removes the synced comment for this `commentId`.
 *
 * No GET here: `GET /api/daily-best-card-comments` already returns every
 * comment in full (see that route's comment for why), so there's no need
 * for a single-comment fetch.
 */

export async function PUT(req: NextRequest, { params }: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to sync comments to your account." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const comment = (body as { comment?: unknown } | null)?.comment
  if (!isValidDailyBestCardComment(comment)) {
    return NextResponse.json({ error: "Request body's \"comment\" is not a valid comment." }, { status: 400 })
  }
  if (comment.id !== commentId) {
    return NextResponse.json({ error: "The comment's id must match the URL's comment id." }, { status: 400 })
  }

  const data = JSON.stringify(comment)
  if (data.length > MAX_SAVED_DAILY_BEST_CARD_COMMENT_BYTES) {
    return NextResponse.json({ error: "This comment is too large to sync to your account." }, { status: 413 })
  }

  const db = await getDBFromContext()
  const now = new Date()

  await db
    .insert(savedDailyBestCardComments)
    .values({ userId, clientId: commentId, dayKey: comment.dayKey, data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [savedDailyBestCardComments.userId, savedDailyBestCardComments.clientId],
      set: { data, updatedAt: now },
    })

  return NextResponse.json({ commentId, updatedAt: now.toISOString() })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to manage your synced comments." }, { status: 401 })
  }

  const db = await getDBFromContext()
  await db
    .delete(savedDailyBestCardComments)
    .where(and(eq(savedDailyBestCardComments.userId, userId), eq(savedDailyBestCardComments.clientId, commentId)))

  return NextResponse.json({ success: true })
}
