import { NextRequest, NextResponse } from "next/server"
import { MAX_REVIEW_NOTE_LENGTH } from "@debate-ai/rankings-adapter/src/schools/school-claims"
import { getStaffAccess } from "@/lib/auth/admin"
import { withRouteErrors } from "@/lib/api/route-errors"
import { getDBFromContext } from "@/lib/database/context"
import { notifyClaimant } from "@/lib/school-claims/notify"
import { SchoolClaimError, listPendingClaims, reviewClaim } from "@/lib/school-claims/queries"

/**
 * Moderator review of school claims — admins and moderators.
 *
 * GET — every claim waiting on review, oldest first, with the claimant and
 * the school's current owners.
 * PATCH `{ id, decision: "approve" | "reject", note? }` — decides one; the
 * claimant gets an in-app notification either way.
 */

export const GET = withRouteErrors("GET /api/admin/school-claims", async () => {
  const { canEditContent } = await getStaffAccess()
  if (!canEditContent) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return NextResponse.json({ claims: await listPendingClaims(await getDBFromContext()) })
})

export const PATCH = withRouteErrors("PATCH /api/admin/school-claims", async (req: NextRequest) => {
  const { canEditContent, email } = await getStaffAccess()
  if (!canEditContent || !email) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = (await req.json().catch(() => null)) as { id?: unknown; decision?: unknown; note?: unknown } | null
  if (typeof body?.id !== "string" || (body.decision !== "approve" && body.decision !== "reject")) {
    return NextResponse.json({ error: 'Provide { id, decision: "approve" | "reject" }.' }, { status: 400 })
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, MAX_REVIEW_NOTE_LENGTH) || null : null

  const db = await getDBFromContext()
  try {
    const { claim, userId } = await reviewClaim(db, { id: body.id, decision: body.decision, note, reviewer: email })
    await notifyClaimant(db, userId, claim)
    return NextResponse.json({ claim })
  } catch (error) {
    if (error instanceof SchoolClaimError) return NextResponse.json({ error: error.message }, { status: error.status })
    throw error
  }
})
