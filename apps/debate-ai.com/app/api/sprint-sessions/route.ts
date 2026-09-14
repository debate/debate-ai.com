import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedSprintSessions } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * Account-linked scheduled-sprint-session sync — the "🤝 Team Collaboration
 * Mode" bullet's "Scheduled sessions ... are ... local-only (no account
 * sync yet)" Known gap in TODO.md. One `saved_sprint_sessions` row per
 * scheduled session (many rows can share a `topic`), keyed by the
 * caller-generated `SprintSession.id`. Same account-only shape as
 * `/api/daily-best-card-comments` — no anonymous/signed-out mode, 401
 * without a session — since a synced session only exists once explicitly
 * scheduled.
 *
 * GET — every one of the current user's synced sessions, in full
 *   (`SprintSession[]`), across every topic. Like
 *   `/api/daily-best-card-comments`, this returns full records rather than
 *   label-only summaries — a session's payload is small enough that
 *   `useSprintSessionsSync`'s merge and `TopicSprintPanel`'s session list
 *   can both use this one call directly without a per-session follow-up
 *   fetch.
 */

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view your synced sprint sessions." }, { status: 401 })
  }

  const db = await getDBFromContext()
  const rows = await db
    .select({ data: savedSprintSessions.data })
    .from(savedSprintSessions)
    .where(eq(savedSprintSessions.userId, userId))
    .orderBy(asc(savedSprintSessions.createdAt))

  return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
}
