import { NextResponse } from "next/server"
import { asc, desc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { topicStarterItems } from "@/lib/database/schema"
import { ensureTopicStarterColumns } from "@/lib/topic-starters/changes"

/** Public catalogue for the Debate Editor Topic Starter sidebar. The hard cap
 * keeps the initial editor load bounded while fulfilling the public 100-file
 * browsing requirement.
 *
 * Folders sort *first*: the sidebar builds its tree from `parentId`, so a cap
 * that cut folders off (they used to sort last) left every file under them
 * pointing at a parent the client never received. */
export async function GET() {
  const db = await getDBFromContext()
  await ensureTopicStarterColumns(db)
  const items = await db
    .select()
    .from(topicStarterItems)
    .where(eq(topicStarterItems.published, true))
    .orderBy(desc(topicStarterItems.isFolder), asc(topicStarterItems.title))
    .limit(100)
  return NextResponse.json({ items, limit: 100 })
}
