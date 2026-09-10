import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedToolRecords } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"
import {
  findToolRecordCollection,
  isSyncableToolRecord,
  toolRecordId,
  MAX_TOOL_RECORD_BYTES,
} from "debate-data-sync/src/state/toolRecordCollections"

/**
 * Account-linked tool-record sync — see `../route.ts`'s docstring. Single-record
 * CRUD, keyed by `recordId` within the current user's rows for this
 * collection; mirrors `/api/tournament-results/[resultId]`'s account-only
 * (401 without a session) mode.
 *
 * PUT    { record: unknown } — validates that the record carries the id field
 *   its collection is keyed by, and upserts by
 *   `(userId, collection, recordId)`. The route's `recordId` must match the
 *   record's own id, so a record can't be filed under someone else's key.
 * DELETE — removes this record from the current user's synced collection.
 *
 * No GET here: `GET /api/tool-records/[collection]` already returns every
 * record in full, so there is nothing a single-record fetch would add.
 */

/** Resolves and allowlist-checks the route's collection segment. */
async function resolveParams(params: Promise<{ collection: string; recordId: string }>) {
  const { collection: key, recordId } = await params
  return { key, recordId, collection: findToolRecordCollection(key) }
}

export const PUT = withRouteErrors(
  "PUT /api/tool-records/[collection]/[recordId]",
  async (
    req: NextRequest,
    { params }: { params: Promise<{ collection: string; recordId: string }> },
  ) => {
    const { key, recordId, collection } = await resolveParams(params)
    if (!collection) {
      return NextResponse.json({ error: `Nothing syncs under "${key}".` }, { status: 404 })
    }

    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to sync this to your account." }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const record = (body as { record?: unknown } | null)?.record
    if (!isSyncableToolRecord(collection, record)) {
      return NextResponse.json(
        { error: `This record needs a "${collection.idField}" to sync under.` },
        { status: 400 },
      )
    }
    if (toolRecordId(collection, record) !== recordId) {
      return NextResponse.json(
        { error: `The record's "${collection.idField}" must match the URL's record id.` },
        { status: 400 },
      )
    }

    const data = JSON.stringify(record)
    if (data.length > MAX_TOOL_RECORD_BYTES) {
      return NextResponse.json({ error: "This record is too large to sync to your account." }, { status: 413 })
    }

    const db = await getDBFromContext()
    const now = new Date()

    await db
      .insert(savedToolRecords)
      .values({ userId, collection: key, clientId: recordId, data, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [savedToolRecords.userId, savedToolRecords.collection, savedToolRecords.clientId],
        set: { data, updatedAt: now },
      })

    return NextResponse.json({ collection: key, recordId, updatedAt: now.toISOString() })
  },
)

export const DELETE = withRouteErrors(
  "DELETE /api/tool-records/[collection]/[recordId]",
  async (
    req: NextRequest,
    { params }: { params: Promise<{ collection: string; recordId: string }> },
  ) => {
    const { key, recordId, collection } = await resolveParams(params)
    if (!collection) {
      return NextResponse.json({ error: `Nothing syncs under "${key}".` }, { status: 404 })
    }

    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to manage your synced tool data." }, { status: 401 })
    }

    const db = await getDBFromContext()
    await db
      .delete(savedToolRecords)
      .where(
        and(
          eq(savedToolRecords.userId, userId),
          eq(savedToolRecords.collection, key),
          eq(savedToolRecords.clientId, recordId),
        ),
      )

    return NextResponse.json({ success: true })
  },
)
