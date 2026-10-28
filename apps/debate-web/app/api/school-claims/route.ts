import { NextRequest, NextResponse } from "next/server"
import { parseClaimBody } from "@debate-ai/rankings-adapter/src/schools/school-claims"
import { getSession } from "@/lib/auth/session"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getDBFromContext } from "@/lib/database/context"
import { notifyModeratorsOfClaim, sendClaimCodeEmail } from "@/lib/school-claims/notify"
import { SchoolClaimError, createClaim, listMyClaims, withdrawClaim } from "@/lib/school-claims/queries"

/**
 * Claiming to coach or run a school (Settings → General → My school).
 *
 * GET — the signed-in user's claims, newest first, and the schools their
 * approved claims make them own (empty when signed out).
 *
 * POST `{ schoolName, isNewSchool, role, schoolEmail?, explanation? }` —
 * files a claim. With a school address a six-digit code is emailed and the
 * claim waits on it (`PATCH /api/school-claims/<id>`); with only an
 * explanation it goes straight to the moderators.
 */

export const GET = withRouteErrors("GET /api/school-claims", async () => {
  const session = await getSession()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ signedIn: false, claims: [], ownedSchools: [] })
  const db = await getDBFromContext()
  return NextResponse.json({ signedIn: true, ...(await listMyClaims(db, userId)) })
})

export const POST = withRouteErrors("POST /api/school-claims", async (req: NextRequest) => {
  const session = await getSession()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "Sign in to claim a school." }, { status: 401 })

  const parsed = parseClaimBody(await req.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const db = await getDBFromContext()
  try {
    const { claim, code } = await createClaim(db, { userId, ...parsed })
    if (!code || !claim.schoolEmail) {
      await notifyModeratorsOfClaim(db, claim, session.user.name || session.user.email || "A user")
      return NextResponse.json({ claim, delivery: null })
    }
    try {
      const delivery = await sendClaimCodeEmail({ email: claim.schoolEmail, code, schoolName: claim.schoolName })
      return NextResponse.json({ claim, delivery })
    } catch (error) {
      // An unsendable code would strand the claim, so it is dropped and the
      // claimant can try again (or explain instead).
      console.error("Failed to email a school claim code:", error)
      await withdrawClaim(db, userId, claim.id)
      return NextResponse.json(
        { error: "We couldn't send a code to that address. Check it, or write an explanation instead." },
        { status: 502 },
      )
    }
  } catch (error) {
    if (error instanceof SchoolClaimError) return NextResponse.json({ error: error.message }, { status: error.status })
    throw error
  }
})
