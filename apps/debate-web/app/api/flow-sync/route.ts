import { NextRequest, NextResponse } from "next/server"
import { and, asc, eq, gt } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { flowSyncEdits } from "@/lib/database/schema"

/**
 * Server-backed live sync transport for `debate-round`'s `FlowEdit` records
 * — closes follow-up (a) under TODO.md idea #16 ("Shared, Ai-Generated
 * Debate Flow"): "a live transport (WebSocket or similar) that turns local
 * edits into a shared stream across a room/team". A short-poll transport
 * rather than a WebSocket/Durable Object push channel, consistent with this
 * app's existing D1-backed API-route architecture (see
 * `app/api/doc/documents/route.ts`).
 *
 * GET  ?flowId=<n>&sinceMs=<n>  — every edit for that flow ("room") newer
 *   than `sinceMs`, oldest first, capped at `MAX_EDITS_PER_PULL`.
 * POST { id, flowId, boxPath, authorId, content, timestampMs } — upserts one
 *   edit by its caller-assigned `id`, so re-pushing the same edit (e.g. a
 *   retried push) is a no-op rather than a duplicate row.
 */

const MAX_EDITS_PER_PULL = 500
const MAX_CONTENT_LENGTH = 2000

type FlowEditPayload = {
  id: string
  flowId: number
  boxPath: number[]
  authorId: string
  content: string
  timestampMs: number
}

function toFlowEditPayload(row: typeof flowSyncEdits.$inferSelect): FlowEditPayload {
  let boxPath: number[] = []
  try {
    const parsed = JSON.parse(row.boxPath)
    if (Array.isArray(parsed) && parsed.every((value) => typeof value === "number")) {
      boxPath = parsed
    }
  } catch {
    // Corrupt boxPath: skip rather than throw, mirroring this repo's other
    // stores' corrupt-storage-degrades-gracefully convention.
  }
  return {
    id: row.id,
    flowId: row.flowId,
    boxPath,
    authorId: row.authorId,
    content: row.content,
    timestampMs: row.timestampMs,
  }
}

export async function GET(req: NextRequest) {
  const flowIdParam = req.nextUrl.searchParams.get("flowId")
  const sinceMsParam = req.nextUrl.searchParams.get("sinceMs")

  const flowId = Number(flowIdParam)
  if (!flowIdParam || !Number.isFinite(flowId) || !Number.isInteger(flowId)) {
    return NextResponse.json({ error: "flowId must be a whole number." }, { status: 400 })
  }
  const sinceMs = sinceMsParam != null && sinceMsParam !== "" ? Number(sinceMsParam) : 0
  if (!Number.isFinite(sinceMs)) {
    return NextResponse.json({ error: "sinceMs must be a number." }, { status: 400 })
  }

  const db = await getDBFromContext()
  const rows = await db
    .select()
    .from(flowSyncEdits)
    .where(and(eq(flowSyncEdits.flowId, flowId), gt(flowSyncEdits.timestampMs, sinceMs)))
    .orderBy(asc(flowSyncEdits.timestampMs))
    .limit(MAX_EDITS_PER_PULL)

  return NextResponse.json({ edits: rows.map(toFlowEditPayload) })
}

export async function POST(req: NextRequest) {
  let body: Partial<FlowEditPayload>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const id = typeof body.id === "string" ? body.id.trim() : ""
  const flowId = Number(body.flowId)
  const authorId = typeof body.authorId === "string" ? body.authorId.trim() : ""
  const boxPath = Array.isArray(body.boxPath) ? body.boxPath : null
  const timestampMs = Number(body.timestampMs)

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 })
  }
  if (!Number.isFinite(flowId) || !Number.isInteger(flowId)) {
    return NextResponse.json({ error: "flowId must be a whole number." }, { status: 400 })
  }
  if (!authorId) {
    return NextResponse.json({ error: "authorId is required." }, { status: 400 })
  }
  if (!boxPath || boxPath.length === 0 || !boxPath.every((value) => typeof value === "number")) {
    return NextResponse.json({ error: "boxPath must be a non-empty array of numbers." }, { status: 400 })
  }
  if (!Number.isFinite(timestampMs)) {
    return NextResponse.json({ error: "timestampMs must be a number." }, { status: 400 })
  }

  const content = typeof body.content === "string" ? body.content.slice(0, MAX_CONTENT_LENGTH) : ""

  const db = await getDBFromContext()
  const values = {
    id,
    flowId,
    boxPath: JSON.stringify(boxPath),
    authorId,
    content,
    timestampMs,
  }

  await db
    .insert(flowSyncEdits)
    .values(values)
    .onConflictDoUpdate({ target: flowSyncEdits.id, set: values })

  return NextResponse.json(
    { id, flowId, boxPath, authorId, content, timestampMs } satisfies FlowEditPayload,
    { status: 201 },
  )
}
