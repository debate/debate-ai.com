import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDBFromContext } from "@/lib/database/context"
import { rounds } from "@/lib/database/schema"
import { getUserId } from "@/lib/auth/session"

/**
 * Single cloud-saved round. GET returns the full snapshot (incl. `data`) for
 * restore; DELETE removes it. Ownership check mirrors
 * app/api/doc/documents/[id]/route.ts's loadOwned().
 */

async function loadOwned(id: number, userId: string | null) {
  const db = await getDBFromContext()
  const [round] = await db.select().from(rounds).where(eq(rounds.id, id)).limit(1)
  if (!round) return { db, round: null, forbidden: false }
  if (round.userId && round.userId !== userId) return { db, round, forbidden: true }
  return { db, round, forbidden: false }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await getUserId()
  const { round, forbidden } = await loadOwned(Number(id), userId)

  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 })
  if (forbidden) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  return NextResponse.json({ ...round, data: JSON.parse(round.data) })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await getUserId()
  const { db, round, forbidden } = await loadOwned(Number(id), userId)

  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 })
  if (forbidden) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  await db.delete(rounds).where(eq(rounds.id, Number(id)))

  return NextResponse.json({ success: true })
}
