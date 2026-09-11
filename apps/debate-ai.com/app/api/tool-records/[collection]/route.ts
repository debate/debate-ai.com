import { NextRequest, NextResponse } from "next/server"
import { and, asc, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedToolRecords } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"
import {
  findToolRecordCollection,
  isSyncableToolRecord,
  toolRecordId,
  MAX_TOOL_RECORD_BYTES,
  MAX_TOOL_RECORDS_PER_PUSH,
} from "debate-data-sync/src/state/toolRecordCollections"

/**
 * Account-linked sync for the sidebar's localStorage-backed tools — the
 * "per-browser localStorage, not account-synced" Known gap recorded across
 * `packages/debate-help-docs/content/docs/features/*.mdx`. One
 * `saved_tool_records` row per (user, collection,
 * record), keyed by the caller-generated id the collection names
 * (`TOOL_RECORD_COLLECTIONS[].idField`).
 *
 * `collection` is an allowlist value — a key not in `TOOL_RECORD_COLLECTIONS`
 * is a 404, so this route pair can't be used as a free-form per-user blob
 * store. Same account-only shape as `/api/tournament-results` and
 * `/api/drill-sets`: no anonymous mode, 401 without a session, since a synced
 * record only exists once a signed-in user's tool wrote one.
 *
 * GET — every one of the current user's records for this collection, oldest
 *   first, each parsed back into the object the tool stored. Records are
 *   small (one annotation, one judge profile), so this returns them in full
 *   rather than summaries, and `hydrateToolRecords`' merge needs no follow-up
 *   fetch.
 *
 * PUT { records: unknown[] } — bulk upsert, keyed per record. What a first
 *   sign-in uses to push this browser's existing store up in one request
 *   instead of one per record. Every record must be valid or none is written.
 *
 * DELETE — removes every one of the current user's records for this
 *   collection; single-record writes go through `[recordId]/route.ts`.
 */

/** Resolves and allowlist-checks the route's collection segment. */
async function resolveCollection(params: Promise<{ collection: string }>) {
  const { collection: key } = await params
  return { key, collection: findToolRecordCollection(key) }
}

export const GET = withRouteErrors(
  "GET /api/tool-records/[collection]",
  async (req: NextRequest, { params }: { params: Promise<{ collection: string }> }) => {
    const { key, collection } = await resolveCollection(params)
    if (!collection) {
      return NextResponse.json({ error: `Nothing syncs under "${key}".` }, { status: 404 })
    }

    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to view your synced tool data." }, { status: 401 })
    }

    const db = await getDBFromContext()
    const rows = await db
      .select({ data: savedToolRecords.data })
      .from(savedToolRecords)
      .where(and(eq(savedToolRecords.userId, userId), eq(savedToolRecords.collection, key)))
      .orderBy(asc(savedToolRecords.createdAt))

    return NextResponse.json(rows.map((row: { data: string }) => JSON.parse(row.data)))
  },
)

export const PUT = withRouteErrors(
  "PUT /api/tool-records/[collection]",
  async (req: NextRequest, { params }: { params: Promise<{ collection: string }> }) => {
    const { key, collection } = await resolveCollection(params)
    if (!collection) {
      return NextResponse.json({ error: `Nothing syncs under "${key}".` }, { status: 404 })
    }

    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Sign in to sync this tool to your account." }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const records = (body as { records?: unknown } | null)?.records
    if (!Array.isArray(records)) {
      return NextResponse.json({ error: 'Request body\'s "records" must be an array.' }, { status: 400 })
    }
    if (records.length > MAX_TOOL_RECORDS_PER_PUSH) {
      return NextResponse.json(
        { error: `Sync at most ${MAX_TOOL_RECORDS_PER_PUSH} records at a time.` },
        { status: 413 },
      )
    }

    // Validate and serialize the whole batch before writing any of it, so a
    // single bad record can't leave half a store synced.
    const values: { clientId: string; data: string }[] = []
    const seen = new Set<string>()
    for (const record of records) {
      if (!isSyncableToolRecord(collection, record)) {
        return NextResponse.json(
          { error: `Every record needs a "${collection.idField}" to sync under.` },
          { status: 400 },
        )
      }
      const data = JSON.stringify(record)
      if (data.length > MAX_TOOL_RECORD_BYTES) {
        return NextResponse.json({ error: "One of these records is too large to sync." }, { status: 413 })
      }
      const clientId = toolRecordId(collection, record) as string
      // A store holding two records under one id would otherwise make the
      // batch's own rows collide with each other mid-write.
      if (seen.has(clientId)) continue
      seen.add(clientId)
      values.push({ clientId, data })
    }

    const db = await getDBFromContext()
    const now = new Date()
    for (const { clientId, data } of values) {
      await db
        .insert(savedToolRecords)
        .values({ userId, collection: key, clientId, data, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({
          target: [savedToolRecords.userId, savedToolRecords.collection, savedToolRecords.clientId],
          set: { data, updatedAt: now },
        })
    }

    return NextResponse.json({ collection: key, saved: values.length, updatedAt: now.toISOString() })
  },
)

export const DELETE = withRouteErrors(
  "DELETE /api/tool-records/[collection]",
  async (req: NextRequest, { params }: { params: Promise<{ collection: string }> }) => {
    const { key, collection } = await resolveCollection(params)
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
      .where(and(eq(savedToolRecords.userId, userId), eq(savedToolRecords.collection, key)))

    return NextResponse.json({ success: true })
  },
)
