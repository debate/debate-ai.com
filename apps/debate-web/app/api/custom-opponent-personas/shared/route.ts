import { NextResponse } from "next/server"
import { and, desc, eq, ne } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedCustomOpponentPersonas } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * The "🤖 AI Practice Opponent" idea's "share a custom-authored persona
 * across a team instead of per-user only" Next item in TODO.md — the
 * team-wide half. No session required, mirroring
 * `GET /api/evidence-reuse-check/dashboard`'s no-auth team dashboard:
 * every signed-in user's `shared: true` library entries are visible to
 * anyone, not scoped to a real team/organization this repo doesn't model
 * elsewhere for crowdsourced content either.
 *
 * GET — every `shared: true` `saved_custom_opponent_personas` row, newest
 *   first, excluding the current viewer's own entries (already returned in
 *   full by `GET /api/custom-opponent-personas`), capped at `SHARED_LIMIT`.
 */

const SHARED_LIMIT = 100

export async function GET() {
  const userId = await getUserId()

  const db = await getDBFromContext()
  const where = userId
    ? and(eq(savedCustomOpponentPersonas.shared, true), ne(savedCustomOpponentPersonas.userId, userId))
    : eq(savedCustomOpponentPersonas.shared, true)

  const rows = await db
    .select({ data: savedCustomOpponentPersonas.data })
    .from(savedCustomOpponentPersonas)
    .where(where)
    .orderBy(desc(savedCustomOpponentPersonas.updatedAt))
    .limit(SHARED_LIMIT)

  return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
}
