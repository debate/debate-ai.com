import { NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { topicStarterItems } from "@/lib/database/schema"

/** Public catalogue for the CardMirror Topic Starter sidebar. The hard cap
 * keeps the initial editor load bounded while fulfilling the public 100-file
 * browsing requirement. */
export async function GET() {
  const db = await getDBFromContext()
  const items = await db
    .select()
    .from(topicStarterItems)
    .where(eq(topicStarterItems.published, true))
    .orderBy(asc(topicStarterItems.isFolder), asc(topicStarterItems.title))
    .limit(100)
  return NextResponse.json({ items, limit: 100 })
}
