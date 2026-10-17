import { NextResponse } from "next/server"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getSession } from "@/lib/auth/session"
import { getDBFromContext } from "@/lib/database/context"
import { checkBallotAccount, createD1BallotStore, tabroomBallotUrl } from "@/lib/tournaments/judge-ballots"

/**
 * GET — whether the visitor can submit a ballot: their signed-in email, the
 * hosted Tabroom person with that email (if any), and whether forwarding to
 * Tabroom is configured. The Ballot tab reads it before showing the form.
 */
export const GET = withRouteErrors("GET /api/judge-ballots/account", async () => {
  const session = await getSession()
  const check = await checkBallotAccount(
    session ? { id: session.user.id, email: session.user.email, name: session.user.name } : null,
    createD1BallotStore(await getDBFromContext()),
    tabroomBallotUrl() !== null,
  )
  return NextResponse.json(check, { headers: { "cache-control": "no-store" } })
})
