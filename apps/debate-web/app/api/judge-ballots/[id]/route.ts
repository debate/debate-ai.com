import { NextResponse, type NextRequest } from "next/server"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getSession } from "@/lib/auth/session"
import { getDBFromContext } from "@/lib/database/context"
import { createD1BallotStore } from "@/lib/tournaments/judge-ballots"

export const PATCH = withRouteErrors("PATCH /api/judge-ballots/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Sign in." }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => null) as { winner?: string } | null
  const winner = body?.winner
  if (winner !== "aff" && winner !== "neg") return NextResponse.json({ error: "winner must be aff or neg." }, { status: 400 })
  const store = createD1BallotStore(await getDBFromContext())
  const updated = await store.updateWinner(id, session.user.id, winner)
  if (!updated) return NextResponse.json({ error: "Ballot not found or change window expired." }, { status: 404 })
  return NextResponse.json({ ballot: updated })
})
