import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedSprintSessions } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { isValidSprintSession, MAX_SAVED_SPRINT_SESSION_BYTES } from "debate-team-collaboration"

/**
 * Account-linked scheduled-sprint-session sync — the "🤝 Team Collaboration
 * Mode" bullet's "Scheduled sessions ... are ... local-only (no account
 * sync yet)" Known gap in TODO.md. Single-session CRUD, keyed by
 * `sessionId` (the session's own generated `id`, not its `topic` — many
 * sessions can share a topic) within the current user's rows — mirrors
 * `/api/daily-best-card-comments/[commentId]`'s account-only (401 without a
 * session) mode.
 *
 * PUT    { session: SprintSession } — validates (`isValidSprintSession`)
 *   and upserts, keyed by `(userId, sessionId)`; the route's `sessionId`
 *   must match `session.id`.
 * DELETE — removes the synced session for this `sessionId`.
 *
 * No GET here: `GET /api/sprint-sessions` already returns every session in
 * full (see that route's comment for why), so there's no need for a
 * single-session fetch.
 */

export async function PUT(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to sync sessions to your account." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const session = (body as { session?: unknown } | null)?.session
  if (!isValidSprintSession(session)) {
    return NextResponse.json({ error: "Request body's \"session\" is not a valid sprint session." }, { status: 400 })
  }
  if (session.id !== sessionId) {
    return NextResponse.json({ error: "The session's id must match the URL's session id." }, { status: 400 })
  }

  const data = JSON.stringify(session)
  if (data.length > MAX_SAVED_SPRINT_SESSION_BYTES) {
    return NextResponse.json({ error: "This session is too large to sync to your account." }, { status: 413 })
  }

  const db = await getDBFromContext()
  const now = new Date()

  await db
    .insert(savedSprintSessions)
    .values({ userId, clientId: sessionId, topic: session.topic, data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [savedSprintSessions.userId, savedSprintSessions.clientId],
      set: { data, topic: session.topic, updatedAt: now },
    })

  return NextResponse.json({ sessionId, updatedAt: now.toISOString() })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to manage your synced sessions." }, { status: 401 })
  }

  const db = await getDBFromContext()
  await db
    .delete(savedSprintSessions)
    .where(and(eq(savedSprintSessions.userId, userId), eq(savedSprintSessions.clientId, sessionId)))

  return NextResponse.json({ success: true })
}
