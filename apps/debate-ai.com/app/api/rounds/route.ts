import { NextRequest, NextResponse } from "next/server"
import { desc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedRounds } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * Account-linked round cloud save — TODO.md idea #17, follow-up (3)/(b),
 * "rounds" half. One `saved_rounds` row per (user, round) pair, keyed by the
 * local `Round.id` client-side. Same account-only shape as `/api/flows` —
 * no anonymous/signed-out mode, 401 without a session — since a saved round
 * only exists once explicitly synced to an account.
 *
 * GET — list the current user's saved rounds as summaries (`clientId`,
 *   `label`, `updatedAt`), newest first. Omits the full `data` blob so
 *   listing doesn't require parsing every row.
 */

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view your saved rounds." }, { status: 401 })
  }

  const db = await getDBFromContext()
  const rows = await db
    .select({ clientId: savedRounds.clientId, label: savedRounds.label, updatedAt: savedRounds.updatedAt })
    .from(savedRounds)
    .where(eq(savedRounds.userId, userId))
    .orderBy(desc(savedRounds.updatedAt))

  return NextResponse.json(rows)
}
