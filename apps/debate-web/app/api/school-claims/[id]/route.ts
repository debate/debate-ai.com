import { NextRequest, NextResponse } from "next/server"
import { isClaimCode } from "@debate-ai/rankings/src/schools/school-claims"
import { getSession } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getDBFromContext } from "@/lib/database/context"
import { notifyModeratorsOfClaim, sendClaimCodeEmail } from "@/lib/school-claims/notify"
import { SchoolClaimError, resendClaimCode, verifyClaimCode, withdrawClaim } from "@/lib/school-claims/queries"

/**
 * One of the signed-in user's school claims.
 *
 * PATCH `{ action: "verify", code }` — enters the emailed code; a match
 * verifies the school address and sends the claim to the moderators.
 * PATCH `{ action: "resend" }` — emails a fresh code.
 * DELETE — withdraws a claim that is not yet approved.
 */

type Context = { params: Promise<{ id: string }> }

function refused(error: unknown) {
  if (error instanceof SchoolClaimError) return NextResponse.json({ error: error.message }, { status: error.status })
  throw error
}

export const PATCH = withRouteErrors("PATCH /api/school-claims/[id]", async (req: NextRequest, { params }: Context) => {
  const session = await getSession()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  const { id } = await params
  const body = (await req.json().catch(() => null)) as { action?: unknown; code?: unknown } | null
  const db = await getDBFromContext()

  try {
    if (body?.action === "verify") {
      if (!isClaimCode(body.code)) return NextResponse.json({ error: "Enter the six-digit code." }, { status: 400 })
      const claim = await verifyClaimCode(db, { userId, id, code: body.code })
      await notifyModeratorsOfClaim(db, claim, session.user.name || session.user.email || "A user")
      return NextResponse.json({ claim })
    }
    if (body?.action === "resend") {
      const { claim, code, email } = await resendClaimCode(db, { userId, id })
      await sendClaimCodeEmail({ email, code, schoolName: claim.schoolName })
      return NextResponse.json({ claim })
    }
  } catch (error) {
    return refused(error)
  }
  return NextResponse.json({ error: 'action must be "verify" or "resend".' }, { status: 400 })
})

export const DELETE = withRouteErrors("DELETE /api/school-claims/[id]", async (_req: NextRequest, { params }: Context) => {
  const userId = (await getSession())?.user?.id
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  const { id } = await params
  try {
    await withdrawClaim(await getDBFromContext(), userId, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return refused(error)
  }
})
