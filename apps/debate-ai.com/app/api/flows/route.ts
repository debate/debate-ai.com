import { NextRequest, NextResponse } from "next/server"
import { desc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedFlows } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * Account-linked flow cloud save — TODO.md idea #17, follow-up (3), "flows"
 * half. One `saved_flows` row per (user, flow) pair, keyed by the local
 * `Flow.id` client-side. Unlike `app/api/doc/documents/route.ts`, there is
 * no anonymous/signed-out mode here — same as `/api/settings`, this is
 * account data, so the handler requires a session and returns 401 without
 * one; the client (`FlowHistoryDialog`'s cloud tab) falls back to a
 * "sign in to sync" message when signed out instead of calling this route.
 *
 * GET — list the current user's saved flows as summaries (`clientId`,
 *   `label`, `updatedAt`), newest first. Omits the full `data` blob so
 *   listing doesn't require parsing every row.
 */

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view your saved flows." }, { status: 401 })
  }

  const db = await getDBFromContext()
  const rows = await db
    .select({ clientId: savedFlows.clientId, label: savedFlows.label, updatedAt: savedFlows.updatedAt })
    .from(savedFlows)
    .where(eq(savedFlows.userId, userId))
    .orderBy(desc(savedFlows.updatedAt))

  return NextResponse.json(rows)
}
