import { NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { topicStarterItems } from "@/lib/database/schema"
import { ensureTopicStarterColumns } from "@/lib/topic-starters/changes"

/** Bulk export of the whole published Topic Starter library, content included.
 *
 * Used once per device to prime the client's local topic-starter cache (the
 * IndexedDB copy that makes the sidebar and any file open instantly): the
 * browser extension, when installed, backs an unlimited quota so the ~60 MB
 * library can be kept on this device and opened offline. Without the
 * extension the client still caches the capped catalogue
 * (`GET /api/topic-starters`) so the tree renders without a round trip.
 *
 * Every row here is already public — `GET /api/topic-starters/by-path` hands
 * any single file's content to anyone — so a bulk export reveals nothing the
 * catalogue doesn't already. It is uncapped because the point is the entire
 * library in one trip; callers paginate themselves if they want to.
 *
 * @module app/api/topic-starters/all/route
 */
export async function GET() {
  const db = await getDBFromContext()
  await ensureTopicStarterColumns(db)
  const items = await db
    .select()
    .from(topicStarterItems)
    .where(eq(topicStarterItems.published, true))
    .orderBy(asc(topicStarterItems.id))
  return NextResponse.json({ items })
}
