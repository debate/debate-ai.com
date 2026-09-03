import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedSpeechSendLog } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { isValidSpeechSendLogEntry, MAX_SAVED_SPEECH_SEND_LOG_BYTES } from "debate-editor/engine"

/**
 * Account-linked Speech Documents send-log sync — single-entry CRUD, keyed
 * by `entryId` (the entry's own generated `id`) within the current user's
 * rows. Mirrors `/api/judge-decisions/[decisionId]`.
 *
 * PUT    { entry: SpeechSendLogEntry } — validates
 *   (`isValidSpeechSendLogEntry`) and upserts, keyed by `(userId, entryId)`;
 *   the route's `entryId` must match `entry.id`.
 * DELETE — removes the synced entry for this `entryId`.
 *
 * No GET here: `GET /api/speech-send-log` already returns every record in
 * full, so there's no need for a single-entry fetch.
 */

export async function PUT(req: NextRequest, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to sync speech-document history to your account." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const entry = (body as { entry?: unknown } | null)?.entry
  if (!isValidSpeechSendLogEntry(entry)) {
    return NextResponse.json({ error: "Request body's \"entry\" is not a valid speech-send-log entry." }, { status: 400 })
  }
  if (entry.id !== entryId) {
    return NextResponse.json({ error: "The entry's id must match the URL's entry id." }, { status: 400 })
  }

  const data = JSON.stringify(entry)
  if (data.length > MAX_SAVED_SPEECH_SEND_LOG_BYTES) {
    return NextResponse.json({ error: "This entry is too large to sync to your account." }, { status: 413 })
  }

  const db = await getDBFromContext()
  const now = new Date()

  await db
    .insert(savedSpeechSendLog)
    .values({ userId, clientId: entryId, data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [savedSpeechSendLog.userId, savedSpeechSendLog.clientId],
      set: { data, updatedAt: now },
    })

  return NextResponse.json({ entryId, updatedAt: now.toISOString() })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to manage your synced speech-document history." }, { status: 401 })
  }

  const db = await getDBFromContext()
  await db
    .delete(savedSpeechSendLog)
    .where(and(eq(savedSpeechSendLog.userId, userId), eq(savedSpeechSendLog.clientId, entryId)))

  return NextResponse.json({ success: true })
}
