import { NextRequest, NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedRoutedTaskQueues } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * Account-linked routed-task-queue sync — the "account-syncing routed
 * queues across devices" follow-up named under the "🧭 Research Task
 * Routing" bullet in TODO.md's Research Crowdsourcing Organizer Features.
 * One `saved_routed_task_queues` row per (user, topic) pair, keyed by the
 * caller-typed `RoutedTaskQueueRecord.topicId`. Same account-only shape as
 * `/api/drill-sets`/`/api/word-count-rounds` — no anonymous/signed-out mode,
 * 401 without a session — since a synced queue only exists once explicitly
 * routed.
 *
 * GET — every one of the current user's synced routed task queues, in full
 *   (`RoutedTaskQueueRecord[]`). Unlike `/api/flows`/`/api/rounds`, this
 *   returns full records rather than label-only summaries — a routed queue's
 *   payload is small enough that `useRoutedTaskQueues`'s merge can use this
 *   one call directly without a per-topic follow-up fetch.
 */

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view your synced task queues." }, { status: 401 })
  }

  const db = await getDBFromContext()
  const rows = await db
    .select({ data: savedRoutedTaskQueues.data })
    .from(savedRoutedTaskQueues)
    .where(eq(savedRoutedTaskQueues.userId, userId))
    .orderBy(asc(savedRoutedTaskQueues.createdAt))

  return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
}
