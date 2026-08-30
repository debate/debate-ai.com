import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedFlows } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { deriveFlowLabel, isValidFlow, MAX_SAVED_FLOW_BYTES } from "debate-round"

/**
 * Account-linked flow cloud save — TODO.md idea #17, follow-up (3), "flows"
 * half. Single-saved-flow CRUD, keyed by `clientId` (the local `Flow.id`
 * assigned client-side by `useFlowStore`) within the current user's rows —
 * mirrors `/api/settings`'s account-only (401 without a session) mode
 * rather than `app/api/doc/documents/[id]/route.ts`'s anonymous-row
 * ownership model, since a saved flow only exists once synced to an
 * account.
 *
 * GET    — the full saved `Flow` for this `clientId`, or 404.
 * PUT    { flow: Flow } — validates (`isValidFlow`) and upserts, keyed by
 *   `(userId, clientId)`; the route's `clientId` must match `flow.id`.
 * DELETE — removes the saved flow for this `clientId`.
 */

function parseClientId(raw: string): number | null {
  const id = Number(raw)
  return Number.isInteger(id) ? id : null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId: rawClientId } = await params
  const clientId = parseClientId(rawClientId)
  if (clientId === null) return NextResponse.json({ error: "Invalid flow id." }, { status: 400 })

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to load your saved flows." }, { status: 401 })
  }

  const db = await getDBFromContext()
  const [row] = await db
    .select()
    .from(savedFlows)
    .where(and(eq(savedFlows.userId, userId), eq(savedFlows.clientId, clientId)))
    .limit(1)

  if (!row) return NextResponse.json({ error: "Saved flow not found." }, { status: 404 })

  return NextResponse.json(JSON.parse(row.data))
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId: rawClientId } = await params
  const clientId = parseClientId(rawClientId)
  if (clientId === null) return NextResponse.json({ error: "Invalid flow id." }, { status: 400 })

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to save flows to your account." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const flow = (body as { flow?: unknown } | null)?.flow
  if (!isValidFlow(flow)) {
    return NextResponse.json({ error: "Request body's \"flow\" is not a valid flow." }, { status: 400 })
  }
  if (flow.id !== clientId) {
    return NextResponse.json({ error: "The flow's id must match the URL's flow id." }, { status: 400 })
  }

  const data = JSON.stringify(flow)
  if (data.length > MAX_SAVED_FLOW_BYTES) {
    return NextResponse.json({ error: "This flow is too large to save to your account." }, { status: 413 })
  }

  const label = deriveFlowLabel(flow)
  const db = await getDBFromContext()
  const now = new Date()

  await db
    .insert(savedFlows)
    .values({ userId, clientId, label, data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [savedFlows.userId, savedFlows.clientId],
      set: { label, data, updatedAt: now },
    })

  return NextResponse.json({ clientId, label, updatedAt: now.toISOString() })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId: rawClientId } = await params
  const clientId = parseClientId(rawClientId)
  if (clientId === null) return NextResponse.json({ error: "Invalid flow id." }, { status: 400 })

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to manage your saved flows." }, { status: 401 })
  }

  const db = await getDBFromContext()
  await db.delete(savedFlows).where(and(eq(savedFlows.userId, userId), eq(savedFlows.clientId, clientId)))

  return NextResponse.json({ success: true })
}
