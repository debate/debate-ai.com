import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedCustomOpponentPersonas } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * Account-linked custom-opponent-persona-library sync — the "🤖 AI Practice
 * Opponent" idea's "share a custom-authored persona across a team instead
 * of per-user only" Next item in TODO.md's Research Crowdsourcing Organizer
 * Features. One `saved_custom_opponent_personas` row per (user, library
 * entry) pair, keyed by the caller-typed `SavedCustomOpponentPersona.id`.
 * Same account-only shape as `/api/drill-sets` — no anonymous/signed-out
 * mode, 401 without a session — since a synced library entry only exists
 * once explicitly saved. See `/api/custom-opponent-personas/shared` for the
 * no-auth, team-wide view of every user's `shared: true` entries.
 *
 * GET — every one of the current user's synced library entries, in full
 *   (`SavedCustomOpponentPersona[]`).
 */

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view your synced persona library." }, { status: 401 })
  }

  const db = await getDBFromContext()
  const rows = await db
    .select({ data: savedCustomOpponentPersonas.data })
    .from(savedCustomOpponentPersonas)
    .where(eq(savedCustomOpponentPersonas.userId, userId))
    .orderBy(asc(savedCustomOpponentPersonas.createdAt))

  return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
}
