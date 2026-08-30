import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { savedRounds } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"
import { deriveRoundLabel, isValidRound, MAX_SAVED_ROUND_BYTES } from "debate-round"

/**
 * Account-linked round cloud save — TODO.md idea #17, follow-up (3)/(b),
 * "rounds" half. Single-saved-round CRUD, keyed by `clientId` (the local
 * `Round.id` assigned client-side by `useFlowStore`) within the current
 * user's rows — mirrors `/api/flows/[clientId]`'s account-only (401
 * without a session) mode.
 *
 * GET    — the full saved `Round` for this `clientId`, or 404.
 * PUT    { round: Round } — validates (`isValidRound`) and upserts, keyed by
 *   `(userId, clientId)`; the route's `clientId` must match `round.id`.
 * DELETE — removes the saved round for this `clientId`.
 */

function parseClientId(raw: string): number | null {
  const id = Number(raw)
  return Number.isInteger(id) ? id : null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId: rawClientId } = await params
  const clientId = parseClientId(rawClientId)
  if (clientId === null) return NextResponse.json({ error: "Invalid round id." }, { status: 400 })

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to load your saved rounds." }, { status: 401 })
  }

  const db = await getDBFromContext()
  const [row] = await db
    .select()
    .from(savedRounds)
    .where(and(eq(savedRounds.userId, userId), eq(savedRounds.clientId, clientId)))
    .limit(1)

  if (!row) return NextResponse.json({ error: "Saved round not found." }, { status: 404 })

  return NextResponse.json(JSON.parse(row.data))
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId: rawClientId } = await params
  const clientId = parseClientId(rawClientId)
  if (clientId === null) return NextResponse.json({ error: "Invalid round id." }, { status: 400 })

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to save rounds to your account." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const round = (body as { round?: unknown } | null)?.round
  if (!isValidRound(round)) {
    return NextResponse.json({ error: "Request body's \"round\" is not a valid round." }, { status: 400 })
  }
  if (round.id !== clientId) {
    return NextResponse.json({ error: "The round's id must match the URL's round id." }, { status: 400 })
  }

  const data = JSON.stringify(round)
  if (data.length > MAX_SAVED_ROUND_BYTES) {
    return NextResponse.json({ error: "This round is too large to save to your account." }, { status: 413 })
  }

  const label = deriveRoundLabel(round)
  const db = await getDBFromContext()
  const now = new Date()

  await db
    .insert(savedRounds)
    .values({ userId, clientId, label, data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [savedRounds.userId, savedRounds.clientId],
      set: { label, data, updatedAt: now },
    })

  return NextResponse.json({ clientId, label, updatedAt: now.toISOString() })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId: rawClientId } = await params
  const clientId = parseClientId(rawClientId)
  if (clientId === null) return NextResponse.json({ error: "Invalid round id." }, { status: 400 })

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Sign in to manage your saved rounds." }, { status: 401 })
  }

  const db = await getDBFromContext()
  await db.delete(savedRounds).where(and(eq(savedRounds.userId, userId), eq(savedRounds.clientId, clientId)))

  return NextResponse.json({ success: true })
}
