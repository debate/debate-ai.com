import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedRoutedTaskQueues } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { isValidRoutedTaskQueueRecord, MAX_SAVED_ROUTED_TASK_QUEUE_BYTES } from "debate-team-collaboration"

/**
 * Account-linked routed-task-queue sync — the "account-syncing routed
 * queues across devices" follow-up named under the "🧭 Research Task
 * Routing" bullet in TODO.md. Single-topic CRUD, keyed by `topicId` within
 * the current user's rows — mirrors `/api/drill-sets/[roundId]`'s
 * account-only (401 without a session) mode.
 *
 * PUT    { record: RoutedTaskQueueRecord } — validates
 *   (`isValidRoutedTaskQueueRecord`) and upserts, keyed by
 *   `(userId, topicId)`; the route's `topicId` must match `record.topicId`.
 * DELETE — removes the synced routed task queue for this `topicId`.
 *
 * No GET here: `GET /api/routed-task-queues` already returns every record in
 * full (see that route's comment for why), so there's no need for a
 * single-topic fetch.
 */

export async function PUT(req: NextRequest, { params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to sync task queues to your account." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const record = (body as { record?: unknown } | null)?.record
  if (!isValidRoutedTaskQueueRecord(record)) {
    return NextResponse.json({ error: "Request body's \"record\" is not a valid routed task queue." }, { status: 400 })
  }
  if (record.topicId !== topicId) {
    return NextResponse.json({ error: "The record's topicId must match the URL's topic id." }, { status: 400 })
  }

  const data = JSON.stringify(record)
  if (data.length > MAX_SAVED_ROUTED_TASK_QUEUE_BYTES) {
    return NextResponse.json({ error: "This task queue is too large to sync to your account." }, { status: 413 })
  }

  const db = await getDBFromContext()
  const now = new Date()

  await db
    .insert(savedRoutedTaskQueues)
    .values({ userId, clientId: topicId, data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [savedRoutedTaskQueues.userId, savedRoutedTaskQueues.clientId],
      set: { data, updatedAt: now },
    })

  return NextResponse.json({ topicId, updatedAt: now.toISOString() })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to manage your synced task queues." }, { status: 401 })
  }

  const db = await getDBFromContext()
  await db
    .delete(savedRoutedTaskQueues)
    .where(and(eq(savedRoutedTaskQueues.userId, userId), eq(savedRoutedTaskQueues.clientId, topicId)))

  return NextResponse.json({ success: true })
}
