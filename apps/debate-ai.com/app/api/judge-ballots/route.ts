import { NextResponse, type NextRequest } from "next/server"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getSession } from "@/lib/auth/session"
import { getDBFromContext } from "@/lib/database/context"
import {
  TABROOM_TOKEN_HEADER,
  createD1BallotStore,
  createTabroomForward,
  submitJudgeBallot,
  tabroomBallotUrl,
} from "@/lib/tournaments/judge-ballots"

/**
 * Judge ballots — the local API behind the tournaments UI's Ballot tab and
 * the `submit_judge_ballot` tool (`/api/judge-ballots/tool`). See
 * lib/tournaments/judge-ballots.ts.
 *
 * GET  — the signed-in judge's own ballots, newest first; `?tournId=` narrows
 *        to one tournament.
 * POST — submit a ballot (`JudgeBallotInput` as JSON). Rejected with 403 unless
 *        its `tabroomEmail` matches the signed-in email. With destination
 *        `tabroom`, the judge's Tabroom token goes in the `x-tabroom-token`
 *        header; it is forwarded, never stored.
 */

export const GET = withRouteErrors("GET /api/judge-ballots", async (req: NextRequest) => {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Sign in to see your ballots." }, { status: 401 })
  const tournId = Number(req.nextUrl.searchParams.get("tournId"))
  const store = createD1BallotStore(await getDBFromContext())
  const ballots = await store.list(session.user.id, Number.isInteger(tournId) && tournId > 0 ? tournId : undefined)
  return NextResponse.json({ ballots })
})

export const POST = withRouteErrors("POST /api/judge-ballots", async (req: NextRequest) => {
  const session = await getSession()
  const raw = await req.json().catch(() => null)
  const result = await submitJudgeBallot({
    user: session ? { id: session.user.id, email: session.user.email, name: session.user.name } : null,
    raw,
    tabroomToken: req.headers.get(TABROOM_TOKEN_HEADER),
    store: createD1BallotStore(await getDBFromContext()),
    forward: createTabroomForward(tabroomBallotUrl()),
  })
  return NextResponse.json(result.body, { status: result.status, headers: { "cache-control": "no-store" } })
})
