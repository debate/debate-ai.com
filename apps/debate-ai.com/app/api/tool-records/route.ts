import { NextRequest, NextResponse } from "next/server"
import { and, asc, eq, inArray } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedToolRecords } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"
import { TOOL_RECORD_COLLECTIONS } from "debate-data-sync/src/state/toolRecordCollections"

/**
 * Every synced collection for the current user, in one request.
 *
 * `/api/tool-records/[collection]` reads one collection, which is the right
 * granularity for a tool asking about itself. It is the wrong granularity for
 * a sign-in: `useToolRecordSync` reconciles the whole catalog, and one GET per
 * collection is dozens of round trips — each its own D1 read — fired while the
 * page is still painting. The rows all live in one table behind one index on
 * `(user_id, collection)`, so fetching them together is a single query and a
 * single response.
 *
 * GET — `{ [collection]: records[] }`, oldest record first within each
 *   collection, covering only the collections in `TOOL_RECORD_COLLECTIONS`. A
 *   collection the user has nothing under is present and empty, so a caller
 *   can tell "no records" from "not in this response" without consulting the
 *   catalog. Rows stored under a key no longer in the catalog — a collection
 *   renamed or retired since they were written — are skipped rather than
 *   returned, matching the allowlist the per-collection route applies.
 *
 * Writes stay on the per-collection route: a bulk write would have to define
 * what happens when one collection in the batch is rejected, and the mirror
 * has no use for one.
 */
export const GET = withRouteErrors("GET /api/tool-records", async (_req: NextRequest) => {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view your synced tool data." }, { status: 401 })
  }

  const keys = TOOL_RECORD_COLLECTIONS.map((collection) => collection.key)
  const db = await getDBFromContext()
  const rows = await db
    .select({ collection: savedToolRecords.collection, data: savedToolRecords.data })
    .from(savedToolRecords)
    .where(and(eq(savedToolRecords.userId, userId), inArray(savedToolRecords.collection, keys)))
    .orderBy(asc(savedToolRecords.createdAt))

  const byCollection: Record<string, unknown[]> = {}
  for (const key of keys) byCollection[key] = []
  for (const row of rows as { collection: string; data: string }[]) {
    const bucket = byCollection[row.collection]
    if (!bucket) continue
    try {
      bucket.push(JSON.parse(row.data))
    } catch {
      // A row that cannot be parsed is one tool's record, not the whole
      // sign-in: skipping it leaves that record local rather than failing
      // every other collection's merge with it.
    }
  }

  return NextResponse.json(byCollection)
})
