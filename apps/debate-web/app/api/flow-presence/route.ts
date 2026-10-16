import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { flowPresenceHeartbeats } from "@/lib/database/schema"

/**
 * Server-backed "who's editing now" presence for `debate-round`'s flow
 * collaborators — closes TODO.md idea #16's ("Shared, Ai-Generated Debate
 * Flow") "Live 'who's editing now' presence indicators alongside the
 * existing merge preview" follow-up. One row per (flowId, authorId) pair,
 * upserted on every heartbeat, mirroring `app/api/flow-sync/route.ts`'s
 * D1-backed short-poll convention.
 *
 * GET  ?flowId=<n>  — every collaborator's current heartbeat for that flow
 *   ("room"). The caller (`flow/flow-presence.ts#listActiveFlowEditors`)
 *   decides freshness against its own clock, so this returns the full
 *   current set rather than filtering server-side.
 * POST { flowId, authorId, lastSeenAt } — upserts one heartbeat by
 *   (flowId, authorId), so a repeated heartbeat from the same collaborator
 *   updates their row instead of accumulating duplicates.
 */

type FlowPresencePayload = {
  flowId: number
  authorId: string
  lastSeenAt: number
}

function toFlowPresencePayload(row: typeof flowPresenceHeartbeats.$inferSelect): FlowPresencePayload {
  return { flowId: row.flowId, authorId: row.authorId, lastSeenAt: row.lastSeenAt }
}

export async function GET(req: NextRequest) {
  const flowIdParam = req.nextUrl.searchParams.get("flowId")

  const flowId = Number(flowIdParam)
  if (!flowIdParam || !Number.isFinite(flowId) || !Number.isInteger(flowId)) {
    return NextResponse.json({ error: "flowId must be a whole number." }, { status: 400 })
  }

  const db = await getDBFromContext()
  const rows = await db
    .select()
    .from(flowPresenceHeartbeats)
    .where(eq(flowPresenceHeartbeats.flowId, flowId))

  return NextResponse.json({ heartbeats: rows.map(toFlowPresencePayload) })
}

export async function POST(req: NextRequest) {
  let body: Partial<FlowPresencePayload>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const flowId = Number(body.flowId)
  const authorId = typeof body.authorId === "string" ? body.authorId.trim() : ""
  const lastSeenAt = Number(body.lastSeenAt)

  if (!Number.isFinite(flowId) || !Number.isInteger(flowId)) {
    return NextResponse.json({ error: "flowId must be a whole number." }, { status: 400 })
  }
  if (!authorId) {
    return NextResponse.json({ error: "authorId is required." }, { status: 400 })
  }
  if (!Number.isFinite(lastSeenAt)) {
    return NextResponse.json({ error: "lastSeenAt must be a number." }, { status: 400 })
  }

  const db = await getDBFromContext()
  const values = { flowId, authorId, lastSeenAt }

  await db
    .insert(flowPresenceHeartbeats)
    .values(values)
    .onConflictDoUpdate({
      target: [flowPresenceHeartbeats.flowId, flowPresenceHeartbeats.authorId],
      set: { lastSeenAt },
    })

  return NextResponse.json(
    { flowId, authorId, lastSeenAt } satisfies FlowPresencePayload,
    { status: 201 },
  )
}
